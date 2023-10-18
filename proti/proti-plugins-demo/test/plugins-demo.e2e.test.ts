import type { Config, DeepPartial } from '@proti-iac/core';
import * as cp from 'child_process';
import * as path from 'path';

const protiConfig: DeepPartial<Config> = {
	testRunner: { numRuns: 2 },
	testCoordinator: {
		arbitrary: path.resolve(__dirname, '../bin/demo-arbitrary'),
		oracles: [path.resolve(__dirname, '../bin/demo-oracle')],
	},
};
const jestCmd = (...projects: string[]): string =>
	`yarn jest --silent -c "${JSON.stringify({
		preset: '@proti-iac/test-runner',
		globals: { proti: protiConfig },
	}).replaceAll('"', '\\"')}" ${projects
		.map((p) => `--roots ${path.resolve(__dirname, p)}`)
		.join(' ')}`;

describe('plugins demo', () => {
	it('should run', () =>
		expect(() =>
			cp.execSync(jestCmd('../../examples/s3-website/flat')).toString()
		).not.toThrow());

	it('should fail', () => {
		expect(() => cp.execSync(jestCmd('abc'))).toThrow('Command failed');
	});
});
