import { Set } from 'immutable';

export type PreloaderConfig = {
	preload: Set<string>;
	preloadAbsoluteImports: boolean;
	preloadPackageImports: boolean;
	preloadRelativeImports: boolean;
	projectDir: string;
	searchImportsProjectMain: boolean;
	searchImportsRecursively: boolean;
	searchImportsFrom: Set<string>;
	searchImportsExclude: Set<string>;
};
