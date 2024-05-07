/* eslint-disable class-methods-use-this */
import type {
	AsyncDeploymentOracle,
	AsyncResourceOracle,
	DeploymentOracle,
	ResourceOracle,
} from '../../src/oracle';
import type { PluginShutdownFn } from '../../src/plugin';
import type { CheckResult } from '../../src/result';

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
export let result: CheckResult;
export const shutdown: PluginShutdownFn = async (checkResult) =>
	new Promise((done) => {
		process.nextTick(() => {
			result = checkResult;
			done();
		});
	});
