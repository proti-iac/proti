import * as fc from 'fast-check';
import type { Generator, ResourceOutput } from '../../src/generator';
import type { ResourceOracleArgs } from '../../src/oracle';
import type { TestModuleConfig, TestModuleInitFn } from '../../src/test-coordinator';

export default fc.constant<Generator>({
	generateResourceOutput(resource: ResourceOracleArgs): ResourceOutput {
		return {
			id: resource.urn,
			state: {},
		};
	},
});

// eslint-disable-next-line import/no-mutable-exports
export let config: TestModuleConfig;
export const init: TestModuleInitFn = async (testModuleConfig) => {
	config = testModuleConfig;
};
