import type { Config, DeepPartial } from '@proti/core';
import * as cp from 'child_process';
import * as path from 'path';

const protiConfig: DeepPartial<Config> = {
	testRunner: { numRuns: 2 },
	testCoordinator: {
		arbitrary: path.resolve(__dirname, '../bin/arbitrary'),
		oracles: ['@proti/core/unique-urns-oracle', path.resolve(__dirname, '../bin/oracle')],
	},
};
const jestCmd = (...projects: string[]): string =>
	`yarn jest --silent -c "${JSON.stringify({
		preset: '@proti/test-runner',
		globals: { proti: protiConfig },
	}).replaceAll('"', '\\"')}" ${projects
		.map((p) => `--roots ${path.resolve(__dirname, p)}`)
		.join(' ')}`;
const execConf = { maxBuffer: 10 * 1024 * 1024 /* 10MB */ };

describe('pulumi packags schema end-to-end', () => {
	it.each(['../../../examples/s3-website/flat', '../../../examples/s3-website/cb-dependent'])(
		'should run on %s',
		(project) => expect(() => cp.execSync(jestCmd(project), execConf).toString()).not.toThrow()
	);

	it.each([
		'abc',
		'../../../examples/s3-website/invalid',
		'../../../examples/s3-website/flat-throws',
	])('should fail on %s', (project) => {
		expect(() => cp.execSync(jestCmd(project), execConf)).toThrow('Command failed');
	});
});
