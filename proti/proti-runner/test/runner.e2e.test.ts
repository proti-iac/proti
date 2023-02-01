import * as cp from 'child_process';
import * as path from 'path';

const runner = path.resolve(__dirname, '..');
const tests = path.resolve(__dirname, 'e2e-tests');
const jestCmd = (test: string) =>
	`yarn jest --silent --runner ${runner} --testMatch '**/${test}-test.ts' --selectProjects proti-core --rootDir ${tests}`;

describe('runner', () => {
	it('should run', () => expect(() => cp.execSync(jestCmd('success'))).not.toThrow());

	it.each([
		['hasteFS', 'hastefs-global'],
		['resolver', 'resolver-global'],
		['default config', 'config'],
	])('should inject %s into global', (_, testFile) =>
		expect(() => cp.execSync(jestCmd(testFile))).not.toThrow()
	);

	// @TODO: This is technical debt and should be fixed! Seems like resolver is not serialized for jest worker.
	it('should fail on injecting hasteFS and resolver into global if run in parallel', () =>
		expect(() => cp.execSync(jestCmd('*global'))).toThrow());

	it('should inject config with user config into global', () => {
		const conf = ` --globals '${JSON.stringify({
			proti: { moduleLoading: { preload: ['user-defined'] } },
		})}'`;
		expect(() => cp.execSync(jestCmd('config-user') + conf)).not.toThrow();
	});

	it('should fail on invalid user config', () => {
		const conf = ` --globals '${JSON.stringify({
			proti: { moduleLoading: { preload: false } },
		})}'`;
		expect(() => cp.execSync(jestCmd('success') + conf)).toThrow();
	});
});
