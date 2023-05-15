import * as fc from 'fast-check';
import type { Generator, ResourceOracleArgs, ResourceOutput } from '@proti/core';

// @TODO implement
export default fc.constant<Generator>({
	generateResourceOutput(resource: ResourceOracleArgs): ResourceOutput {
		return {
			id: resource.urn,
			state: {},
		};
	},
});
