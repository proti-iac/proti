import type { JestEnvironment } from '@jest/environment';
import type { Config } from '@jest/types';
import type { Arbitrary } from 'fast-check';
import type { IHasteFS } from 'jest-haste-map';
import type Resolver from 'jest-resolve';
import type Runtime from 'jest-runtime';
import { is } from 'typia';
import type { Config as ProtiConfig, PluginsConfig } from './config';
import type { Generator } from './generator';
import type { ModuleLoader } from './module-loader';
import { isOracle, type Oracle } from './oracle';
import type { PulumiProject } from './pulumi-project';
import { type DeepReadonly, hasMethods } from './utils';
import type { CheckResult, RunResult } from './result';

export interface Plugin {}
export type GeneratorPlugin = Arbitrary<Generator> & Plugin;
export const isGeneratorPlugin = (v: unknown): v is GeneratorPlugin =>
	is<GeneratorPlugin>(v) &&
	hasMethods(v, ['generate', 'canShrinkWithoutContext', 'shrink', 'filter', 'map', 'chain']);
export type OraclePlugin = Oracle<unknown> & Plugin;
export const isOraclePlugin = (v: unknown): v is OraclePlugin => is<OraclePlugin> && isOracle(v);

export interface PluginWithInitFn extends Plugin {
	readonly init: PluginInitFn;
}
export const isPluginWithInitFn = (v: unknown): v is PluginWithInitFn =>
	is<PluginWithInitFn>(v) && typeof v.init === 'function';
export type PluginArgs = Readonly<{
	readonly testPath: string;
	readonly cacheDir: string;
	readonly moduleLoader: ModuleLoader;
	readonly pluginsConfig: PluginsConfig;
	readonly globalConfig: DeepReadonly<Config.GlobalConfig>;
	readonly projectConfig: DeepReadonly<Config.ProjectConfig>;
	readonly environment: JestEnvironment;
	readonly resolver: Resolver;
	readonly runtime: Runtime;
	readonly hasteFS: IHasteFS;
	readonly protiConfig: ProtiConfig;
	readonly pulumiProject: PulumiProject;
}>;
export type PluginInitFn = (config: PluginArgs) => Promise<void>;

export interface PluginWithPreRunFn extends Plugin {
	readonly preRun: PluginPreRunFn;
}
export const isPluginWithPreRunFn = (v: unknown): v is PluginWithPreRunFn =>
	is<PluginWithPreRunFn>(v) && typeof v.preRun === 'function';
export type PluginPreRunArgs = {
	readonly runId: number;
};
export type PluginPreRunFn = (args: PluginPreRunArgs) => Promise<void>;

export interface PluginWithPostRunFn extends Plugin {
	readonly postRun: PluginPostRunFn;
}
export const isPluginWithPostRunFn = (v: unknown): v is PluginWithPostRunFn =>
	is<PluginWithPostRunFn>(v) && typeof v.postRun === 'function';
export type PluginPostRunArgs = {
	readonly result: RunResult;
	readonly programExports: unknown;
};
export type PluginPostRunFn = (args: PluginPostRunArgs) => Promise<void>;

export interface PluginWithShutdownFn extends Plugin {
	readonly shutdown: PluginShutdownFn;
}
export const isPluginWithShutdownFn = (v: unknown): v is PluginWithShutdownFn =>
	is<PluginWithShutdownFn>(v) && typeof v.shutdown === 'function';
export type PluginShutdownFn = (result: CheckResult) => Promise<void>;
