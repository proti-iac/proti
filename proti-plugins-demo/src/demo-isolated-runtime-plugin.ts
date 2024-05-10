import {
	createScriptTransformer,
	type ScriptTransformer,
	type ShouldInstrumentOptions,
} from '@jest/transform';
import type { Config } from '@jest/types';
import {
	ModuleLoader,
	PluginArgs,
	type PluginWithInitFn,
	type ResourceOracle,
	type TestResult,
} from '@proti-iac/core';
import Runtime from 'jest-runtime';
import path from 'path';

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
		const manipulatedConfig: Config.ProjectConfig = {
			...(projectConfig as Config.ProjectConfig),
			// Replace all configured transformers with the demo transformer for the isolated environment
			transform: projectConfig.transform.map(([pattern]) => [
				pattern,
				path.join(__dirname, '/demo-transformer.js'),
				{},
			]),
		};
		const transformer: ScriptTransformer = await createScriptTransformer(
			manipulatedConfig,
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
		console.info('Running program in isolated runtime of demo ProTI plugin');
		await modLoader.execProgram();
		console.info('Completed running program in isolated runtime of demo ProTI plugin');
	};
}
export default DemoIsolatedRuntimePlugin;
