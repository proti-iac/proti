test('true', () =>
	// eslint-disable-next-line no-underscore-dangle
	expect((global as any).hasteFS._rootDir.endsWith('proti/proti-runner/test/e2e-tests')).toBe(true));
