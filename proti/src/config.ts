export const defaultConfig = {
	projectDir: process.cwd(),
	protiDir: __dirname,
	showDynamicallyLoadedModules: false,
	silent: false,
};
export type Config = typeof defaultConfig;
