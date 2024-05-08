import type {
	ResourceArgs,
	ResourceOracle,
	PluginInitFn,
	PluginShutdownFn,
	PluginWithInitFn,
	PluginWithShutdownFn,
	TestResult,
} from '@proti-iac/core';
import { config } from './config';

/**
 * Simple {@link OraclePlugin} checking that all resource URNs are unique.
 */
export class DemoOraclePlugin
	implements ResourceOracle<Set<string>>, PluginWithInitFn, PluginWithShutdownFn
{
	readonly name = 'Demo Oracle';

	readonly description = 'Checks that the URNs of all resources are not duplicated';

	private static conf = config();

	// eslint-disable-next-line class-methods-use-this
	readonly newRunState = () => new Set<string>();

	// eslint-disable-next-line class-methods-use-this
	readonly validateResource = (resource: ResourceArgs, urns: Set<string>): TestResult => {
		// Access plugin configuration value
		const id = DemoOraclePlugin.conf.demoId;
		if (urns.has(resource.urn))
			return new Error(`Duplicated definition of resource ${resource.urn} found by ${id}`);
		urns.add(resource.urn);
		return undefined;
	};

	/**
	 * Optional initialization method called after the oracle is loaded.
	 * Enforced through optional implementation of {@link PluginWithInitFn}.
	 */
	// eslint-disable-next-line class-methods-use-this
	readonly init: PluginInitFn = async () => {};

	/**
	 * Optional shutdown method called after the ProTI check terminated.
	 * Enforced through optional implementation of {@link PluginWithShutdownFn}.
	 */
	// eslint-disable-next-line class-methods-use-this
	readonly shutdown: PluginShutdownFn = async () => {};
}
export default DemoOraclePlugin;
