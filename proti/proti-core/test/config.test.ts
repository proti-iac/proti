import {
	config,
	Config,
	defaultConfig,
	defaultModuleLoadingConfig,
	defaultTestRunnerConfig,
	ModuleLoadingConfig,
	TestRunnerConfig,
} from '../src/config';
import { DeepPartial, isObj, Obj } from '../src/utils';

describe('config defaults', () => {
	it.each([
		['test runner config', defaultTestRunnerConfig as () => TestRunnerConfig],
		['module loading config', defaultModuleLoadingConfig as () => ModuleLoadingConfig],
		['config', defaultConfig as () => Config],
	])('%s should work', (_, defConfig) => expect(typeof defConfig()).toBe('object'));

	it.each([
		['test runner config', defaultConfig().testRunner, defaultTestRunnerConfig()],
		['module loading config', defaultConfig().moduleLoading, defaultModuleLoadingConfig()],
	])('%s should be in config', (_, conf, refConfig) => expect(conf).toStrictEqual(refConfig));
});

describe('config', () => {
	it('should return deault config', () => {
		expect(config(undefined)).toStrictEqual(defaultConfig());
	});

	it.each([
		{},
		{ testRunner: { waitTick: false } },
		{ testRunner: { waitTick: true }, moduleLoading: { preload: [] } },
	] as DeepPartial<Config>[])('should merge partial config %s', (partialConfig) => {
		const check = <T>(conf: T, partialConf: DeepPartial<T>): void =>
			isObj(partialConf)
				? Object.entries(partialConf).forEach(([k, v]: [string, unknown]) =>
						check((conf as Obj)[k], v as DeepPartial<Obj>)
				  )
				: expect(conf).toStrictEqual(partialConf);
		check(config(partialConfig), partialConfig);
	});

	it.each([
		false,
		null,
		{ a: false },
		{ testRunner: { a: false } },
		{ testRunner: { waitTick: 'false' } },
	])('should throw on invalid config %s', (partialConfig) => {
		expect(() => config(partialConfig)).toThrow();
	});
});
