import { type TypeGuardError, assertEquals, equals, is } from 'typia';
import { deepMerge, DeepPartial, DeepReadonly } from '@proti/core';

/**
 * @returns Default configuration of plugin.
 */
export const defaultConfig = () => ({
	demoId: 'demo-id',
});
export type Config = DeepReadonly<ReturnType<typeof defaultConfig>>;

let cachedConfig: Config | undefined;
export const resetCachedConfig = () => {
	cachedConfig = undefined;
};

/**
 * @param partialConfig Partial configuration to merge into default configuration.
 * @param ignoreCache If true, cached configuration is ignored and re-generated.
 * @returns Plugin configuration.
 * @throws On invalid type of {@link partialConfig}.
 */
export const config = (partialConfig: unknown = {}, ignoreCache: boolean = false): Config => {
	if (ignoreCache) resetCachedConfig();
	if (cachedConfig === undefined)
		// Deep merge only allows properties present in the default config.
		// Hence, complex config values have to be overwritten.
		try {
			cachedConfig = deepMerge(
				defaultConfig(),
				assertEquals<DeepPartial<Config>>(partialConfig),
				[],
				'.plugins.plugins-demo'
			);
		} catch (e) {
			if (is<TypeGuardError>(e))
				throw new Error(
					`Invalid @proti/plugins-demo configuration. ${e.path} should be ${e.expected} but is ${e.value}.`
				);
			throw e;
		}
	return cachedConfig;
};
export const isConfig = (conf: any): conf is Config => equals<Config>(conf);
