import type { JestEnvironment } from '@jest/environment';
import { jestExpect } from '@jest/expect';
import { TestResult } from '@jest/test-result';
import type { Config } from '@jest/types';
import { readPulumiProject } from '@proti/core';
import { IHasteFS } from 'jest-haste-map';
import Runtime from 'jest-runtime';
import * as Resolver from 'jest-resolve';
import { DependencyResolver } from 'jest-resolve-dependencies';
import { buildSnapshotResolver } from 'jest-snapshot';

type RunResult = {
	title: string;
	duration?: number;
	passedAsserts: number;
	errors: Error[];
};
type AppendRunResult = (result: RunResult) => void;

type RunnerState = {
	testPath: string;
	start: number;
	end: number;
	runResults: RunResult[];
};

const hasFailed = (result: RunResult): boolean => result.errors.length > 0;

const toErrorMessage = (error: Error): string => (error.stack ? error.stack : error.message);

const toFailureMessage = (result: RunResult, id: number): string =>
	`${'#'.repeat(80)}\n# 🐞 ${id}: ${result.title}\n\n${result.errors
		.map(toErrorMessage)
		.join('\n\n')}`;

const toTestResult = (state: RunnerState): TestResult => {
	const failures = state.runResults.filter(hasFailed);
	return {
		failureMessage:
			failures.length === 0
				? null
				: `ProTI found ${'🐞'.repeat(failures.length)}\n\n${failures
						.map(toFailureMessage)
						.join('\n\n')}`,
		leaks: false,
		numFailingTests: failures.length,
		numPassingTests: state.runResults.filter(
			(r) => r.duration !== undefined && r.errors.length === 0
		).length,
		numPendingTests: state.runResults.filter((r) => r.duration === undefined).length,
		numTodoTests: 0,
		openHandles: [],
		perfStats: {
			end: new Date(state.end).getTime(),
			runtime: state.end - state.start,
			slow: false,
			start: new Date(state.start).getTime(),
		},
		skipped: false,
		snapshot: {
			added: 0,
			fileDeleted: false,
			matched: 0,
			unchecked: 0,
			uncheckedKeys: [],
			unmatched: 0,
			updated: 0,
		},
		testFilePath: state.testPath,
		testResults: state.runResults.map((result) => ({
			ancestorTitles: [],
			duration: result.duration,
			failureDetails: [],
			failureMessages: result.errors.map(toErrorMessage),
			fullName: `${state.testPath}#${result.title}`,
			numPassingAsserts: result.passedAsserts,
			status: result.duration === undefined || hasFailed(result) ? 'failed' : 'passed',
			title: result.title,
		})),
	};
};

const isHasteFS = (object: any): object is IHasteFS =>
	typeof object === 'object' &&
	// eslint-disable-next-line no-underscore-dangle
	typeof object?._rootDir === 'string' &&
	// eslint-disable-next-line no-underscore-dangle
	(object?._files instanceof Map || typeof object?._files === 'object');

const isResolver = (object: any): object is Resolver.default =>
	typeof object === 'object' &&
	// eslint-disable-next-line no-underscore-dangle
	typeof object?._moduleMap === 'object' &&
	// eslint-disable-next-line no-underscore-dangle
	(object?._moduleIDCache instanceof Map || typeof object?._moduleIDCache === 'object') &&
	// eslint-disable-next-line no-underscore-dangle
	(object?._modulePathCache instanceof Map || typeof object?._modulePathCache === 'object');

const doAndAppendRunResult = async <T>(
	title: string,
	fn: () => Promise<T>,
	appendResult: AppendRunResult
): Promise<T> => {
	const start = Date.now();
	const result = (partialResult: Partial<RunResult>): void =>
		appendResult({
			title,
			duration: Date.now() - start,
			passedAsserts: 0,
			errors: [],
			...partialResult,
		});
	const resultVal = fn();
	resultVal
		.then(() => result({ passedAsserts: 1 }))
		.catch((e) => result({ errors: [e as Error] }));
	return resultVal;
};

const getResolverGlobals = async (
	globals: Config.ConfigGlobals
): Promise<[Resolver.default, IHasteFS]> => {
	if (!isResolver(globals?.resolver))
		throw Error(
			'No Resolver available in config.globals.resolver. ' +
				'Are you using the @proti/runner runner?\n' +
				`Received ${JSON.stringify(globals?.resolver)}`
		);
	if (!isHasteFS(globals?.hasteFS))
		throw Error(
			'No HasteFS available in config.globals.hasteFS. ' +
				'Are you using the @proti/runner runner?\n' +
				`Received ${JSON.stringify(globals?.hasteFS)}`
		);
	return [globals?.resolver, globals?.hasteFS];
};

const testRunner = async (
	globalConfig: Config.GlobalConfig,
	config: Config.ProjectConfig,
	environment: JestEnvironment,
	runtime: Runtime,
	testPath: string
): Promise<TestResult> => {
	const start = Date.now();
	const runResults: RunResult[] = [];
	const appendResult: AppendRunResult = (result) => runResults.push(result);

	try {
		const [resolver, hasteFS] = await doAndAppendRunResult(
			'Get resolver globals',
			() => getResolverGlobals(config.globals),
			appendResult
		);
		const pulumiProject = await doAndAppendRunResult(
			'Read Pulumi.yaml',
			() => readPulumiProject(testPath),
			appendResult
		);
		const dependencyResolver = new DependencyResolver(
			resolver,
			hasteFS,
			await buildSnapshotResolver(config)
		);
		if (pulumiProject) {
			if (config.injectGlobals) {
				const globals = {
					expect: jestExpect,
				};
				Object.assign(environment.global, globals);
			}

			// // console.log(config.globals.hasteFS);
			// // console.log(pulumiProject.main);
			// // console.log(
			// // 	await (config.globals.resolver as Resolver.default).resolveModuleFromDirIfExistsAsync(
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
		}
	} catch (e) {
		/* empty */
	}

	// random seed
	// options.globalConfig.seed

	const end = Date.now();

	return toTestResult({ testPath, start, end, runResults });
};

export default testRunner;
