import * as fc from 'fast-check';
import { PluginsConfig } from '../../bin';
import { Generator, ResourceOutput } from '../../src/generator';
import { ResourceOracleArgs } from '../../src/oracle';
import { TestModuleInitFn } from '../../src/test-coordinator';

export default fc.constant<Generator>({
	generateResourceOutput(resource: ResourceOracleArgs): ResourceOutput {
		return {
			id: resource.urn,
			state: {},
		};
	},
});

// eslint-disable-next-line import/no-mutable-exports
export let initPluginsConfig: PluginsConfig;
// eslint-disable-next-line import/no-mutable-exports
export let initCacheDir: string;
export const init: TestModuleInitFn = async (pluginsConfig, cacheDir) => {
	initPluginsConfig = pluginsConfig;
	initCacheDir = cacheDir;
};
