import { type ShouldInstrumentOptions, createScriptTransformer } from '@jest/transform';
import type { Config } from '@jest/types';
import {
	type ResourceOracle,
	type TestResult,
	type PluginInitFn,
	ModuleLoader,
} from '@proti-iac/core';
import Runtime from 'jest-runtime';

/**
 * Simple {@link ResourceOracle} emonstrating a ProTI plugin with an isolated Jest runtime.
 */
export class DemoIsolatedRuntime implements ResourceOracle<null> {
	name = 'Demo Isolated Runtime';

	description = 'An oracle plugin demonstrating a ProTI plugin with an isolated Jest runtime';

	// eslint-disable-next-line class-methods-use-this
	newRunState = () => null;

	// eslint-disable-next-line class-methods-use-this
	validateResource = (): TestResult => undefined;
}

export default DemoIsolatedRuntime;

// eslint-disable-next-line jsdoc/require-param
/**
 * Initialization method called when the oracle is loaded.
 */
export const init: PluginInitFn = async ({
	globalConfig,
	projectConfig,
	environment,
	resolver,
	testPath,
	hasteFS,
	protiConfig,
	pulumiProject,
}) => {
	const cacheFS = new Map();
	const coverageOptions: ShouldInstrumentOptions = {
		collectCoverage: globalConfig.collectCoverage,
		collectCoverageFrom: globalConfig.collectCoverageFrom as string[],
		coverageProvider: globalConfig.coverageProvider,
	};
	const transformer = await createScriptTransformer(
		projectConfig as Config.ProjectConfig,
		cacheFS
	);
	const runtime = new Runtime(
		projectConfig as Config.ProjectConfig,
		environment,
		resolver,
		transformer,
		cacheFS,
		coverageOptions,
		testPath,
		globalConfig as Config.GlobalConfig
	);
	const modLoader = await ModuleLoader.create(
		projectConfig,
		protiConfig.moduleLoading,
		runtime,
		resolver,
		hasteFS,
		pulumiProject.main
	);
	// Run program in isolated environment
	await modLoader.execProgram();
};
