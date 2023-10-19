import type { DeploymentOracle } from '../../src/oracle';

class Oracle implements DeploymentOracle<{}> {
	name = 'Test';

	description = 'Test';

	// eslint-disable-next-line class-methods-use-this
	newRunState = () => ({});

	// eslint-disable-next-line class-methods-use-this
	validateDeployment = () => undefined;
}

export default Oracle;
