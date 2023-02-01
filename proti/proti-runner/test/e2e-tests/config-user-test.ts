import { defaultConfig } from '@proti/core';

test('true', () => {
	const testVal = (global as any)?.proti;
	const config = defaultConfig();
	config.moduleLoading.preload = ['user-defined'];
	expect(testVal).toEqual(config);
});
