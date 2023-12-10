import type { PluginsConfig } from './config';
import type { ModuleLoader } from './module-loader';

export type PluginArgs = Readonly<{
	readonly testPath: string;
	readonly cacheDir: string;
	readonly moduleLoader: ModuleLoader;
	readonly pluginsConfig: PluginsConfig;
}>;
export type PluginInitFn = (config: PluginArgs) => Promise<void>;
