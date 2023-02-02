import type { JestEnvironment } from '@jest/environment';
import { jestExpect } from '@jest/expect';
import { TestResult } from '@jest/test-result';
import type { Config } from '@jest/types';
import { IHasteFS } from 'jest-haste-map';
import Runtime from 'jest-runtime';
import * as Resolver from 'jest-resolve';
import { DependencyResolver } from 'jest-resolve-dependencies';
import { buildSnapshotResolver } from 'jest-snapshot';

import {
	Config as ProtiConfig,
	isConfig,
	isHasteFS,
	isResolver,
	readPulumiProject,
} from '@proti/core';

import { RunResult, toTestResult } from './test-result';

const onErrorThrow = <T>(errorMsg: string, action: Promise<T>) =>
	action.catch<T>((cause) => Promise.reject(new Error(errorMsg, { cause })));

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
		const resultVal = onErrorThrow(`Failed to ${title}`, test);
		resultVal
			.then(() => result({ passedAsserts: 1 }))
			.catch((e) => result({ errors: [e as Error] }));
		return resultVal;
	};

const getGlobals = async (
	globals: Config.ConfigGlobals
): Promise<[ProtiConfig, Resolver.default, IHasteFS]> => {
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

const resolveModuleFromPath = async (
	resolver: Resolver.default,
	path: string,
	module: string
): Promise<string> =>
	resolver
		.resolveModuleAsync(path, module)
		.catch(() => resolver.resolveModuleFromDirIfExists(path, module))
		.then(
			(resolvedPath: string | null): Promise<string> =>
				resolvedPath === null
					? Promise.reject(new Error(`Module ${module} resolved to null in ${path}`))
					: Promise.resolve(resolvedPath)
		)
		.catch((e) =>
			Promise.reject(new Error(`Failed to resolve ${module} from path ${path}`, { cause: e }))
		);

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
		const [proti, resolver, hasteFS] = await onErrorThrow(
			'Failed to get configuration from globals',
			getGlobals(config.globals)
		);
		const pulumiProject = await runTest('Read Pulumi.yaml', readPulumiProject(testPath));

		const snapshotResolver = await buildSnapshotResolver(config);
		const dependencyResolver = new DependencyResolver(resolver, hasteFS, snapshotResolver);

		if (config.injectGlobals) {
			const globals = {
				expect: jestExpect,
			};
			Object.assign(environment.global, globals);
		}

		const pulumiProgram = await onErrorThrow(
			`Failed to find Pulumi program with main ${pulumiProject.main}`,
			resolveModuleFromPath(resolver, pulumiProject.main, '.')
		);
			// // 		pulumiProject.main,
			// // 		'.'
			// // 	)
			// // );
			// // // console.log((config.globals.resolver as Resolver.default).resolveModuleFromDirIfExists(pulumiProject.main + '/Pulumi.yaml', '.'));
			// console.log(
			// 	(config.globals.resolver as Resolver.default).resolveModule(
			// 		`${pulumiProject.main}/index.ts`,
			// 		'.'
			// 	)
			// );
			// console.log(dependencyResolver.resolve(`${pulumiProject.main}/Pulumi.yaml`));
			// Run test subject in `environment`
			// runtime.requireModule('./src/a.ts');
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
