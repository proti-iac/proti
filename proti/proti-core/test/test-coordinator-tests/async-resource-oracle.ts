import type { AsyncResourceOracle } from '../../src/oracle';

class Oracle implements AsyncResourceOracle<{}> {
	name = 'Test';

	description = 'Test';

	// eslint-disable-next-line class-methods-use-this
	newRunState = () => ({});

	// eslint-disable-next-line class-methods-use-this
	asyncValidateResource = async () => undefined;
}

export default Oracle;
