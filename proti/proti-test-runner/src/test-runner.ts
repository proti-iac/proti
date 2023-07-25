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
	specImpl,
	TestCoordinator,
} from '@proti/core';

import { CheckResult, Result, RunResult, toTestResult } from './test-result';

const now: () => bigint = hrtime.bigint;
const nsToMs = (ms: bigint): number => Number(ms / 1000000n);

type AppendAccompanyingResult = (accompanyingResult: Result) => void;
const makeAccompanyingTest =
	(appendResult: AppendAccompanyingResult) =>
	async <T>(title: string, test: Promise<T> | T): Promise<T> => {
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
		const resultVal = errMsg(Promise.resolve(test), `Failed to ${title}`);
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
let notifyUnhandledRejection: ((error: Error) => void) | undefined;
process.on('unhandledRejection', (err: Error) => {
	if (!ignoreUnhandledRejectionErrors.has(err))
		if (notifyUnhandledRejection !== undefined) notifyUnhandledRejection(err);
		else throw err;
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

	if (config.injectGlobals) {
		const globals = {
			expect: jestExpect,
		};
		Object.assign(environment.global, globals);
	}

	const resolveAndTransform = async () => {
		const modLoader = await ModuleLoader.create(
			config,
			proti.moduleLoading,
			runtime,
			resolver,
			hasteFS,
			pulumiProject.main
		);
		modLoader.transformProgram();
		return modLoader;
	};
	const moduleLoader = await runAccompanyingTest('Transform program', resolveAndTransform());
	const preloads = await runAccompanyingTest('Preload modules', moduleLoader.preload());
	if (!preloads.has('@pulumi/pulumi')) throw new Error('Did not to preload @pulumi/pulumi');
	const programPulumi = preloads.get('@pulumi/pulumi') as typeof pulumi;
	if (!preloads.has('@pulumi/pulumi/output'))
		throw new Error('Did not preload @pulumi/pulumi/output');
	const programPulumiOutput = preloads.get('@pulumi/pulumi/output') as typeof pulumiOutput;
	const outputsWaiter = new MutableWaiter();

	// Add @proti/spec ad-hoc specifications implementation to mocks, if it is used and enabled
	const mocks: ReadonlyMap<string, unknown> =
		moduleLoader.isProgramDependency('@proti/spec/bin/index.js') &&
		proti.testRunner.disableAdHocSpecs !== true
			? new Map([...preloads, ['@proti/spec', specImpl]])
			: preloads;

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
		const unhandledRejection = new Promise<void>((_, reject) => {
			notifyUnhandledRejection = reject;
		}).catch((err) => errors.push(err));
		const testRunCoordinator = await testCoordinator.newRunCoordinator(generator);
		await runtime.isolateModulesAsync(async () => {
			outputsWaiter.reset();
			moduleLoader.mockModules(mocks);

			const monitor: MockMonitor = new MockMonitor({
				async newResource(args: pulumi.runtime.MockResourceArgs) {
					const resource = {
						urn: (monitor as any).newUrn(undefined, args.type, args.name),
						...args,
					};
					testRunCoordinator.validateResource(resource);
					return testRunCoordinator.generator.generateResourceOutput(resource);
				},
				call(args: pulumi.runtime.MockCallArgs) {
					const msg = `ProTI does not support provider functions 😢 Called: ${args.token}`;
					throw new Error(msg);
				},
			});
			// Load MockMonitor from ProTI's Pulumi instance into the PUT's Pulumi instance
			programPulumi.runtime.setMockOptions(monitor);

			// Hard timeout for asnyc and deasync code that fast-check's softer
			// timeout cannot handle. The hard timeout breaks ProTI's execution
			// and takes one second longer to ensure fast-check's timeout is
			// used whenever possible. Finally, sync code that blocks the event
			// loop can also not be interrupted by this.
			if (proti.testRunner.timeout) {
				const hardTimeout = proti.testRunner.timeout + 1000;
				setTimeout(() => {
					const err =
						'🤯🧨 ProTI failed with a hard timeout. 💥 ' +
						`The program execution took longer than ${hardTimeout}ms. ` +
						'You may want to check the program under test for deadlocks or increase the timeout.';
					throw new Error(err);
				}, hardTimeout);
			}

			const runStart = now();
			try {
				moduleLoader.execProgram();
			} catch (error) {
				errors.push(error as Error);
			}
			errors.push(
				...(await Promise.race([
					unhandledRejection.then(() => []),
					outputsWaiter.isCompleted(),
				]))
			);
			// Give remaining async code a chance to settle
			await new Promise(setImmediate);
			// Skips deployment validation if an error was found already
			await Promise.race([
				unhandledRejection,
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
						`Oracle "${fail.oracle.name}" found a 🐞 in ${
							fail?.resource?.urn || 'the deployment'
						}`,
						{ cause: fail.error }
					)
				);
			});
			const runEnd = now();
			notifyUnhandledRejection = undefined;
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
