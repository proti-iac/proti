import type { TestModuleConfig, TestModuleInitFn } from '@proti/core';
import { config } from './config';
import { SchemaRegistry } from './schemas';

const pluginName = 'pulumi-packages-schema';
export const initModule: TestModuleInitFn = async ({
	moduleLoader,
	pluginsConfig,
	cacheDir,
}: TestModuleConfig) => {
	const pluginConfig: unknown =
		pluginName in pluginsConfig ? pluginsConfig[pluginName] : undefined;
	SchemaRegistry.initInstance(moduleLoader, config(pluginConfig), cacheDir);
};
