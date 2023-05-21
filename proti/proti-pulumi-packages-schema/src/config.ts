import { assertEquals, equals } from 'typia';
import { deepMerge } from '@proti/core';
import type { Schema, Schemas } from './schemas';

export const defaultConfig = () => ({
	// Schemas to load into the registry. Overrides schema files and cached and loaded schemas.
	schemas: {} as Record<string, Schema>,
	// Schema files to load into the registry. Overrides cached and loaded schemas.
	schemaFiles: [] as string[],
	// If true, try to load schemas that missing in the registry using `pulumi package get-schema`.
	loadSchemas: true,
	// If true, cache loaded schemas in the Jest project cache directory for subsequent executions.
	cacheSchemas: true,
	verbose: false,
});
export type Config = ReturnType<typeof defaultConfig>;

let cachedConfig: Config;
export const config = (partialConfig: any = {}, ignoreCache: boolean = false): Config => {
	if (cachedConfig === undefined || ignoreCache) {
		// Deep merge only handles structure present in the default config. Hence, schemas have to be treated manually.
		const configCandidate = deepMerge(
			defaultConfig(),
			partialConfig,
			['.plugins.pulumi-packages-schema.schemas'],
			'.plugins.pulumi-packages-schema'
		);
		if ('schemas' in partialConfig)
			configCandidate.schemas = assertEquals<Schemas>(partialConfig.schemas);
		cachedConfig = assertEquals<Config>(configCandidate);
	}
	return cachedConfig;
};
export const isConfig = (conf: any): conf is Config => equals<Config>(conf);
