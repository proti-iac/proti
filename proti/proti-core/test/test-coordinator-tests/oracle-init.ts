import type { PluginsConfig } from '../../src/config';
import type { ModuleLoader } from '../../src/module-loader';
import type { ResourceOracle, TestResult } from '../../src/oracle';
import type { TestModuleInitFn } from '../../src/test-coordinator';

class Oracle implements ResourceOracle {
	name = 'Test';

	description = 'Test';

	// eslint-disable-next-line class-methods-use-this
	validateResource = (): TestResult => undefined;
}

export default Oracle;

// eslint-disable-next-line import/no-mutable-exports
export let initModuleLoader: ModuleLoader;
// eslint-disable-next-line import/no-mutable-exports
export let initPluginsConfig: PluginsConfig;
// eslint-disable-next-line import/no-mutable-exports
export let initCacheDir: string;
export const init: TestModuleInitFn = async (moduleLoader, pluginsConfig, cacheDir) => {
	initModuleLoader = moduleLoader;
	initPluginsConfig = pluginsConfig;
	initCacheDir = cacheDir;
};
