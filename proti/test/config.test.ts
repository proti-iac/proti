import { defaultConfig, fromPrimitiveConfig, toPrimitiveConfig } from '../src/config';

describe('Primitive config', () => {
	it('should only contain arrays, strings, numbers, and boolean (JSON value types) ', () => {
		const primitiveConfig = toPrimitiveConfig(defaultConfig);
		type V = Array<V> | string | number | boolean;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const t = <T extends V>(v: T) => true;
		expect(Object.values(primitiveConfig).every((v) => t(v))).toBe(true);
	});

	it('should preserve configuration', () => {
		expect(fromPrimitiveConfig(toPrimitiveConfig(defaultConfig))).toStrictEqual(defaultConfig);
	});
});
