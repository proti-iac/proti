import { ResourceTest, ResourceTestArgs } from '../tests';

class UniqueUrnsTest extends ResourceTest {
	testName = 'Unique URNs';

	description = 'Checks that the URNs of all resources are not duplicated';

	private urns: Set<string> = new Set();

	validateResource = (resource: ResourceTestArgs): Error | undefined => {
		if (this.urns.has(resource.urn))
			return new Error(`Duplicated definition of resource ${resource.urn}`);
		this.urns.add(resource.urn);
		return undefined;
	};
}

export default UniqueUrnsTest;
