import type { ResourceOracle } from '../../src/oracle';

class Oracle implements ResourceOracle<{}> {
	name = 'Test';

	description = 'Test';

	// eslint-disable-next-line class-methods-use-this
	newRunState = () => ({});

	// eslint-disable-next-line class-methods-use-this
	validateResource = () => undefined;
}

export default Oracle;
