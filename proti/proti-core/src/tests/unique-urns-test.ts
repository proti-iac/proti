import { ResourceTest, ResourceTestArgs, TestResult } from '../tests';

class UniqueUrnsTest implements ResourceTest {
	testName = 'Unique URNs';

	description = 'Checks that the URNs of all resources are not duplicated';

	private urns: Set<string> = new Set();

	validateResource = (resource: ResourceTestArgs): TestResult => {
		if (this.urns.has(resource.urn))
			return new Error(`Duplicated definition of resource ${resource.urn}`);
		this.urns.add(resource.urn);
		return undefined;
	};
}

export default UniqueUrnsTest;
