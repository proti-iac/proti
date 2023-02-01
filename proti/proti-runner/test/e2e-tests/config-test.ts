import { defaultConfig } from '@proti/core';

test('true', () => {
	const testVal = (global as any)?.proti;
	expect(testVal).toEqual(defaultConfig());
});
