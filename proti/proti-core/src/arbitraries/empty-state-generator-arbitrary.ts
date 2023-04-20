import * as fc from 'fast-check';
import { Generator, ResourceOutput } from '../generator';
import { ResourceOracleArgs } from '../oracle';

export default fc.constant<Generator>({
	generateResourceOutput(resource: ResourceOracleArgs): ResourceOutput {
		return {
			id: resource.urn,
			state: {},
		};
	},
});
