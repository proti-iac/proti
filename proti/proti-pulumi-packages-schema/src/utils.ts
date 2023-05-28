import type { TestModuleConfig, TestModuleInitFn } from '@proti/core';
import path from 'path';
import { config } from './config';
import { SchemaRegistry } from './schemas';

const pluginName = 'pulumi-packages-schema';
export const initModule: TestModuleInitFn = async ({
	moduleLoader,
	pluginsConfig,
	testPath,
	cacheDir,
}: TestModuleConfig) => {
	const pluginConfig: unknown =
		pluginName in pluginsConfig ? pluginsConfig[pluginName] : undefined;
	await SchemaRegistry.initInstance(
		moduleLoader,
		config(pluginConfig),
		path.dirname(testPath),
		cacheDir
	);
};
