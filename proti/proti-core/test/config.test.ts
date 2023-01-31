import {
	Config,
	defaultConfig,
	defaultModuleLoadingConfig,
	defaultTestRunnerConfig,
	ModuleLoadingConfig,
	TestRunnerConfig,
} from '../src/config';

describe('config defaults', () => {
	it.each([
		['test runner config', defaultTestRunnerConfig as () => TestRunnerConfig],
		['module loading config', defaultModuleLoadingConfig as () => ModuleLoadingConfig],
		['config', defaultConfig as () => Config],
	])('%s should work', (_, defConfig) => expect(typeof defConfig()).toBe('object'));

	it.each([
		['test runner config', defaultConfig().testRunner, defaultTestRunnerConfig()],
		['module loading config', defaultConfig().moduleLoading, defaultModuleLoadingConfig()],
	])('%s should be in config', (_, config, refConfig) => expect(config).toStrictEqual(refConfig));
});
