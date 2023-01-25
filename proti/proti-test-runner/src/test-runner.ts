import type { JestEnvironment } from '@jest/environment';
import { TestResult } from '@jest/test-result';
import type { Config } from '@jest/types';
import type Runtime from 'jest-runtime';
import { PulumiProject, readPulumiProject } from '@proti/core';

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

const readPulumiYaml = (
	pulumiYaml: string,
	start: number,
	appendResult: AppendRunResult
): Promise<PulumiProject> => {
	const result = (partialResult: Partial<RunResult>): void =>
		appendResult({
			title: 'Read Pulumi.yaml',
			duration: Date.now() - start,
			passedAsserts: 0,
			errors: [],
			...partialResult,
		});
	const pulumiProject = readPulumiProject(pulumiYaml);
	pulumiProject.then(() => result({ passedAsserts: 1 }));
	pulumiProject.catch((e) => result({ errors: [e as Error] }));
	return pulumiProject;
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

	await readPulumiYaml(testPath, start, appendResult);

	// random seed
	// options.globalConfig.seed

	const end = Date.now();

	return toTestResult({ testPath, start, end, runResults });
};

export default testRunner;
