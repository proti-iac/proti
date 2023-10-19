import type { AsyncDeploymentOracle } from '../../src/oracle';

class Oracle implements AsyncDeploymentOracle<{}> {
	name = 'Test';

	description = 'Test';

	// eslint-disable-next-line class-methods-use-this
	newRunState = () => ({});

	// eslint-disable-next-line class-methods-use-this
	asyncValidateDeployment = async () => undefined;
}

export default Oracle;
