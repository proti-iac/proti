import { isSet, Set } from 'immutable';
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
	preload: Set(['@pulumi/pulumi', '@pulumi/pulumi/runtime/stack']),
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

/**
 * Version of `Config` that only uses datatypes that are available in JSON.
 */
export type PrimitiveConfig = {
	[K in keyof Config]: Config[K] extends Set<infer T> ? T[] : Config[K];
};

export const toPrimitiveConfig = (config: Config): PrimitiveConfig =>
	Object.fromEntries(
		Object.entries(config).map(([k, v]) => [k, isSet(v) ? v.toArray() : v])
	) as PrimitiveConfig;

export const fromPrimitiveConfig = (config: PrimitiveConfig): Config =>
	Object.fromEntries(
		Object.entries(config).map(([k, v]) => [k, Array.isArray(v) ? Set(v) : v])
	) as Config;
