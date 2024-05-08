import * as cp from 'child_process';
import path from 'path';
import type { Config, DeepPartial } from '@proti-iac/core';
import { jestCmd } from './util';

describe('runner plugin lifecycle hooks spec end-to-end', () => {
	const project = '../../examples/s3-website/flat';
	const protiConfig: DeepPartial<Config> = {
		testRunner: { numRuns: 2 },
		testCoordinator: { oracles: [path.resolve(__dirname, './test-runner-test-plugin.js')] },
	};
	const jestConfig = { globals: { proti: protiConfig } };

	it('should invoke all lifecycle hooks', () => {
		expect(cp.execSync(jestCmd([project], jestConfig)).toString()).toBe(`TEST_PLUGIN: init
TEST_PLUGIN: constructor
TEST_PLUGIN: newRunState
TEST_PLUGIN: validateResource
TEST_PLUGIN: validateResource
TEST_PLUGIN: validateResource
TEST_PLUGIN: validateResource
TEST_PLUGIN: validateResource
TEST_PLUGIN: newRunState
TEST_PLUGIN: validateResource
TEST_PLUGIN: validateResource
TEST_PLUGIN: validateResource
TEST_PLUGIN: validateResource
TEST_PLUGIN: validateResource
TEST_PLUGIN: shutdown
`);
	});
});
