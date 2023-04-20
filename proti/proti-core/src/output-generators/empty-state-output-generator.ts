import { OutputGenerator, ResourceOutput } from '../output-generator';
import { ResourceOracleArgs } from '../oracle';

export default class extends OutputGenerator {
	// eslint-disable-next-line class-methods-use-this
	public generateResourceOutput(runId: number, resource: ResourceOracleArgs): ResourceOutput {
		return {
			id: resource.urn,
			state: {},
		};
	}
}
