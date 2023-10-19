test('true', () => {
	// eslint-disable-next-line no-underscore-dangle
	const testValue = (global as any).resolver._moduleMap._raw.rootDir;
	expect(testValue.endsWith('proti/proti-runner/test/e2e-tests')).toBe(true);
});
