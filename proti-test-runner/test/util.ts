import type { Config, DeepPartial, TestRunnerConfig } from '@proti-iac/core';
import * as path from 'path';

const protiConfig = path.resolve(__dirname, '..');
export const jestCmd = (
	projects: string[],
	jestConfig: object = {},
	runnerConfig: DeepPartial<TestRunnerConfig> = {}
): string =>
	`yarn jest --silent -c "${JSON.stringify({
		preset: protiConfig,
		globals: { proti: { testRunner: { numRuns: 2, ...runnerConfig } } as Config },
		...jestConfig,
	}).replaceAll('"', '\\"')}" ${projects
		.map((p) => `--roots ${path.resolve(__dirname, p)}`)
		.join(' ')}`;
