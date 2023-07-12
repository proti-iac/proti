import type { Config, TestRunnerConfig } from '@proti/core';
import * as cp from 'child_process';
import * as path from 'path';

const protiConfig = path.resolve(__dirname, '..');
const jestCmd = (
	projects: string[],
	jestConfig: object = {},
	runnerConfig: TestRunnerConfig = {}
): string =>
	`yarn jest --silent -c "${JSON.stringify({
		preset: protiConfig,
		globals: { proti: { testRunner: { numRuns: 2, ...runnerConfig } } as Config },
		...jestConfig,
	}).replaceAll('"', '\\"')}" ${projects
		.map((p) => `--roots ${path.resolve(__dirname, p)}`)
		.join(' ')}`;

describe('runner end-to-end', () => {
	it.concurrent.each(['../../../examples/s3-website/flat'])('should run on %s', (project) =>
		expect(() => cp.execSync(jestCmd([project])).toString()).not.toThrow()
	);

	it.concurrent.each([
		'abc',
		'../../../examples/s3-website/invalid',
		'../../../examples/s3-website/flat-throws',
	])('should fail on %s', (project) => {
		expect(() => cp.execSync(jestCmd([project]))).toThrow('Command failed');
	});

	it('should terminate examples/s3-website/non-terminating-async-open-handle', () => {
		const project = '../../../examples/s3-website/non-terminating-async-open-handle';
		const jestConfig = {
			/** If not set, open handles will prevent jest from terminating. */
			forceExit: true,
		};
		expect(() => cp.execSync(jestCmd([project], jestConfig)).toString()).not.toThrow();
	});

	it('should timeout examples/s3-website/non-terminating-async', () => {
		const project = '../../../examples/s3-website/non-terminating-async';
		const runnerConfig = {
			/** If not set, it will not timeout */
			timeout: 2000,
		};
		expect(() => cp.execSync(jestCmd([project], {}, runnerConfig))).toThrow('Property timeout');
	});

	/* Does not work because it blocks event loop */
	// it('should timeout examples/s3-website/non-terminating-sync', () => {
	// 	const project = '../../../examples/s3-website/non-terminating-sync';
	// 	const jestConfig = {
	// 		/** If not set, it will not timeout */
	// 		timeout: 2000,
	// 	};
	// 	expect(() => cp.execSync(jestCmd([project], jestConfig))).toThrow('Command failed');
	// });
});
