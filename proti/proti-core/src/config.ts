import { assertEquals, equals } from 'typia';
import { deepMerge } from './utils';

export const defaultTestCoordinatorConfig = () => ({
	failFast: false, // Stop execution as soon as a validation fails
	outputGenerator: './output-generators/empty-state-output-generator', // Output generator to use
	tests: ['./tests/unique-urns-test'], // Test classes to run
});
export type TestCoordinatorConfig = ReturnType<typeof defaultTestCoordinatorConfig>;

export const defaultTestRunnerConfig = () => ({
	numRuns: 100, // Number of test iterations
	waitTick: true, // Wait for a process tick before ending the test run
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
