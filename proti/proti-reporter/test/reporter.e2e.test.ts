import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { reportDir } from '../src/reporter';

const reporter = path.resolve(__dirname, '..');
const tests = path.resolve(__dirname, 'e2e-tests');
const jestCmd = (test: string) =>
	`yarn jest --silent --reporters '${reporter}' --testMatch '**/${test}-test.ts' --selectProjects proti-reporter --rootDir ${tests}`;

describe('reporter', () => {
	it('should run', () => expect(() => cp.execSync(jestCmd('success'))).not.toThrow());
	it('should fail', () => expect(() => cp.execSync(jestCmd('error'))).toThrow());

	afterAll(() => {
		fs.rmSync(reportDir, { recursive: true });
	});
});
