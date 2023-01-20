import * as cp from 'child_process';
import * as path from 'path';

const protiConfig = path.resolve(__dirname, '../proti.config.ts');
const jestCmd = (...projects: string[]): string =>
	`yarn jest --silent -c ${protiConfig} ${projects
		.map((p) => `--roots ${path.resolve(__dirname, p)}`)
		.join(' ')}`;

describe('runner end-to-end', () => {
	it.each(['../../../examples/s3-website/flat', '../../../examples/s3-website/flat-redirect'])(
		'should run on %s',
		(project) => expect(cp.execSync(jestCmd(project)).toString()).toBe('')
	);

	it.each(['abc'])(
		// '../../../examples/s3-website/flat-throws',])( Not implemented yet, but flat-throws should fail!
		'should run fail on %s',
		(project) => {
			expect(() => cp.execSync(jestCmd(project))).toThrow('Command failed');
		}
	);
});
