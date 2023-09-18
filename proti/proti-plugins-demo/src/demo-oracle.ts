import type { ResourceOracle, ResourceArgs, TestResult, TestModuleInitFn } from '@proti/core';
import { config } from './config';

/**
 * Simple {@link ResourceOracle} checking that all resource URNs are unique.
 */
export class DemoOracle implements ResourceOracle<Set<string>> {
	name = 'Demo Oracle';

	description = 'Checks that the URNs of all resources are not duplicated';

	private static conf = config();

	// eslint-disable-next-line class-methods-use-this
	newRunState = () => new Set<string>();

	// eslint-disable-next-line class-methods-use-this
	validateResource = (resource: ResourceArgs, urns: Set<string>): TestResult => {
		// Access plugin configuration value
		const id = DemoOracle.conf.demoId;
		if (urns.has(resource.urn))
			return new Error(`Duplicated definition of resource ${resource.urn} found by ${id}`);
		urns.add(resource.urn);
		return undefined;
	};
}

export default DemoOracle;

/**
 * Initialization method called when the oracle is loaded.
 */
export const init: TestModuleInitFn = async () => {};
