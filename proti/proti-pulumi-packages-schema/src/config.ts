import { type TypeGuardError, assertEquals, equals, is } from 'typia';
import { deepMerge, DeepPartial, DeepReadonly } from '@proti/core';
import type { ResourceType, ResourceDefinition, Type, TypeDefinition } from './pulumi';

export const defaultArbitraryConfig = () => ({
	/**
	 * Fail on generating state for resource type that cannot be retrieved. If
	 * false, return `defaultResourceState`.
	 */
	failOnMissingResourceDefinition: true,
	/**
	 * Default state to generate for missing resource types if
	 * `failOnMissingResourceDefinition` is `false`.
	 */
	defaultResourceState: {} as any,
	/**
	 * Fail if type reference in a namd type cannot be resolved. If false,
	 * `defaultTypeReferenceDefinition` will be used as default.
	 */
	failOnMissingTypeReference: false,
	/**
	 * Default definition used for unresolvable type references if
	 * `failOnMissingTypeReference` is false. If undefined, no type will be
	 * generated, i.e., `undefined` values.
	 */
	defaultTypeReferenceDefinition: undefined as ResourceDefinition | TypeDefinition | undefined,
});
export type ArbitraryConfig = DeepReadonly<ReturnType<typeof defaultArbitraryConfig>>;

export const defaultOracleConfig = () => ({
	/**
	 * Fail on validating state for resource type that cannot be retrieved.
	 */
	failOnMissingResourceDefinition: true,
	/**
	 * Fail if type reference in a named type cannot be resolved.
	 */
	failOnMissingTypeReference: false,
});
export type OracleConfig = DeepReadonly<ReturnType<typeof defaultOracleConfig>>;

export const defaultSchemaRegistryConfig = () => ({
	/**
	 * Sub-directory in Jest project cache directory to use for Pulumi package
	 * schemas cache.
	 */
	cacheSubdir: 'pulumi-packages-schemas',
	/** Load package schema files cached in Jest project cache directory. */
	loadCachedSchemas: true,
	/** Package schema files to load into the registry. Overrides cached schemas. */
	schemaFiles: [] as ReadonlyArray<string>,
	/**
	 * Resource definitions to load into the registry. Overrides cached schemas
	 * and schema files.
	 */
	resources: {} as Readonly<Record<ResourceType, ResourceDefinition>>,
	/**
	 * Type definitions to load into the registry. Overrides cached schemas and
	 * schema files.
	 */
	types: {} as Readonly<Record<Type, TypeDefinition>>,
	/**
	 * If true, try to download all schemas of loaded Pulumi resource packages
	 * using `pulumi package get-schema` when a resource or type definition is
	 * requested that is missing in the schema registry.
	 */
	downloadSchemas: true,
	/**
	 * If true, add downloaded schemas to the Jest project cache directory for
	 * subsequent executions.
	 */
	cacheDownloadedSchemas: true,
});
export type SchemaRegistryConfig = DeepReadonly<ReturnType<typeof defaultSchemaRegistryConfig>>;

export const defaultConfig = () => ({
	arbitrary: defaultArbitraryConfig(),
	oracle: defaultOracleConfig(),
	registry: defaultSchemaRegistryConfig(),
	verbose: false,
});
export type Config = DeepReadonly<ReturnType<typeof defaultConfig>>;

let cachedConfig: Config | undefined;
export const resetCachedConfig = () => {
	cachedConfig = undefined;
};
export const config = (partialConfig: unknown = {}, ignoreCache: boolean = false): Config => {
	if (ignoreCache) resetCachedConfig();
	if (cachedConfig === undefined)
		// Deep merge only allows properties present in the default config.
		// Hence, complex config values have to be overwritten.
		try {
			cachedConfig = deepMerge(
				defaultConfig(),
				assertEquals<DeepPartial<Config>>(partialConfig),
				[
					'.plugins.pulumi-packages-schema.arbitrary.defaultResourceState',
					'.plugins.pulumi-packages-schema.arbitrary.defaultTypeReferenceDefinition',
					'.plugins.pulumi-packages-schema.registry.resources',
					'.plugins.pulumi-packages-schema.registry.types',
				],
				'.plugins.pulumi-packages-schema'
			);
		} catch (e) {
			if (is<TypeGuardError>(e))
				throw new Error(
					`Invalid @proti/pulumi-packages-schema configuration. ${e.path} should be ${e.expected} but is ${e.value}.`
				);
			throw e;
		}
	return cachedConfig;
};
export const isConfig = (conf: any): conf is Config => equals<Config>(conf);
