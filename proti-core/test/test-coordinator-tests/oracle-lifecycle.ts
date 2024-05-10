import type {
	AsyncDeploymentOracle,
	AsyncResourceOracle,
	DeploymentOracle,
	ResourceOracle,
} from '../../src/oracle';
import type {
	PluginArgs,
	PluginInitFn,
	PluginPostRunArgs,
	PluginPostRunFn,
	PluginPreRunArgs,
	PluginPreRunFn,
	PluginShutdownFn,
	PluginWithInitFn,
	PluginWithShutdownFn,
} from '../../src/plugin';
import type { CheckResult } from '../../src/result';

// eslint-disable-next-line import/no-mutable-exports
export let config: PluginArgs;
// eslint-disable-next-line import/no-mutable-exports
export let preRunArgs: PluginPreRunArgs;
// eslint-disable-next-line import/no-mutable-exports
export let postRunArgs: PluginPostRunArgs;
// eslint-disable-next-line import/no-mutable-exports
export let result: CheckResult;
class OracleLifecyclePlugin
	implements
		ResourceOracle<{}>,
		AsyncResourceOracle<{}>,
		DeploymentOracle<{}>,
		AsyncDeploymentOracle<{}>,
		PluginWithInitFn,
		PluginWithShutdownFn
{
	readonly name = 'Test';

	readonly description = 'Test';

	// eslint-disable-next-line class-methods-use-this
	readonly newRunState = () => ({});

	// eslint-disable-next-line class-methods-use-this
	readonly validateResource = () => undefined;

	// eslint-disable-next-line class-methods-use-this
	readonly asyncValidateResource = async () => undefined;

	// eslint-disable-next-line class-methods-use-this
	readonly validateDeployment = () => undefined;

	// eslint-disable-next-line class-methods-use-this
	readonly asyncValidateDeployment = async () => undefined;

	// eslint-disable-next-line class-methods-use-this
	readonly init: PluginInitFn = async (pluginArgs) =>
		new Promise((done) => {
			process.nextTick(() => {
				config = pluginArgs;
				done();
			});
		});

	// eslint-disable-next-line class-methods-use-this
	readonly preRun: PluginPreRunFn = async (args) =>
		new Promise((done) => {
			process.nextTick(() => {
				preRunArgs = args;
				done();
			});
		});

	// eslint-disable-next-line class-methods-use-this
	readonly postRun: PluginPostRunFn = async (args) =>
		new Promise((done) => {
			process.nextTick(() => {
				postRunArgs = args;
				done();
			});
		});

	// eslint-disable-next-line class-methods-use-this
	readonly shutdown: PluginShutdownFn = async (checkResult) =>
		new Promise((done) => {
			process.nextTick(() => {
				result = checkResult;
				done();
			});
		});
}
export default OracleLifecyclePlugin;
