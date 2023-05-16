import { ResourceOracle, TestResult } from '../../src/oracle';

class Oracle implements ResourceOracle {
	name = 'Test';

	description = 'Test';

	// eslint-disable-next-line class-methods-use-this
	validateResource = (): TestResult => undefined;
}

export default Oracle;
