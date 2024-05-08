import * as path from 'path';
import { defaultPluginsConfig, defaultTestCoordinatorConfig } from '../src/config';
import type { ModuleLoader } from '../src/module-loader';
import { isGeneratorPlugin, isOraclePlugin, type PluginArgs } from '../src/plugin';
import { TestCoordinator } from '../src/test-coordinator';
import type { CheckResult } from '../src/result';

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

		it('should init loaded oracle plugin', async () => {
			const initOraclePath = path.resolve(__dirname, './test-coordinator-tests/oracle-init');
			// eslint-disable-next-line import/no-dynamic-require, global-require
			const module = require(initOraclePath);
			const coordinator = await TestCoordinator.create(
				{ ...defaultTestCoordinatorConfig(), oracles: [initOraclePath] },
				pluginArgs
			);
			expect(coordinator.pluginInitFns.length).toBe(1);
			expect(module.config).toBeUndefined();
			await coordinator.init();
			expect(module.config).toBe(pluginArgs);
		});

		it('should shutdown loaded oracle plugin', async () => {
			const oraclePath = path.resolve(__dirname, './test-coordinator-tests/oracle-shutdown');
			// eslint-disable-next-line import/no-dynamic-require, global-require
			const module = require(oraclePath);
			const coordinator = await TestCoordinator.create(
				{ ...defaultTestCoordinatorConfig(), oracles: [oraclePath] },
				pluginArgs
			);
			expect(coordinator.pluginShutdownFns.length).toBe(1);
			expect(module.result).toBeUndefined();
			await coordinator.shutdown(result);
			expect(module.result).toBe(result);
		});
	});

	describe('loading generator plugin', () => {
		const arbPath = path.resolve(__dirname, './test-coordinator-tests/generator');
		const initArbPath = path.resolve(__dirname, './test-coordinator-tests/generator-init');
		const shutArbPath = path.resolve(__dirname, './test-coordinator-tests/generator-shutdown');

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

		it('should init loaded generator plugin', async () => {
			// eslint-disable-next-line import/no-dynamic-require, global-require
			const module = require(initArbPath);
			const coordinator = await await TestCoordinator.create(
				{ ...defaultTestCoordinatorConfig(), generator: initArbPath },
				pluginArgs
			);
			expect(coordinator.pluginInitFns.length).toBe(1);
			expect(module.config).toBeUndefined();
			await coordinator.init();
			expect(module.config).toBe(pluginArgs);
		});

		it('should shutdown loaded generator plugin', async () => {
			// eslint-disable-next-line import/no-dynamic-require, global-require
			const module = require(shutArbPath);
			const coordinator = await TestCoordinator.create(
				{ ...defaultTestCoordinatorConfig(), generator: shutArbPath },
				pluginArgs
			);
			expect(coordinator.pluginShutdownFns.length).toBe(1);
			expect(module.result).toBeUndefined();
			await coordinator.shutdown(result);
			expect(module.result).toBe(result);
		});
	});
});
