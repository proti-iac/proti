import { DeepPartial, isObj, Obj } from '@proti/core';
import {
	ArbitraryConfig,
	config,
	Config,
	defaultArbitraryConfig,
	defaultConfig,
	defaultSchemaRegistryConfig,
	resetCachedConfig,
	SchemaRegistryConfig,
} from '../src/config';
import type { ResourceDefinition } from '../src/pulumi';

describe('config defaults', () => {
	it.each([
		['arbitrary config', defaultArbitraryConfig as () => ArbitraryConfig],
		['schema registry config', defaultSchemaRegistryConfig as () => SchemaRegistryConfig],
		['config', defaultConfig as () => Config],
	])('%s should work', (_, defConfig) => expect(typeof defConfig()).toBe('object'));

	it.each([
		['arbitrary config', defaultConfig().arbitrary, defaultArbitraryConfig()],
		['schema registry config', defaultConfig().registry, defaultSchemaRegistryConfig()],
	])('%s should be in config', (_, conf, refConfig) => expect(conf).toStrictEqual(refConfig));
});

describe('config', () => {
	beforeEach(() => resetCachedConfig());

	it('should cache config', () => {
		expect(config()).toBe(config());
	});

	it('should not cache config', () => {
		expect(config()).not.toBe(config({}, true));
	});

	it('should return default config', () => {
		expect(config(undefined, true)).toStrictEqual(defaultConfig());
	});

	const resource: ResourceDefinition = { b: 5 };
	it.each([
		{},
		{ registry: {} },
		{ registry: { resources: { a: resource } } },
		{
			registry: {
				resources: { a: resource },
				schemaFiles: ['a', 'b'],
				cacheDownloadedSchemas: false,
			},
		},
	] as DeepPartial<Config>[])('should merge partial config %s', (partialConfig) => {
		const check = <T>(conf: T, partialConf: DeepPartial<T>): void =>
			isObj(partialConf)
				? Object.entries(partialConf).forEach(([k, v]: [string, unknown]) =>
						check((conf as Obj)[k], v as DeepPartial<Obj>)
				  )
				: expect(conf).toStrictEqual(partialConf);
		check(config(partialConfig, true), partialConfig);
	});

	it.each([
		false,
		null,
		{ a: false },
		{ registry: { resources: 5 } },
		{ registry: { resources: { a: 5 } }, loadSchemas: 5 },
	])('should throw on invalid config %s', (partialConfig) => {
		expect(() => config(partialConfig, true)).toThrow();
	});
});
