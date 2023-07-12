import * as fc from 'fast-check';
import { type TypeGuardError, assertEquals, equals, is } from 'typia';
import type { Generator } from './generator';
import { deepMerge, type DeepPartial, type DeepReadonly } from './utils';

export const defaultTestCoordinatorConfig = () => ({
	/** Test generator arbitrary to use */
	arbitrary: '@proti/core/empty-state-generator-arbitrary',
	/** Test oracles to run */
	oracles: ['@proti/core/unique-urns-oracle'],
});
export type TestCoordinatorConfig = DeepReadonly<ReturnType<typeof defaultTestCoordinatorConfig>>;

export const defaultTestRunnerConfig = (): fc.Parameters<[Generator]> & {
	/**
	 * Timeout for a single run of the program under test. Only works on async
	 * programs. If the program blocks the event loop, e.g., through busy
	 * waiting, the timeout does not work.
	 */
	timeout?: number;
} => ({});
export type TestRunnerConfig = DeepReadonly<ReturnType<typeof defaultTestRunnerConfig>>;

export const defaultModuleLoadingConfig = () => ({
	/** resolved in project and preloaded before tests */
	preload: ['@pulumi/pulumi', '@pulumi/pulumi/output', '@pulumi/pulumi/runtime/stack'],
	/**
	 * preload dependencies found in the program that match any of these regular
	 * expressions
	 */
	preloadDependencies: ['.*/node_modules/.*'],
	/** Log detailed information */
	verbose: false,
	/**
	 * Log all modules which are explicitely transformed before preloading
	 * (requires `verbose`)
	 */
	showTransformed: false,
	/** Log all isolated modules of a test run (requires `verbose`) */
	showIsolated: false,
	/** Log all preloaded modules before test runs (requires `verbose`) */
	showPreloaded: false,
	/** Log all shared/mocked modules of a test run (requires `verbose`) */
	showShared: false,
});
export type ModuleLoadingConfig = DeepReadonly<ReturnType<typeof defaultModuleLoadingConfig>>;

export const defaultPluginsConfig = (): PluginsConfig => ({});
export type PluginsConfig = DeepReadonly<Record<string, any>>;

export const defaultConfig = () => ({
	testCoordinator: defaultTestCoordinatorConfig(),
	testRunner: defaultTestRunnerConfig(),
	moduleLoading: defaultModuleLoadingConfig(),
	plugins: defaultPluginsConfig(),
});
export type Config = DeepReadonly<ReturnType<typeof defaultConfig>>;

export const config = (partialConfig: unknown = {}): Config => {
	try {
		// Deep merge only allows properties present in the default config. Hence,
		// plugins and runner config have to be overwritten.
		return deepMerge<Config>(
			defaultConfig(),
			assertEquals<DeepPartial<Config>>(partialConfig),
			['.testRunner', '.plugins']
		);
	} catch (e) {
		if (is<TypeGuardError>(e))
			throw new Error(
				`Invalid ProTI configuration. ${e.path} should be ${e.expected} but is ${e.value}.`
			);
		throw e;
	}
};
export const isConfig: (conf: any) => conf is Config = (conf): conf is Config =>
	equals<Config>(conf);
