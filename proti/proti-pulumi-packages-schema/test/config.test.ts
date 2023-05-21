import { DeepPartial, isObj, Obj } from '@proti/core';
import { config, Config, defaultConfig } from '../src/config';

describe('config', () => {
	it('should cache config', () => {
		const cached = config();
		expect(config()).toBe(cached);
	});

	it('should not cache config', () => {
		const cached = config();
		expect(config({}, true)).not.toBe(cached);
	});

	it('should return default config', () => {
		expect(config(undefined, true)).toStrictEqual(defaultConfig());
	});

	it.each([
		{ schemas: { a: 5 } },
		{ schemas: { a: 5 }, schemaFiles: ['a', 'b'], cacheSchemas: false },
	] as DeepPartial<Config>[])('should merge partial config %s', (partialConfig) => {
		const check = <T>(conf: T, partialConf: DeepPartial<T>): void =>
			isObj(partialConf)
				? Object.entries(partialConf).forEach(([k, v]: [string, unknown]) =>
						check((conf as Obj)[k], v as DeepPartial<Obj>)
				  )
				: expect(conf).toStrictEqual(partialConf);
		check(config(partialConfig, true), partialConfig);
	});

	it.each([false, null, { a: false }, { schemas: 5 }, { schemas: { a: 5 }, loadSchemas: 5 }])(
		'should throw on invalid config %s',
		(partialConfig) => {
			expect(() => config(partialConfig, true)).toThrow();
		}
	);
});
