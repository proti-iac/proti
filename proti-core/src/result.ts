import type { RunDetailsCommon } from 'fast-check';
import type { DeepReadonly } from './utils';

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
