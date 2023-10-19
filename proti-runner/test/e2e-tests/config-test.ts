import { defaultConfig } from '@proti-iac/core';

test('true', () => {
	const testVal = (global as any)?.proti;
	expect(testVal).toEqual(defaultConfig());
});
