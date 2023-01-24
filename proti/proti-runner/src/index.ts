import * as TestRunner from 'jest-runner';

import type { TestWatcher } from 'jest-watcher';
import type { TestRunnerOptions } from 'jest-runner';
import type { Test } from '@jest/test-result';

export * from 'jest-runner';

class ProtiTestRunner extends TestRunner.default {
	async runTests(
		tests: Array<Test>,
		watcher: TestWatcher,
		options: TestRunnerOptions
	): Promise<void> {
		return super.runTests(
			tests.map((test) => {
				// eslint-disable-next-line no-param-reassign
				test.context.config.globals.haste = test.context.hasteFS;
				return test;
			}),
			watcher,
			options
		);
	}
}

export default ProtiTestRunner;
