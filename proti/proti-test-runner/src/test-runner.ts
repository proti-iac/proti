import type { JestEnvironment } from '@jest/environment';
import { jestExpect } from '@jest/expect';
import type { TestResult } from '@jest/test-result';
import type { Config } from '@jest/types';
import type { IHasteFS } from 'jest-haste-map';
import type Runtime from 'jest-runtime';
import type Resolver from 'jest-resolve';
import type pulumi from '@pulumi/pulumi';
import type { Output } from '@pulumi/pulumi';
import type pulumiOutput from '@pulumi/pulumi/output';
import type { MockMonitor } from '@pulumi/pulumi/runtime/mocks';

import {
	Config as ProtiConfig,
	errMsg,
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
		(programPulumiOutput.Output as any) = interceptConstructor(
			programPulumiOutput.Output as unknown as { new (...v: any[]): Output<any> },
			(output) => outputsWaiter.wait((output as any).promise())
		);

		const testCoordinator = new TestCoordinator(proti.testCoordinator);
		await testCoordinator.isReady; // Required to ensure all test classes are loaded before first test run

		const test = async (runId: number): Promise<boolean> => {
			const testRunCoordinator = testCoordinator.newRunCoordinator();
			await runtime.isolateModulesAsync(async () => {
				outputsWaiter.reset();
				await moduleLoader.mockModules(preloads);

				let monitor: MockMonitor;
				programPulumi.runtime.setMocks({
					newResource(args: pulumi.runtime.MockResourceArgs): {
						id: string;
						state: any;
					} {
						testRunCoordinator.validateResource({
							urn: (monitor as any).newUrn(undefined, args.type, args.name),
							...args,
						});

						return {
							id: '',
							state: {}, // ...args.inputs, versioning: { enabled: true }, bucket: null },
						};
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
						await moduleLoader.execProgram();
						await outputsWaiter.isCompleted();
						testRunCoordinator.validateDeployment(monitor.resources);
						await testRunCoordinator.isDone;
					})(),
					testRunCoordinator.isDone,
				]);

				testRunCoordinator.fails.forEach((fail) => {
					results.push({
						title: `${fail.test.testName} on ${
							fail.resource ? `${fail.resource.urn}` : 'deployment'
						} (run ${runId})`,
						duration: Date.now() - startRun,
						passedAsserts: 0,
						errors: [fail.error],
					});
				});
			});
			return testRunCoordinator.fails.length === 0;
		};
		for (let i = 0; i < proti.testRunner.numRuns; i += 1)
			// eslint-disable-next-line no-await-in-loop
			if (!(await test(i)) && proti.testCoordinator.failFast) break;

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

	// random seed
	// options.globalConfig.seed

	const end = Date.now();

	return toTestResult({ testPath, start, end, results });
};

export default testRunner;
