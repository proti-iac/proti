import { assertEquals, equals } from 'typia';
import { deepMerge } from '@proti/core';
import type { ResourceType, ResourceSchema, ResourceSchemas } from './schemas';

export const defaultConfig = () => ({
	// Sub-directory in Jest project cache directory to use for Pulumi package schemas cache.
	cacheSubdir: 'pulumi-packages-schemas',
	// Load schema files cached in Jest project cache directory.
	loadCachedSchemas: true,
	// Schema files to load into the registry. Overrides cached schemas.
	schemaFiles: [] as string[],
	// Schemas to load into the registry. Overrides cached schemas and schema files.
	schemas: {} as Record<ResourceType, ResourceSchema>,
	// If true, try to load schemas that are missing in the registry using `pulumi package get-schema`.
	loadSchemas: true,
	// If true, cache loaded schemas in the Jest project cache directory for subsequent executions.
	cacheSchemas: true,
	verbose: false,
});
export type Config = ReturnType<typeof defaultConfig>;

let cachedConfig: Config | undefined;
export const resetCachedConfig = () => {
	cachedConfig = undefined;
};
export const config = (partialConfig: any = {}, ignoreCache: boolean = false): Config => {
	if (ignoreCache) resetCachedConfig();
	if (cachedConfig === undefined) {
		// Deep merge only handles structure present in the default config. Hence, schemas have to be treated manually.
		const configCandidate = deepMerge(
			defaultConfig(),
			partialConfig,
			['.plugins.pulumi-packages-schema.schemas'],
			'.plugins.pulumi-packages-schema'
		);
		if ('schemas' in partialConfig)
			configCandidate.schemas = assertEquals<ResourceSchemas>(partialConfig.schemas);
		cachedConfig = assertEquals<Config>(configCandidate);
	}
	return cachedConfig;
};
export const isConfig = (conf: any): conf is Config => equals<Config>(conf);