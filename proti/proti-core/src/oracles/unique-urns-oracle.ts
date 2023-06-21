import type { ResourceOracle, ResourceArgs, TestResult } from '../oracle';

export class UniqueUrnsOracle implements ResourceOracle<Set<string>> {
	name = 'Unique URNs';

	description = 'Checks that the URNs of all resources are not duplicated';

	// eslint-disable-next-line class-methods-use-this
	newRunState = () => new Set<string>();

	// eslint-disable-next-line class-methods-use-this
	validateResource = (resource: ResourceArgs, urns: Set<string>): TestResult => {
		if (urns.has(resource.urn))
			return new Error(`Duplicated definition of resource ${resource.urn}`);
		urns.add(resource.urn);
		return undefined;
	};
}

export default UniqueUrnsOracle;
