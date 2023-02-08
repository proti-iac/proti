import type { TestResult } from '@jest/test-result';

export type RunResult = {
	title: string;
	duration?: number;
	passedAsserts: number;
	errors: Error[];
};

type RunnerState = {
	testPath: string;
	start: number;
	end: number;
	results: RunResult[];
};

const hasFailed = (result: RunResult): boolean => result.errors.length > 0;

const toErrorMessage = (error: Error): string =>
	(error.stack ? error.stack : error.message) +
	(error.cause instanceof Error || (error.cause as any)?.name === 'Error' // If error happened in other frame, instanceof Error is false
		? `\ncaused by ${toErrorMessage(error.cause as Error)}`
		: '');

const toFailureMessage = (result: RunResult, id: number): string =>
	`${'#'.repeat(80)}\n# 🐞 ${id}: ${result.title}\n\n${result.errors
		.map(toErrorMessage)
		.join('\n\n')}`;

export const toTestResult = (state: RunnerState): TestResult => {
	const failures = state.results.filter(hasFailed);
	return {
		failureMessage:
			failures.length === 0
				? null
				: `ProTI found ${'🐞'.repeat(failures.length)}\n\n${failures
						.map(toFailureMessage)
						.join('\n\n')}`,
		leaks: false,
		numFailingTests: failures.length,
		numPassingTests: state.results.filter(
			(r) => r.duration !== undefined && r.errors.length === 0
		).length,
		numPendingTests: state.results.filter((r) => r.duration === undefined).length,
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
		testResults: state.results.map((result) => ({
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
