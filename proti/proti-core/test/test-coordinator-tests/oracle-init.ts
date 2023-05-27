import type { ResourceOracle, TestResult } from '../../src/oracle';
import type { TestModuleConfig, TestModuleInitFn } from '../../src/test-coordinator';

class Oracle implements ResourceOracle {
	name = 'Test';

	description = 'Test';

	// eslint-disable-next-line class-methods-use-this
	validateResource = (): TestResult => undefined;
}

export default Oracle;

// eslint-disable-next-line import/no-mutable-exports
export let config: TestModuleConfig;
export const init: TestModuleInitFn = async (testModuleConfig) => {
	config = testModuleConfig;
};
