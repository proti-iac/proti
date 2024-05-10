import * as path from 'path';
import {
	defaultPluginsConfig,
	defaultTestCoordinatorConfig,
	type TestCoordinatorConfig,
} from '../src/config';
import type { Generator } from '../src/generator';
import type { ModuleLoader } from '../src/module-loader';
import {
	isGeneratorPlugin,
	isOraclePlugin,
	type PluginPostRunArgs,
	type PluginPreRunArgs,
	type PluginArgs,
} from '../src/plugin';
import type { CheckResult } from '../src/result';
import { TestCoordinator } from '../src/test-coordinator';

describe('test coordinator', () => {
	const pluginArgs = {
		moduleLoader: new (jest.fn<ModuleLoader, []>())(),
		pluginsConfig: defaultPluginsConfig(),
		testPath: 'TEST_PATH',
		cacheDir: 'CACHE',
	} as PluginArgs;
	const result = {} as CheckResult;

	describe('loading test oracle plugins', () => {
		it('should not load oracle plugins', async () => {
			const coordinator = await TestCoordinator.create(
				{ ...defaultTestCoordinatorConfig(), oracles: [] },
				pluginArgs
			);
			Object.values(coordinator.oraclePlugins).forEach((oracles) =>
				expect(oracles.length).toBe(0)
			);
			expect(coordinator.pluginInitFns).toStrictEqual([]);
			expect(coordinator.pluginShutdownFns).toStrictEqual([]);
		});

		type OracleTypes = 'resource' | 'asyncResource' | 'deployment' | 'asyncDeployment';
		it.each<readonly [string, readonly string[], readonly OracleTypes[]]>([
			['resource', ['resource-oracle'], ['resource']],
			['async resource', ['async-resource-oracle'], ['asyncResource']],
			['deployment', ['deployment-oracle'], ['deployment']],
			['async deployment', ['async-deployment-oracle'], ['asyncDeployment']],
			['combined', ['combined-oracle'], ['resource', 'asyncDeployment']],
		])('should load %s oracle plugin', async (_, files, types) => {
			const coordinator = await TestCoordinator.create(
				{
					...defaultTestCoordinatorConfig(),
					oracles: files.map((file) =>
						path.resolve(__dirname, './test-coordinator-tests/', file)
					),
				},
				pluginArgs
			);
			Object.entries(coordinator.oraclePlugins).forEach(([type, orcls]) => {
				expect(orcls.length).toBe(types.includes(type as OracleTypes) ? 1 : 0);
				orcls.forEach((oracle: unknown) => expect(isOraclePlugin(oracle)).toBe(true));
			});
		});

		it('should fail on loading non-existing oracle plugin', () => {
			const coordinator = TestCoordinator.create(
				{ ...defaultTestCoordinatorConfig(), oracles: ['a'] },
				pluginArgs
			);
			expect(coordinator).rejects.toThrow(/Cannot find module 'a' from /);
		});
	});

	describe('loading generator plugin', () => {
		const arbPath = path.resolve(__dirname, './test-coordinator-tests/generator');

		it('should load generator plugin', async () => {
			const coordinator = await TestCoordinator.create(
				{ ...defaultTestCoordinatorConfig(), generator: arbPath },
				pluginArgs
			);
			expect(isGeneratorPlugin(coordinator.generatorPlugin)).toBe(true);
			expect(coordinator.pluginInitFns).toStrictEqual([]);
			expect(coordinator.pluginShutdownFns).toStrictEqual([]);
		});

		it('should fail on loading non-existing generator plugin', () => {
			const coordinator = TestCoordinator.create(
				{ ...defaultTestCoordinatorConfig(), generator: 'a' },
				pluginArgs
			);
			expect(coordinator).rejects.toThrow(/Cannot find module 'a' from /);
		});
	});

	describe('plugin test lifecycle hooks', () => {
		const pluginConfigs: Partial<TestCoordinatorConfig>[] = [
			{ generator: path.resolve(__dirname, './test-coordinator-tests/generator-lifecycle') },
			{ oracles: [path.resolve(__dirname, './test-coordinator-tests/oracle-lifecycle')] },
		];
		const initCoord = async (
			pluginConfig: Partial<TestCoordinatorConfig>
		): Promise<[TestCoordinator, any]> => {
			const plugin: string =
				pluginConfig.generator ||
				(pluginConfig.oracles && pluginConfig.oracles[0] ? pluginConfig.oracles[0] : '');
			const module = await import(plugin);
			const coordinator = await TestCoordinator.create(
				{ ...defaultTestCoordinatorConfig(), ...pluginConfig },
				pluginArgs
			);
			return [coordinator, module];
		};

		it.each(pluginConfigs)('should init plugin %s', async (pluginConfig) => {
			const [coordinator, module] = await initCoord(pluginConfig);
			expect(coordinator.pluginInitFns.length).toBe(1);
			expect(module.config).toBeUndefined();
			await coordinator.init();
			expect(module.config).toBe(pluginArgs);
		});

		it.each(pluginConfigs)('should call preRun in plugin %s', async (pluginConfig) => {
			const [coordinator, module] = await initCoord(pluginConfig);
			expect(coordinator.pluginPreRunFns.length).toBe(1);
			expect(module.preRunArgs).toBeUndefined();
			const preRunArgs: PluginPreRunArgs = { runId: 123 };
			await coordinator.newRunCoordinator({} as Generator).preRun(preRunArgs);
			expect(module.preRunArgs).toBe(preRunArgs);
		});

		it.each(pluginConfigs)('should call postRun in  plugin %s', async (pluginConfig) => {
			const [coordinator, module] = await initCoord(pluginConfig);
			expect(coordinator.pluginPostRunFns.length).toBe(1);
			expect(module.postRunArgs).toBeUndefined();
			const postRunArgs = {} as PluginPostRunArgs;
			await coordinator.newRunCoordinator({} as Generator).postRun(postRunArgs);
			expect(module.postRunArgs).toBe(postRunArgs);
		});

		it.each(pluginConfigs)('should shutdown plugin %s', async (pluginConfig) => {
			const [coordinator, module] = await initCoord(pluginConfig);
			expect(coordinator.pluginShutdownFns.length).toBe(1);
			expect(module.result).toBeUndefined();
			await coordinator.shutdown(result);
			expect(module.result).toBe(result);
		});
	});
});
