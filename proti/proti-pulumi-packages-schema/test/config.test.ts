import { DeepPartial, isObj, Obj } from '@proti/core';
import { config, Config, defaultConfig, resetCachedConfig } from '../src/config';
import type { ResourceSchema } from '../src/pulumi';

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

	const resource: ResourceSchema = { b: 5 };
	it.each([
		{ registry: { schemas: { a: resource } } },
		{
			registry: {
				schemas: { a: resource },
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
		{ registry: { schemas: 5 } },
		{ registry: { schemas: { a: 5 } }, loadSchemas: 5 },
	])('should throw on invalid config %s', (partialConfig) => {
		expect(() => config(partialConfig, true)).toThrow();
	});
});
