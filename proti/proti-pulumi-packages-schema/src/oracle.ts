import type { ResourceOracle, ResourceArgs, TestModuleInitFn, TestResult } from '@proti/core';
import { initModule } from './utils';

class PulumiPackagesSchemaOracle implements ResourceOracle {
	name = 'Pulumi Packages Schema Types';

	description =
		'Checks that each resource configuration satisfies the type defined in the Pulumi package schema.';

	// eslint-disable-next-line @typescript-eslint/no-unused-vars, class-methods-use-this
	validateResource = (resource: ResourceArgs): TestResult => undefined; // @TODO implement
}

export default PulumiPackagesSchemaOracle;

export const init: TestModuleInitFn = initModule;
