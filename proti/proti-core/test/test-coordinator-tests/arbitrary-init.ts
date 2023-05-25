import * as fc from 'fast-check';
import type { PluginsConfig } from '../../src/config';
import type { Generator, ResourceOutput } from '../../src/generator';
import type { ModuleLoader } from '../../src/module-loader';
import type { ResourceOracleArgs } from '../../src/oracle';
import type { TestModuleInitFn } from '../../src/test-coordinator';

export default fc.constant<Generator>({
	generateResourceOutput(resource: ResourceOracleArgs): ResourceOutput {
		return {
			id: resource.urn,
			state: {},
		};
	},
});

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
