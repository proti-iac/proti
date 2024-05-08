/* eslint-disable class-methods-use-this */
import type {
	AsyncDeploymentOracle,
	AsyncResourceOracle,
	DeploymentOracle,
	ResourceOracle,
} from '../../src/oracle';
import type { PluginArgs, PluginInitFn, PluginWithInitFn } from '../../src/plugin';

// eslint-disable-next-line import/no-mutable-exports
export let config: PluginArgs;
class OraclePlugin
	implements
		ResourceOracle<{}>,
		AsyncResourceOracle<{}>,
		DeploymentOracle<{}>,
		AsyncDeploymentOracle<{}>,
		PluginWithInitFn
{
	readonly name = 'Test';

	readonly description = 'Test';

	readonly newRunState = () => ({});

	readonly validateResource = () => undefined;

	readonly asyncValidateResource = async () => undefined;

	readonly validateDeployment = () => undefined;

	readonly asyncValidateDeployment = async () => undefined;

	readonly init: PluginInitFn = async (pluginArgs) =>
		new Promise((done) => {
			process.nextTick(() => {
				config = pluginArgs;
				done();
			});
		});
}
export default OraclePlugin;
