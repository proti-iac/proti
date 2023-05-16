import { DeepPartial, isObj, Obj } from '@proti/core';
import { config, Config, defaultConfig } from '../src/config';

describe('config', () => {
	it('should return default config', () => {
		expect(config(undefined)).toStrictEqual(defaultConfig());
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
		check(config(partialConfig), partialConfig);
	});

	it.each([false, null, { a: false }, { schemas: 5 }, { schemas: { a: 5 }, loadSchemas: 5 }])(
		'should throw on invalid config %s',
		(partialConfig) => {
			expect(() => config(partialConfig)).toThrow();
		}
	);
});
