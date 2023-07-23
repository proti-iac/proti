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

	it('should fail on non-existing project', () => {
		expect(() => cp.execSync(jestCmd(['abc']))).toThrow('Command failed:');
	});

	it('should fail transforming if main from Pulumi.yaml cannot be resolved', () => {
		let error: Error | undefined;
		try {
			cp.execSync(jestCmd(['../../../examples/s3-website/no-program']));
		} catch (e) {
			error = e as Error;
		}
		expect(error).toBeDefined();
		expect(error?.message).toMatch(/Error: Failed to Transform program/);
		expect(error?.message).toMatch(/Failed to resolve program from path/);
	});

	it.concurrent.each([
		'../../../examples/s3-website/invalid',
		'../../../examples/s3-website/flat-throws',
		'../../../examples/s3-website/flat-throws-async',
	])('should fail on %s', (project) => {
		expect(() => cp.execSync(jestCmd([project]))).toThrow('ProTI found');
	});

	it('should terminate examples/s3-website/non-terminating-async-open-handle', () => {
		const project = '../../../examples/s3-website/non-terminating-async-open-handle';
		const jestConfig = {
			/** If not set, open handles will prevent jest from terminating. */
			forceExit: true,
		};
		expect(() => cp.execSync(jestCmd([project], jestConfig)).toString()).not.toThrow();
	});

	it('should soft timeout examples/s3-website/non-terminating-async', () => {
		const project = '../../../examples/s3-website/non-terminating-async';
		const runnerConfig = {
			/** If not set, it will not timeout */
			timeout: 2000,
		};
		expect(() => cp.execSync(jestCmd([project], {}, runnerConfig))).toThrow('Property timeout');
	});

	it('should hard timeout examples/s3-website/non-terminating-deasync', () => {
		const project = '../../../examples/s3-website/non-terminating-deasync';
		const runnerConfig = {
			/** If not set, it will not timeout */
			timeout: 2000,
		};
		expect(() => cp.execSync(jestCmd([project], {}, runnerConfig))).toThrow(
			'ProTI failed with a hard timeout.'
		);
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
