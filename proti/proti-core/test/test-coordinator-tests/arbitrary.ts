import * as fc from 'fast-check';
import { Generator, ResourceOutput } from '../../src/generator';
import { ResourceOracleArgs } from '../../src/oracle';

export default fc.constant<Generator>({
	generateResourceOutput(resource: ResourceOracleArgs): ResourceOutput {
		return {
			id: resource.urn,
			state: {},
		};
	},
});
