import { assertEquals, equals } from 'typia';
import { deepMerge, DeepReadonly } from '@proti/core';
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
export const config = (partialConfig: any = {}, ignoreCache: boolean = false): Config => {
	if (ignoreCache) resetCachedConfig();
	if (cachedConfig === undefined) {
		// Deep merge only handles structure present in the default config.
		// Hence, resource and type definitions have to be treated manually.
		const configCandidate = deepMerge(
			defaultConfig(),
			partialConfig,
			[
				'.plugins.pulumi-packages-schema.arbitrary.defaultResourceState',
				'.plugins.pulumi-packages-schema.arbitrary.defaultTypeReferenceDefinition',
				'.plugins.pulumi-packages-schema.registry.resources',
				'.plugins.pulumi-packages-schema.registry.types',
			],
			'.plugins.pulumi-packages-schema'
		);
		if (partialConfig?.arbitrary?.defaultResourceState !== undefined)
			configCandidate.arbitrary.defaultResourceState =
				partialConfig.arbitrary.defaultResourceState;
		if (partialConfig?.arbitrary?.defaultTypeReferenceDefinition !== undefined)
			configCandidate.arbitrary.defaultTypeReferenceDefinition = assertEquals<
				ArbitraryConfig['defaultTypeReferenceDefinition']
			>(partialConfig.arbitrary.defaultTypeReferenceDefinition);
		if (partialConfig?.registry?.resources !== undefined)
			configCandidate.registry.resources = assertEquals<
				Readonly<Record<ResourceType, ResourceDefinition>>
			>(partialConfig.registry.resources);
		if (partialConfig?.registry?.types !== undefined)
			configCandidate.registry.types = assertEquals<Readonly<Record<Type, TypeDefinition>>>(
				partialConfig.registry.types
			);
		cachedConfig = assertEquals<Config>(configCandidate);
	}
	return cachedConfig;
};
export const isConfig = (conf: any): conf is Config => equals<Config>(conf);
