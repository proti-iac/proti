import type { TestModuleConfig, TestModuleInitFn } from '@proti/core';
import path from 'path';
import { config } from './config';
import { SchemaRegistry } from './schema-registry';

const pluginName = 'pulumi-packages-schema';
export const initModule: TestModuleInitFn = async ({
	moduleLoader,
	pluginsConfig,
	testPath,
	cacheDir,
}: TestModuleConfig) => {
	const pluginConfig: unknown =
		pluginName in pluginsConfig ? pluginsConfig[pluginName] : undefined;
	const conf = config(pluginConfig);
	await SchemaRegistry.initInstance(
		moduleLoader,
		conf.registry,
		path.dirname(testPath),
		cacheDir,
		conf.verbose ? console.log : () => {}
	);
};
