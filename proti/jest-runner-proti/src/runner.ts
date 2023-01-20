import { TestResult } from '@jest/test-result';
import { RunTest } from 'create-jest-runner';

type RunResult = {
	title: string;
	duration?: number;
	passedAsserts: number;
	errorMessages: string[];
};

type RunnerState = {
	testPath: string;
	start: number;
	end: number;
	runResults: RunResult[];
};

const toTestResult = (state: RunnerState): TestResult => {
	const failures = state.runResults.filter((r) => r.errorMessages.length > 0).length;
	return {
		failureMessage: failures === 0 ? null : 'ProTI found 🐞',
		leaks: false,
		numFailingTests: failures,
		numPassingTests: state.runResults.filter(
			(r) => r.duration !== undefined && r.errorMessages.length === 0
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
			failureMessages: result.errorMessages,
			fullName: `${state.testPath}#${result.title}`,
			numPassingAsserts: result.passedAsserts,
			status:
				result.duration === undefined || result.errorMessages.length > 0
					? 'failed'
					: 'passed',
			title: result.title,
		})),
	};
};

const run: RunTest<{}> = (options) => {
	const { testPath } = options;
	const start = Date.now();
	const end = Date.now();
	const runResults: RunResult[] = [
		{
			title: 'test',
			duration: 0,
			passedAsserts: 1,
			errorMessages: [],
		},
	];

	return toTestResult({ testPath, start, end, runResults });
};

export default run;
