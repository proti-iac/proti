import type { JestEnvironment } from '@jest/environment';
import { jestExpect } from '@jest/expect';
import type { TestResult } from '@jest/test-result';
import type { Config } from '@jest/types';
import type { IHasteFS } from 'jest-haste-map';
import type Runtime from 'jest-runtime';
import type Resolver from 'jest-resolve';
import type pulumi from '@pulumi/pulumi';

import {
	Config as ProtiConfig,
	errMsg,
	isConfig,
	isHasteFS,
	isResolver,
	ModuleLoader,
	readPulumiProject,
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

		const preloads = await runTest('Preload modules', moduleLoader.preload());
		if (!preloads.has('@pulumi/pulumi')) throw new Error('Did not to preload @pulumi/pulumi');
		const programPulumi = preloads.get('@pulumi/pulumi') as typeof pulumi;

		const test = async () => {
			await runtime.isolateModulesAsync(async () => {
				await moduleLoader.mockModules(preloads);
				programPulumi.runtime.setMocks({
					newResource(args: pulumi.runtime.MockResourceArgs): {
						id: string;
						state: any;
					} {
						return {
							id: '',
							state: {}, // ...args.inputs, versioning: { enabled: true }, bucket: null },
						};
					},
					call(args: pulumi.runtime.MockCallArgs) {
						return args.inputs;
					},
				});
				await moduleLoader.loadProgram();
			});
		};
		for (let i = 0; i < proti.testRunner.numRuns; i += 1)
			// eslint-disable-next-line no-await-in-loop
			await runTest(`Test ${i}`, test());

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
