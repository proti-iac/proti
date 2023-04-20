import { Generator, ResourceOutput } from '../generator';
import { ResourceOracleArgs } from '../oracle';

export default class extends Generator {
	// eslint-disable-next-line class-methods-use-this
	public generateResourceOutput(runId: number, resource: ResourceOracleArgs): ResourceOutput {
		return {
			id: resource.urn,
			state: {},
		};
	}
}
