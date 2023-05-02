import * as fc from 'fast-check';
import { assertEquals, equals } from 'typia';
import { Generator } from './generator';
import { deepMerge } from './utils';

export const defaultTestCoordinatorConfig = () => ({
	arbitrary: './arbitraries/empty-state-generator-arbitrary', // Test generator arbitrary to use
	oracles: ['./oracles/unique-urns-oracle'], // Test oracles to run
});
export type TestCoordinatorConfig = ReturnType<typeof defaultTestCoordinatorConfig>;

export const defaultTestRunnerConfig = (): fc.Parameters<[Generator]> => ({
	numRuns: 100, // Number of test iterations
});
export type TestRunnerConfig = ReturnType<typeof defaultTestRunnerConfig>;

export const defaultModuleLoadingConfig = () => ({
	preload: ['@pulumi/pulumi', '@pulumi/pulumi/output', '@pulumi/pulumi/runtime/stack'], // resolved in project and preloaded before tests
	preloadDependencies: ['.*/node_modules/.*'], // preload dependencies found in the program that match any of these regular expressions
	verbose: false, // Log detailed information
	showTransformed: false, // Log all modules which are explicitely transformed before preloading (requires `verbose`)
	showIsolated: false, // Log all isolated modules of a test run (requires `verbose`)
	showPreloaded: false, // Log all preloaded modules before test runs (requires `verbose`)
	showShared: false, // Log all shared/mocked modules of a test run (requires `verbose`)
});
export type ModuleLoadingConfig = ReturnType<typeof defaultModuleLoadingConfig>;

export const defaultConfig = () => ({
	testCoordinator: defaultTestCoordinatorConfig(),
	testRunner: defaultTestRunnerConfig(),
	moduleLoading: defaultModuleLoadingConfig(),
});
export type Config = ReturnType<typeof defaultConfig>;

export const config = (partialConfig: any): Config =>
	partialConfig === undefined
		? defaultConfig()
		: assertEquals<Config>(deepMerge(defaultConfig(), partialConfig));
export const isConfig = (conf: any): conf is Config => equals<Config>(conf);
