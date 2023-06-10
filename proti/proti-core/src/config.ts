import * as fc from 'fast-check';
import { assertEquals, equals } from 'typia';
import type { Generator } from './generator';
import { deepMerge, DeepPartial, DeepReadonly, isObj } from './utils';

export const defaultTestCoordinatorConfig = () => ({
	/** Test generator arbitrary to use */
	arbitrary: '@proti/core/empty-state-generator-arbitrary',
	/** Test oracles to run */
	oracles: ['@proti/core/unique-urns-oracle'],
});
export type TestCoordinatorConfig = DeepReadonly<ReturnType<typeof defaultTestCoordinatorConfig>>;

export const defaultTestRunnerConfig = (): fc.Parameters<[Generator]> => ({});
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

export const config = (partialConfig: any = {}): Config => {
	// Deep merge only handles structure present in the default config. Hence,
	// plugins and runner config has to be treated manually.
	const configCandidate = deepMerge<Config>(defaultConfig(), partialConfig, [
		'.testRunner',
		'.plugins',
	]);
	if (partialConfig.plugins && !isObj(partialConfig.plugins))
		throw new Error(`Plugins config is not an object but ${typeof partialConfig.plugins}`);
	return assertEquals<Config>({
		...configCandidate,
		testRunner: {
			...configCandidate.testRunner,
			...(partialConfig.testRunner
				? assertEquals<DeepPartial<TestRunnerConfig>>(partialConfig.testRunner)
				: {}),
		},
		plugins: {
			...configCandidate.plugins,
			...(partialConfig.plugins ? partialConfig.plugins : {}),
		},
	});
};
export const isConfig: (conf: any) => conf is Config = (conf): conf is Config => equals<Config>(conf);
