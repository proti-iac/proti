import { EmptyStateGeneratorArbitrary } from '../../src/arbitraries/empty-state-generator-arbitrary';
import type { TestModuleConfig, TestModuleInitFn } from '../../src/test-coordinator';

export default EmptyStateGeneratorArbitrary;

// eslint-disable-next-line import/no-mutable-exports
export let config: TestModuleConfig;
export const init: TestModuleInitFn = async (testModuleConfig) => {
	config = testModuleConfig;
};
