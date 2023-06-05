import { assertEquals, equals } from 'typia';
import { deepMerge } from '@proti/core';
import type { ResourceType, ResourceSchema, ResourceSchemas } from './pulumi';

export const defaultSchemaRegistryConfig = () => ({
	/**
	 * Sub-directory in Jest project cache directory to use for Pulumi package
	 * schemas cache.
	 */
	cacheSubdir: 'pulumi-packages-schemas',
	/** Load package schema files cached in Jest project cache directory. */
	loadCachedSchemas: true,
	/** Package schema files to load into the registry. Overrides cached schemas. */
	schemaFiles: [] as string[],
	/**
	 * Resource schemas to load into the registry. Overrides cached schemas and
	 * schema files.
	 */
	schemas: {} as Record<ResourceType, ResourceSchema>,
	/**
	 * If true, try to download all schemas of loaded Pulumi resource packages
	 * using `pulumi package get-schema` when a resource schema is requested
	 * that is missing in the schema registry.
	 */
	downloadSchemas: true,
	/**
	 * If true, add downloaded schemas to the Jest project cache directory for
	 * subsequent executions.
	 */
	cacheDownloadedSchemas: true,
});
export type SchemaRegistryConfig = ReturnType<typeof defaultSchemaRegistryConfig>;

export const defaultConfig = () => ({
	registry: defaultSchemaRegistryConfig(),
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
			['.plugins.pulumi-packages-schema.registry.schemas'],
			'.plugins.pulumi-packages-schema'
		);
		if (partialConfig?.registry?.schemas !== undefined)
			configCandidate.registry.schemas = assertEquals<ResourceSchemas>(
				partialConfig.registry.schemas
			);
		cachedConfig = assertEquals<Config>(configCandidate);
	}
	return cachedConfig;
};
export const isConfig = (conf: any): conf is Config => equals<Config>(conf);
