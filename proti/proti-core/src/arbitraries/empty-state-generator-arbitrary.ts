import * as fc from 'fast-check';
import { Generator, ResourceOutput } from '../generator';
import { ResourceOracleArgs } from '../oracle';

export default fc.constant<Generator>({
	async generateResourceOutput(resource: ResourceOracleArgs): Promise<ResourceOutput> {
		return {
			id: resource.urn,
			state: {},
		};
	},
});
