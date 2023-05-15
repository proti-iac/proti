import type { Config } from '@proti/core';
import * as cp from 'child_process';
import * as path from 'path';

const protiConfig = path.resolve(__dirname, '..');
const jestCmd = (...projects: string[]): string =>
	`yarn jest --silent -c "${JSON.stringify({
		preset: protiConfig,
		globals: { proti: { testRunner: { numRuns: 2 } } as Config },
	}).replaceAll('"', '\\"')}" ${projects
		.map((p) => `--roots ${path.resolve(__dirname, p)}`)
		.join(' ')}`;

describe('runner end-to-end', () => {
	it.each(['../../../examples/s3-website/flat', '../../../examples/s3-website/flat-redirect'])(
		'should run on %s',
		(project) => expect(() => cp.execSync(jestCmd(project)).toString()).not.toThrow()
	);

	it.each([
		'abc',
		'../../../examples/s3-website/invalid',
		'../../../examples/s3-website/flat-throws',
	])('should fail on %s', (project) => {
		expect(() => cp.execSync(jestCmd(project))).toThrow('Command failed');
	});
});
