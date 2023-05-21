import type { PluginsConfig, TestModuleInitFn } from '@proti/core';
import { config } from './config';
import { initSchemas } from './schemas';

const pluginName = 'pulumi-packages-schema';
export const initModule: TestModuleInitFn = async (
	pluginsConfig: PluginsConfig,
	cacheDir: string
) => {
	const pluginConfig: unknown =
		pluginName in pluginsConfig ? pluginsConfig[pluginName] : undefined;
};
