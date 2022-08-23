export const defaultConfig = {
	preload: ['@pulumi/pulumi'],
	preloadAbsoluteImports: false,
	preloadPackageImports: true,
	preloadRelativeImports: false,
	projectDir: process.cwd(),
	protiDir: __dirname,
	searchImportsProjectMain: true,
	searchImportsRecursively: true,
	searchImportsFrom: [],
	searchImportsExclude: [],
	showDynamicImports: false,
	showPreloadedImports: false,
	silent: false,
};
export type Config = typeof defaultConfig;
