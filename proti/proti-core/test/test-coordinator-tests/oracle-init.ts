import { PluginsConfig } from '../../src/config';
import { ResourceOracle, TestResult } from '../../src/oracle';
import { TestModuleInitFn } from '../../src/test-coordinator';

class Oracle implements ResourceOracle {
	name = 'Test';

	description = 'Test';

	// eslint-disable-next-line class-methods-use-this
	validateResource = (): TestResult => undefined;
}

export default Oracle;

// eslint-disable-next-line import/no-mutable-exports
export let initPluginsConfig: PluginsConfig;
// eslint-disable-next-line import/no-mutable-exports
export let initCacheDir: string;
export const init: TestModuleInitFn = async (pluginsConfig, cacheDir) => {
	initPluginsConfig = pluginsConfig;
	initCacheDir = cacheDir;
};
