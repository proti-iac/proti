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
