import * as TestRunner from 'jest-runner';

import type { TestWatcher } from 'jest-watcher';
import type { TestRunnerOptions } from 'jest-runner';
import type { Test } from '@jest/test-result';

import { config } from '@proti/core';

export * from 'jest-runner';

class ProtiTestRunner extends TestRunner.default {
	async runTests(
		tests: Array<Test>,
		watcher: TestWatcher,
		options: TestRunnerOptions
	): Promise<void> {
		return super.runTests(
			tests.map((test) => {
				const { globals } = test.context.config;
				globals.proti = config(globals?.proti);
				globals.hasteFS = test.context.hasteFS;
				globals.resolver = test.context.resolver;
				return test;
			}),
			watcher,
			options
		);
	}
}

export default ProtiTestRunner;
