import * as fc from 'fast-check';
import { assertEquals, equals } from 'typia';
import { Generator } from './generator';
import { deepMerge, isObj } from './utils';

export const defaultTestCoordinatorConfig = () => ({
	/** Test generator arbitrary to use */
	arbitrary: '@proti/core/empty-state-generator-arbitrary',
	/** Test oracles to run */
	oracles: ['@proti/core/unique-urns-oracle'],
});
export type TestCoordinatorConfig = ReturnType<typeof defaultTestCoordinatorConfig>;

export const defaultTestRunnerConfig = (): fc.Parameters<[Generator]> => ({
	/** Number of test iterations */
	numRuns: 100,
});
export type TestRunnerConfig = ReturnType<typeof defaultTestRunnerConfig>;

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
export type ModuleLoadingConfig = ReturnType<typeof defaultModuleLoadingConfig>;

export type PluginsConfig = Record<string, any>;
export const defaultPluginsConfig = (): PluginsConfig => ({});

export const defaultConfig = () => ({
	testCoordinator: defaultTestCoordinatorConfig(),
	testRunner: defaultTestRunnerConfig(),
	moduleLoading: defaultModuleLoadingConfig(),
	plugins: defaultPluginsConfig(),
});
export type Config = ReturnType<typeof defaultConfig>;

export const config = (partialConfig: any = {}): Config => {
	// Deep merge only handles structure present in the default config. Hence, plugins config has to be treated manually.
	const configCandidate = deepMerge(defaultConfig(), partialConfig, ['.plugins']);
	if (partialConfig.plugins) {
		if (!isObj(partialConfig.plugins))
			throw new Error(`Plugins config is not an object but ${typeof partialConfig.plugins}`);
		configCandidate.plugins = partialConfig.plugins;
	}
	return assertEquals<Config>(configCandidate);
};
export const isConfig = (conf: any): conf is Config => equals<Config>(conf);
