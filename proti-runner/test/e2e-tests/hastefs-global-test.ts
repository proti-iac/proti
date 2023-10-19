test('true', () => {
	// eslint-disable-next-line no-underscore-dangle
	const testVal = (global as any).hasteFS._rootDir;
	expect(testVal.endsWith('proti/proti-runner/test/e2e-tests')).toBe(true);
});
