/* eslint-disable class-methods-use-this */
import type { AsyncDeploymentOracle, ResourceOracle } from '../../src/oracle';

class Oracle implements ResourceOracle<{}>, AsyncDeploymentOracle<{}> {
	name = 'Test';

	description = 'Test';

	newRunState = () => ({});

	validateResource = () => undefined;

	asyncValidateDeployment = async () => undefined;
}

export default Oracle;
