import { OutputGenerator, ResourceOutput } from '../output-generator';
import { ResourceTestArgs } from '../tests';

export default class extends OutputGenerator {
	// eslint-disable-next-line class-methods-use-this
	public generateResourceOutput(runId: number, resource: ResourceTestArgs): ResourceOutput {
		return {
			id: resource.urn,
			state: {},
		};
	}
}
