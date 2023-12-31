import type { AssertionResult, TestResult } from '@jest/test-result';
import type { DeepReadonly } from '@proti-iac/core';
import type { RunDetailsCommon } from 'fast-check';

export type Result = DeepReadonly<{
	title: string;
	start: number;
	end: number;
	duration: number;
	errors: Error[];
}>;
export type SerializableResult = Omit<Result, 'errors'> & DeepReadonly<{ errors: string[] }>;

export type RunResult = Result &
	DeepReadonly<{
		generator: string;
	}>;
export type SerializableRunResult = Omit<RunResult, 'errors'> & DeepReadonly<{ errors: string[] }>;

export type CheckResult = DeepReadonly<
	Pick<
		RunDetailsCommon<unknown>,
		'failed' | 'interrupted' | 'numRuns' | 'numSkips' | 'numShrinks'
	> & {
		start: number;
		end: number;
		duration: number;
		runResults: RunResult[];
		report?: string;
	}
>;
export type SerializableCheckResult = Omit<CheckResult, 'runResults'> &
	DeepReadonly<{
		runResults: SerializableRunResult[];
	}>;

type RunnerResult = DeepReadonly<{
	testPath: string;
	start: number;
	end: number;
	accompanyingResults: Result[];
	checkResult?: CheckResult;
}>;

const hasFailed = (result: Result): boolean => result.errors.length > 0;

const toErrorMessage = (error: Error): string =>
	(error.stack ? error.stack : error.message) +
	(error.cause instanceof Error || (error.cause as any)?.name === 'Error' // If error happened in other frame, instanceof Error is false
		? `\ncaused by ${toErrorMessage(error.cause as Error)}`
		: '');

const toHeader = (headline: string): string => `${'#'.repeat(80)}\n# ${headline}\n\n`;

const toFailureMessage = (result: Result, id: number): string =>
	`${toHeader(`🐞 ${id}: ${result.title}`)}${result.errors.map(toErrorMessage).join('\n\n')}\n\n`;

export const toTestResult = (state: RunnerResult): DeepReadonly<TestResult> => {
	const accompanyingFailures = state.accompanyingResults.filter(hasFailed);
	const accompanyingSuccesses = state.accompanyingResults.filter((r) => !hasFailed(r));
	const checkResult: CheckResult = state.checkResult || {
		failed: true,
		interrupted: true,
		start: 0,
		end: 0,
		duration: 0,
		numRuns: 0,
		numShrinks: 0,
		numSkips: 0,
		report: '',
		runResults: [],
	};
	const serializableCheckResult: SerializableCheckResult = {
		...checkResult,
		runResults: checkResult.runResults.map((result) => ({
			...result,
			errors: result.errors.map(toErrorMessage),
		})),
	};
	const checkFailures = checkResult.runResults.filter(hasFailed);
	const checkErrors = checkFailures.reduce(
		(errors, result) => [...errors, ...result.errors],
		[] as Error[]
	);
	const failures = [...accompanyingFailures, ...checkFailures];
	return {
		failureMessage:
			accompanyingFailures.length === 0 && checkResult.failed === false
				? null
				: `ProTI found ${'🐞'.repeat(failures.length)}\n\n${failures
						.map(toFailureMessage)
						.join('\n\n')}${
						checkResult.report
							? toHeader('Check program report') + checkResult.report
							: ''
				  }`,
		leaks: false,
		numFailingTests: accompanyingFailures.length + (checkResult.failed ? 1 : 0),
		numPassingTests:
			accompanyingSuccesses.length +
			(state.checkResult // -1 on failure, beause numRuns contains failed run
				? state.checkResult.numRuns + (state.checkResult.failed ? -1 : 0)
				: 0),
		numPendingTests: 0,
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
		testResults: [
			...state.accompanyingResults.map((result) => ({
				ancestorTitles: [],
				duration: result.duration,
				failureDetails: [],
				failureMessages: result.errors.map(toErrorMessage),
				fullName: `${state.testPath}#${result.title}`,
				numPassingAsserts: 0,
				status: hasFailed(result) ? 'failed' : 'passed',
				title: result.title,
			})),
			{
				ancestorTitles: [],
				duration: checkResult.duration,
				failureDetails: [serializableCheckResult],
				failureMessages: [...checkErrors.map(toErrorMessage)],
				fullName: `${state.testPath}#Check program`,
				numPassingAsserts: 0,
				status: checkResult.failed ? 'failed' : 'passed',
				title: 'Check program',
			},
		] as DeepReadonly<AssertionResult[]>,
	};
};
