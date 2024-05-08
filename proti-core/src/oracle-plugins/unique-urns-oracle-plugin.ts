import type { ResourceOracle, ResourceArgs, TestResult } from '../oracle';

export class UniqueUrnsOraclePlugin implements ResourceOracle<Set<string>> {
	readonly name = 'Unique URNs';

	readonly description = 'Checks that the URNs of all resources are not duplicated';

	// eslint-disable-next-line class-methods-use-this
	readonly newRunState = () => new Set<string>();

	// eslint-disable-next-line class-methods-use-this
	readonly validateResource = (resource: ResourceArgs, urns: Set<string>): TestResult => {
		if (urns.has(resource.urn))
			return new Error(`Duplicated definition of resource ${resource.urn}`);
		urns.add(resource.urn);
		return undefined;
	};
}
export default UniqueUrnsOraclePlugin;
