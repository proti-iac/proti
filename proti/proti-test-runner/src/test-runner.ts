import type { JestEnvironment } from '@jest/environment';
import { jestExpect } from '@jest/expect';
import type { TestResult } from '@jest/test-result';
import type { Config } from '@jest/types';
import type pulumi from '@pulumi/pulumi';
import type { Output } from '@pulumi/pulumi';
import type pulumiOutput from '@pulumi/pulumi/output';
import type { MockMonitor } from '@pulumi/pulumi/runtime/mocks';
import * as fc from 'fast-check';
import type { IHasteFS } from 'jest-haste-map';
import type Runtime from 'jest-runtime';
import type Resolver from 'jest-resolve';

import {
	Config as ProtiConfig,
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

import { RunResult, toTestResult } from './test-result';

type AppendRunResult = (result: RunResult) => void;
const makeRunTest =
	(appendResult: AppendRunResult) =>
	async <T>(title: string, test: Promise<T>): Promise<T> => {
		const start = Date.now();
		const result = (partialResult: Partial<RunResult>): void =>
			appendResult({
				title,
				duration: Date.now() - start,
				passedAsserts: 0,
				errors: [],
				...partialResult,
			});
		const resultVal = errMsg(test, `Failed to ${title}`);
		resultVal
			.then(() => result({ passedAsserts: 1 }))
			.catch((e) => result({ errors: [e as Error] }));
		return resultVal;
	};

const getGlobals = async (
	globals: Config.ConfigGlobals
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

const testRunner = async (
	globalConfig: Config.GlobalConfig,
	config: Config.ProjectConfig,
	environment: JestEnvironment,
	runtime: Runtime,
	testPath: string
): Promise<TestResult> => {
	const start = Date.now();
	const results: RunResult[] = [];
	const runTest = makeRunTest((result) => results.push(result));

	try {
		const [proti, resolver, hasteFS] = await errMsg(
			getGlobals(config.globals),
			'Failed to get configuration from globals'
		);
		const pulumiProject = await runTest('Read Pulumi.yaml', readPulumiProject(testPath));
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

		await runTest('Transform program', moduleLoader.transformProgram());
		const preloads = await runTest('Preload modules', moduleLoader.preload());
		if (!preloads.has('@pulumi/pulumi')) throw new Error('Did not to preload @pulumi/pulumi');
		const programPulumi = preloads.get('@pulumi/pulumi') as typeof pulumi;
		if (!preloads.has('@pulumi/pulumi/output'))
			throw new Error('Did not to preload @pulumi/pulumi/output');
		const programPulumiOutput = preloads.get('@pulumi/pulumi/output') as typeof pulumiOutput;
		const outputsWaiter = new MutableWaiter();

		// Ensure all Pulumi output are registered to be waited for.
		// Patches the Output constructore for all output instantiation from out side Pulumi's output module.
		// OutputImpl object instantiated from inside Pulumi's output module are not intercepted!
		(programPulumiOutput.Output as any) = interceptConstructor(
			programPulumiOutput.Output as unknown as { new (...v: any[]): Output<any> },
			(output: any) => {
				// Registers all promises of outputs instantiated from outstide Pulumi's output module.
				outputsWaiter.wait(output.promise());

				// Outputs returend by outputs' apply-callbacks are instantiated in Pulumi's output model.
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

		const testCoordinator = new TestCoordinator(proti.testCoordinator);

		let runIdCounter = 0;
		const testPredicate = async (generator: Generator): Promise<boolean> => {
			// eslint-disable-next-line no-plusplus
			const runId = runIdCounter++;
			const errors: Error[] = [];
			const testRunCoordinator = await testCoordinator.newRunCoordinator(generator);
			await runtime.isolateModulesAsync(async () => {
				outputsWaiter.reset();
				await moduleLoader.mockModules(preloads);

				let monitor: MockMonitor;
				programPulumi.runtime.setMocks({
					newResource(args: pulumi.runtime.MockResourceArgs) {
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
				monitor = programPulumi.runtime.getMonitor() as MockMonitor;

				const startRun = Date.now();
				await Promise.race([
					(async () => {
						await moduleLoader.execProgram().catch((error) => errors.push(error));
						errors.push(...(await outputsWaiter.isCompleted()));

						testRunCoordinator.validateDeployment(monitor.resources);
						await testRunCoordinator.isDone;
					})(),
					testRunCoordinator.isDone,
				]);

				errors.forEach((err) => ignoreUnhandledRejectionErrors.add(err));
				if (errors.length > 0)
					results.push({
						title: `run ${runId} (${errors.length} error${
							errors.length > 1 ? 's' : ''
						})`,
						duration: Date.now() - startRun,
						passedAsserts: 0,
						errors,
					});
				testRunCoordinator.fails.forEach((fail) => {
					results.push({
						title: `${fail.oracle.name} on ${
							fail.resource ? `${fail.resource.urn}` : 'deployment'
						} (run ${runId})`,
						duration: Date.now() - startRun,
						passedAsserts: 0,
						errors: [fail.error],
					});
				});
			});
			return errors.length === 0 && testRunCoordinator.fails.length === 0;
		};
		await fc.check(
			fc.asyncProperty(await testCoordinator.arbitrary, testPredicate),
			proti.testRunner as fc.Parameters<Generator[]>
		);

		// Wait for async code to settle
		if (proti.testRunner.waitTick) await new Promise(process.nextTick);
	} catch (e) {
		results.push({
			title: 'ProTI test runner failed',
			duration: Date.now() - start,
			passedAsserts: 0,
			errors: [e as Error],
		});
	}

	const end = Date.now();

	return toTestResult({ testPath, start, end, results });
};

export default testRunner;
