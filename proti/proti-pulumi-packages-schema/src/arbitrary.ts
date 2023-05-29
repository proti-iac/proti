import * as fc from 'fast-check';
import type { Generator, ResourceOracleArgs, ResourceOutput, TestModuleInitFn } from '@proti/core';
import { initModule } from './utils';

// @TODO implement
export default fc.constant<Generator>({
	async generateResourceOutput(resource: ResourceOracleArgs): Promise<ResourceOutput> {
		return {
			id: resource.urn,
			state: {},
		};
	},
});

export const init: TestModuleInitFn = initModule;
