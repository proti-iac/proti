import type { JestEnvironment } from '@jest/environment';
import { jestExpect } from '@jest/expect';
import type { TestResult } from '@jest/test-result';
import type { Config } from '@jest/types';
import type pulumi from '@pulumi/pulumi';
import type { Output } from '@pulumi/pulumi';
import type pulumiOutput from '@pulumi/pulumi/output';
import { MockMonitor } from '@pulumi/pulumi/runtime/mocks';
import * as fc from 'fast-check';
import type { IHasteFS } from 'jest-haste-map';
import type Runtime from 'jest-runtime';
import type Resolver from 'jest-resolve';
import { hrtime } from 'process';

import {
	Config as ProtiConfig,
	DeepReadonly,
	errMsg,
	Generator,
	interceptConstructor,
	isConfig,
	isHasteFS,
	isResolver,
	ModuleLoader,
	MutableWaiter,
	readPulumiProject,
	TestCoordinator,
} from '@proti/core';

import { CheckResult, Result, RunResult, toTestResult } from './test-result';

const now: () => bigint = hrtime.bigint;
const nsToMs = (ms: bigint): number => Number(ms / 1000000n);

type AppendAccompanyingResult = (accompanyingResult: Result) => void;
const makeAccompanyingTest =
	(appendResult: AppendAccompanyingResult) =>
	async <T>(title: string, test: Promise<T>): Promise<T> => {
		const start = now();
		const result = (partialResult: Partial<Result>): void => {
			const end = now();
			return appendResult({
				title,
				start: nsToMs(start),
				end: nsToMs(end),
				duration: nsToMs(end - start),
				errors: [],
				...partialResult,
			});
		};
		const resultVal = errMsg(test, `Failed to ${title}`);
		resultVal.then(() => result({})).catch((e) => result({ errors: [e as Error] }));
		return resultVal;
	};

const getGlobals = async (
	globals: DeepReadonly<Config.ConfigGlobals>
): Promise<[ProtiConfig, Resolver, IHasteFS]> => {
	const err = (subject: string, property: string) =>
		new Error(
			`No ${subject} available in config.globals.${property}. ` +
				'Are you using the @proti/runner runner?\n' +
				`Received ${JSON.stringify(globals[property])}`
		);
	if (!isConfig(globals.proti)) throw err('Proti Config', 'proti');
	if (!isResolver(globals.resolver)) throw err('Resolver', 'resolver');
	if (!isHasteFS(globals.hasteFS)) throw err('HasteFS', 'hasteFS');
	return [globals.proti, globals.resolver, globals.hasteFS];
};

// Make sure we ignore "unhandledRejection" or errors that we actually caught
const ignoreUnhandledRejectionErrors: Set<Error> = new Set();
process.on('unhandledRejection', (err: Error) => {
	if (!ignoreUnhandledRejectionErrors.has(err)) throw err;
});

const runProti = async (
	config: DeepReadonly<Config.ProjectConfig>,
	environment: JestEnvironment,
	runtime: Runtime,
	testPath: string,
	runAccompanyingTest: ReturnType<typeof makeAccompanyingTest>
): Promise<CheckResult> => {
	const [proti, resolver, hasteFS] = await errMsg(
		getGlobals(config.globals),
		'Failed to get configuration from globals'
	);
	const pulumiProject = await runAccompanyingTest(
		'Read Pulumi.yaml',
		readPulumiProject(testPath)
	);
	const moduleLoader = new ModuleLoader(
		config,
		proti.moduleLoading,
		runtime,
		resolver,
		hasteFS,
		pulumiProject.main
	);

	if (config.injectGlobals) {
		const globals = {
			expect: jestExpect,
		};
		Object.assign(environment.global, globals);
	}

	await runAccompanyingTest('Transform program', moduleLoader.transformProgram());
	const preloads = await runAccompanyingTest('Preload modules', moduleLoader.preload());
	if (!preloads.has('@pulumi/pulumi')) throw new Error('Did not to preload @pulumi/pulumi');
	const programPulumi = preloads.get('@pulumi/pulumi') as typeof pulumi;
	if (!preloads.has('@pulumi/pulumi/output'))
		throw new Error('Did not to preload @pulumi/pulumi/output');
	const programPulumiOutput = preloads.get('@pulumi/pulumi/output') as typeof pulumiOutput;
	const outputsWaiter = new MutableWaiter();

	// Ensure all Pulumi `Output` objects are registered to be waited for.
	// Patches the `Output` constructor for all instantiations from outside Pulumi's output module.
	// `OutputImpl` objects instantiated inside Pulumi's `output` module are not intercepted!
	(programPulumiOutput.Output as any) = interceptConstructor(
		programPulumiOutput.Output as unknown as { new (...v: any[]): Output<any> },
		(output: any) => {
			// Registers all promises of outputs instantiated from outstide Pulumi's output module.
			outputsWaiter.wait(output.promise());

			// Outputs returned by outputs' apply-callbacks are instantiated in Pulumi's output model.
			// Thus, for them, the constructor is not intercepted and we have to monkey patch apply:
			const origApply = output.apply;
			// eslint-disable-next-line no-param-reassign
			output.apply = (...args: any[]) => {
				const o = origApply.apply(output, args);
				// Registers all promises of apply-callback outputs
				// (these are instantiated from inside Pulumi's output module).
				outputsWaiter.wait((o as any).promise());
				return o;
			};
		}
	);

	const testCoordinator = new TestCoordinator(proti.testCoordinator, {
		moduleLoader,
		pluginsConfig: proti.plugins,
		testPath,
		cacheDir: config.cacheDirectory,
	});

	const runStats: RunResult[] = [];
	let runIdCounter = 0;
	const testPredicate = async (generator: Generator): Promise<boolean> => {
		// eslint-disable-next-line no-plusplus
		const runId = ++runIdCounter;
		const errors: Error[] = [];
		const testRunCoordinator = await testCoordinator.newRunCoordinator(generator);
		await runtime.isolateModulesAsync(async () => {
			outputsWaiter.reset();
			await moduleLoader.mockModules(preloads);

			const monitor: MockMonitor = new MockMonitor({
				async newResource(args: pulumi.runtime.MockResourceArgs) {
					const resource = {
						urn: (monitor as any).newUrn(undefined, args.type, args.name),
						...args,
					};
					testRunCoordinator.validateResource(resource);
					return testRunCoordinator.generateResourceOutput(resource);
				},
				call(args: pulumi.runtime.MockCallArgs) {
					const msg = `ProTI does not support provider functions 😢 Called: ${args.token}`;
					throw new Error(msg);
				},
			});
			// Load MockMonitor from ProTI's Pulumi instance into the PUT's Pulumi instance
			programPulumi.runtime.setMockOptions(monitor);

			const runStart = now();
			await moduleLoader.execProgram().catch((error) => errors.push(error));
			errors.push(...(await outputsWaiter.isCompleted()));
			// Skips deployment validation if an error was found already
			await Promise.race([
				(async () => {
					testRunCoordinator.validateDeployment(monitor.resources);
					await testRunCoordinator.isDone;
				})(),
				testRunCoordinator.isDone,
			]);

			errors.forEach((error) => ignoreUnhandledRejectionErrors.add(error));
			testRunCoordinator.fails.forEach((fail) => {
				errors.push(
					new Error(
						`Oracle "${fail.oracle.name}" failed on ${
							fail.resource ? `${fail.resource.urn}` : 'deployment'
						}`,
						{ cause: fail.error }
					)
				);
			});
			const runEnd = now();
			runStats.push({
				title: `Check program (run ${runId})`,
				start: nsToMs(runStart),
				end: nsToMs(runEnd),
				duration: nsToMs(runEnd - runStart),
				generator: generator.toString(),
				errors,
			});
		});
		return errors.length === 0;
	};
	const start = now();
	const checkDetails = await fc.check(
		fc.asyncProperty(await testCoordinator.arbitrary, testPredicate),
		proti.testRunner as fc.Parameters<[Generator]>
	);
	const report = fc.defaultReportMessage(checkDetails);

	const end = now();
	return (({ failed, interrupted, numRuns, numShrinks, numSkips }) => ({
		failed,
		interrupted,
		start: nsToMs(start),
		end: nsToMs(end),
		duration: nsToMs(end - start),
		numRuns,
		numShrinks,
		numSkips,
		runResults: runStats,
		report,
	}))(checkDetails);
};

const testRunner = async (
	globalConfig: DeepReadonly<Config.GlobalConfig>,
	config: DeepReadonly<Config.ProjectConfig>,
	environment: JestEnvironment,
	runtime: Runtime,
	testPath: string
): Promise<DeepReadonly<TestResult>> => {
	const start = now();
	const accompanyingResults: Result[] = [];
	const runAccompanyingTest = makeAccompanyingTest((result) => accompanyingResults.push(result));
	const checkResult = await runAccompanyingTest(
		'Running ProTI',
		runProti(config, environment, runtime, testPath, runAccompanyingTest)
	).catch(() => undefined);
	return toTestResult({
		testPath,
		start: nsToMs(start),
		end: nsToMs(now()),
		checkResult,
		accompanyingResults,
	});
};

export default testRunner;
