import type { ResourceOracle, TestResult } from '@proti-iac/core';

/**
 * Simple {@link ResourceOracle} emonstrating a ProTI plugin with an isolated Jest runtime.
 */
export class DemoIsolatedRuntimePlugin implements ResourceOracle<null> {
	name = 'Demo Isolated Runtime';

	description = 'An oracle plugin demonstrating a ProTI plugin with an isolated Jest runtime';

	// eslint-disable-next-line class-methods-use-this
	newRunState = () => null;

	// eslint-disable-next-line class-methods-use-this
	validateResource = (): TestResult => undefined;
}
export default DemoIsolatedRuntimePlugin;
