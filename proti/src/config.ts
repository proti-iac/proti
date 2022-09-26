import { Set } from 'immutable';
import { PreloaderConfig as ModulePreloaderConfig } from './module-preloader';

export type CliConfig = { jest: string; showConfig: boolean; silent: boolean };

export type ProjectConfig = {
	projectDir: string;
	protiDir: string;
};

export type VerbosityConfig = {
	showDynamicImports: boolean;
	showPreloadedImports: boolean;
	silent: boolean;
};

export type Config = CliConfig & ModulePreloaderConfig & ProjectConfig & VerbosityConfig;
export const defaultConfig: Config = {
	jest: '',
	preload: Set(['@pulumi/pulumi']),
	preloadAbsoluteImports: false,
	preloadPackageImports: true,
	preloadRelativeImports: false,
	projectDir: process.cwd(),
	protiDir: __dirname,
	searchImportsProjectMain: true,
	searchImportsRecursively: true,
	searchImportsFrom: Set<string>(),
	searchImportsExclude: Set<string>(),
	showConfig: false,
	showDynamicImports: false,
	showPreloadedImports: false,
	silent: false,
};
