import { type ShouldInstrumentOptions, createScriptTransformer } from '@jest/transform';
import type { Config } from '@jest/types';
import {
	ModuleLoader,
	PluginArgs,
	type PluginWithInitFn,
	type ResourceOracle,
	type TestResult,
} from '@proti-iac/core';
import Runtime from 'jest-runtime';

/**
 * Simple {@link ResourceOracle} demonstrating a ProTI plugin with an isolated Jest runtime.
 */
export class DemoIsolatedRuntimePlugin implements ResourceOracle<null>, PluginWithInitFn {
	readonly name = 'Demo Isolated Runtime';

	readonly description =
		'An oracle plugin demonstrating a ProTI plugin with an isolated Jest runtime';

	// eslint-disable-next-line class-methods-use-this
	readonly newRunState = () => null;

	// eslint-disable-next-line class-methods-use-this
	readonly validateResource = (): TestResult => undefined;

	// eslint-disable-next-line class-methods-use-this
	readonly init = async ({
		globalConfig,
		projectConfig,
		environment,
		resolver,
		testPath,
		hasteFS,
		protiConfig,
		pulumiProject,
	}: PluginArgs) => {
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
}
export default DemoIsolatedRuntimePlugin;
