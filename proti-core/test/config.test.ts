import {
	config,
	Config,
	defaultConfig,
	defaultModuleLoadingConfig,
	defaultPluginsConfig,
	defaultTestCoordinatorConfig,
	defaultTestRunnerConfig,
	ModuleLoadingConfig,
	PluginsConfig,
	TestCoordinatorConfig,
	TestRunnerConfig,
} from '../src/config';
import { typeOf, type DeepPartial } from '../src/utils';

describe('config defaults', () => {
	it.each([
		['test coordinator config', defaultTestCoordinatorConfig as () => TestCoordinatorConfig],
		['test runner config', defaultTestRunnerConfig as () => TestRunnerConfig],
		['module loading config', defaultModuleLoadingConfig as () => ModuleLoadingConfig],
		['plugins config', defaultPluginsConfig as () => PluginsConfig],
		['config', defaultConfig as () => Config],
	])('%s should work', (_, defConfig) => expect(typeof defConfig()).toBe('object'));

	it.each([
		[
			'test coordinator config',
			defaultConfig().testCoordinator,
			defaultTestCoordinatorConfig(),
		],
		['test runner config', defaultConfig().testRunner, defaultTestRunnerConfig()],
		['module loading config', defaultConfig().moduleLoading, defaultModuleLoadingConfig()],
		['plugins config', defaultConfig().plugins, defaultPluginsConfig()],
	])('%s should be in config', (_, conf, refConfig) => expect(conf).toStrictEqual(refConfig));
});

describe('config', () => {
	it('should return default config', () => {
		expect(config(undefined)).toStrictEqual(defaultConfig());
	});

	it.each([
		{},
		{ testRunner: {} },
		{
			testRunner: { numRuns: 100 },
			moduleLoading: { preload: [] as string[] },
			plugins: { test: { a: 5 } },
		},
	] as DeepPartial<Config>[])('should merge partial config %s', (partialConfig) => {
		const check = <T>(conf: T, partialConf: DeepPartial<T>): void =>
			typeOf(partialConf) === 'object'
				? Object.entries(partialConf).forEach(([k, v]: [string, unknown]) =>
						check((conf as any)[k], v as DeepPartial<any>)
					)
				: expect(conf).toStrictEqual(partialConf);
		check(config(partialConfig), partialConfig);
	});

	it.each([
		false,
		null,
		{ a: false },
		{ testRunner: { numRuns: 100, a: false } },
		{ testRunner: { waitTick: 'false' } },
		{ plugins: 'test' },
	])('should throw on invalid config %s', (partialConfig) => {
		expect(() => config(partialConfig)).toThrow(
			/Invalid ProTI configuration. \$input.* should be .* but is .*./
		);
	});
});
