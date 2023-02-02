import { assertEquals, equals } from 'typia';
import { deepMerge } from './utils';

export const defaultTestRunnerConfig = () => ({
	waitTick: true, // Wait for a process tick before ending the test run
});
export type TestRunnerConfig = ReturnType<typeof defaultTestRunnerConfig>;

export const defaultModuleLoadingConfig = () => ({
	preload: ['@pulumi/pulumi', '@pulumi/pulumi/runtime/stack'],
});
export type ModuleLoadingConfig = ReturnType<typeof defaultModuleLoadingConfig>;

export const defaultConfig = () => ({
	testRunner: defaultTestRunnerConfig(),
	moduleLoading: defaultModuleLoadingConfig(),
});
export type Config = ReturnType<typeof defaultConfig>;

export const config = (partialConfig: any): Config =>
	partialConfig === undefined
		? defaultConfig()
		: assertEquals<Config>(deepMerge(defaultConfig(), partialConfig));
export const isConfig = (conf: any): conf is Config => equals<Config>(conf);
