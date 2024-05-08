/* eslint-disable class-methods-use-this */
import type {
	AsyncDeploymentOracle,
	AsyncResourceOracle,
	DeploymentOracle,
	ResourceOracle,
} from '../../src/oracle';
import type { PluginShutdownFn, PluginWithShutdownFn } from '../../src/plugin';
import type { CheckResult } from '../../src/result';

// eslint-disable-next-line import/no-mutable-exports
export let result: CheckResult;
class OracleWithShutdownPlugin
	implements
		ResourceOracle<{}>,
		AsyncResourceOracle<{}>,
		DeploymentOracle<{}>,
		AsyncDeploymentOracle<{}>,
		PluginWithShutdownFn
{
	readonly name = 'Test';

	readonly description = 'Test';

	readonly newRunState = () => ({});

	readonly validateResource = () => undefined;

	readonly asyncValidateResource = async () => undefined;

	readonly validateDeployment = () => undefined;

	readonly asyncValidateDeployment = async () => undefined;

	readonly shutdown: PluginShutdownFn = async (checkResult) =>
		new Promise((done) => {
			process.nextTick(() => {
				result = checkResult;
				done();
			});
		});
}
export default OracleWithShutdownPlugin;
