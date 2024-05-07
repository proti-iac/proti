import type { JestEnvironment } from '@jest/environment';
import type { Config } from '@jest/types';
import type { IHasteFS } from 'jest-haste-map';
import type Resolver from 'jest-resolve';
import type Runtime from 'jest-runtime';
import type { Config as ProtiConfig, PluginsConfig } from './config';
import type { ModuleLoader } from './module-loader';
import type { PulumiProject } from './pulumi-project';
import type { DeepReadonly } from './utils';

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
