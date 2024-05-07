/* eslint-disable class-methods-use-this */
import type {
	AsyncDeploymentOracle,
	AsyncResourceOracle,
	DeploymentOracle,
	ResourceOracle,
} from '../../src/oracle';
import type { PluginArgs, PluginInitFn } from '../../src/plugin';

class Oracle
	implements
		ResourceOracle<{}>,
		AsyncResourceOracle<{}>,
		DeploymentOracle<{}>,
		AsyncDeploymentOracle<{}>
{
	name = 'Test';

	description = 'Test';

	newRunState = () => ({});

	validateResource = () => undefined;

	asyncValidateResource = async () => undefined;

	validateDeployment = () => undefined;

	asyncValidateDeployment = async () => undefined;
}

export default Oracle;

// eslint-disable-next-line import/no-mutable-exports
export let config: PluginArgs;
export const init: PluginInitFn = async (pluginArgs) =>
	new Promise((done) => {
		process.nextTick(() => {
			config = pluginArgs;
			done();
		});
	});
