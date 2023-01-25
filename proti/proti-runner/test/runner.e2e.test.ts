import * as cp from 'child_process';
import * as path from 'path';

const runner = path.resolve(__dirname, '..');
const tests = path.resolve(__dirname, 'e2e-tests');
const jestCmd = (test: string) =>
	`yarn jest --silent --runner ${runner} --testMatch **/${test}-test.ts --rootDir ${tests}`;

describe('runner', () => {
	it('should run', () => expect(cp.execSync(jestCmd('success')).toString()).toBe(''));

	it('should inject hasteFS global', () =>
		expect(cp.execSync(jestCmd('hastefs-global')).toString()).toBe(''));

	it('should inject resolver global', () =>
		expect(cp.execSync(jestCmd('resolver-global')).toString()).toBe(''));
});
