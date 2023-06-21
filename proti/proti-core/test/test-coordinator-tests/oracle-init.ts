/* eslint-disable class-methods-use-this */
import type {
	AsyncDeploymentOracle,
	AsyncResourceOracle,
	DeploymentOracle,
	ResourceOracle,
} from '../../src/oracle';
import type { TestModuleConfig, TestModuleInitFn } from '../../src/test-coordinator';

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
export let config: TestModuleConfig;
export const init: TestModuleInitFn = async (testModuleConfig) =>
	new Promise((done) => {
		process.nextTick(() => {
			config = testModuleConfig;
			done();
		});
	});
