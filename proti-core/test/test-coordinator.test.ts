import * as path from 'path';
import type * as fc from 'fast-check';
import { is } from 'typia';
import { defaultPluginsConfig, defaultTestCoordinatorConfig } from '../src/config';
import type { ModuleLoader } from '../src/module-loader';
import { isOracle } from '../src/oracle';
import type { PluginArgs } from '../src/plugin';
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

	describe('loading test oracles', () => {
		it('should not load oracles', async () => {
			const coordinator = await TestCoordinator.create(
				{ ...defaultTestCoordinatorConfig(), oracles: [] },
				pluginArgs
			);
			Object.values(coordinator.oracles).forEach((oracles) => expect(oracles.length).toBe(0));
			expect(coordinator.pluginShutdownFns).toStrictEqual([]);
		});

		type OracleTypes = 'resource' | 'asyncResource' | 'deployment' | 'asyncDeployment';
		it.each<readonly [string, readonly string[], readonly OracleTypes[]]>([
			['resource', ['resource-oracle'], ['resource']],
			['async resource', ['async-resource-oracle'], ['asyncResource']],
			['deployment', ['deployment-oracle'], ['deployment']],
			['async deployment', ['async-deployment-oracle'], ['asyncDeployment']],
			['combined', ['combined-oracle'], ['resource', 'asyncDeployment']],
		])('should load %s oracle', async (_, files, types) => {
			const coordinator = await TestCoordinator.create(
				{
					...defaultTestCoordinatorConfig(),
					oracles: files.map((file) =>
						path.resolve(__dirname, './test-coordinator-tests/', file)
					),
				},
				pluginArgs
			);
			Object.entries(coordinator.oracles).forEach(([type, orcls]) => {
				expect(orcls.length).toBe(types.includes(type as OracleTypes) ? 1 : 0);
				orcls.forEach((oracle: unknown) => expect(isOracle(oracle)).toBe(true));
			});
		});

		it('should fail on loading non-existing oracle', () => {
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
			expect(module.config).toBe(undefined);
			await TestCoordinator.create(
				{ ...defaultTestCoordinatorConfig(), oracles: [initOraclePath] },
				pluginArgs
			);
			expect(module.config).toBe(pluginArgs);
		});

		it('should shutdown loaded generator plugin', async () => {
			const oraclePath = path.resolve(__dirname, './test-coordinator-tests/oracle-shutdown');
			// eslint-disable-next-line import/no-dynamic-require, global-require
			const module = require(oraclePath);
			const coordinator = await TestCoordinator.create(
				{ ...defaultTestCoordinatorConfig(), arbitrary: oraclePath },
				pluginArgs
			);
			expect(coordinator.pluginShutdownFns.length).toBe(1);
			expect(module.result).toBeUndefined();
			await coordinator.shutdown(result);
			expect(module.result).toBe(result);
		});
	});

	describe('loading generator arbitrary', () => {
		const arbPath = path.resolve(__dirname, './test-coordinator-tests/arbitrary');
		const initArbPath = path.resolve(__dirname, './test-coordinator-tests/arbitrary-init');
		const shutArbPath = path.resolve(__dirname, './test-coordinator-tests/arbitrary-shutdown');

		it('should load arbitrary', async () => {
			const coordinator = await TestCoordinator.create(
				{ ...defaultTestCoordinatorConfig(), arbitrary: arbPath },
				pluginArgs
			);
			expect(is<fc.Arbitrary<Generator>>(coordinator.generatorArbitrary)).toBe(true);
			expect(coordinator.pluginShutdownFns).toStrictEqual([]);
		});

		it('should fail on loading non-existing arbitrary', () => {
			const coordinator = TestCoordinator.create(
				{ ...defaultTestCoordinatorConfig(), arbitrary: 'a' },
				pluginArgs
			);
			expect(coordinator).rejects.toThrow(/Cannot find module 'a' from /);
		});

		it('should init loaded generator plugin', async () => {
			// eslint-disable-next-line import/no-dynamic-require, global-require
			const module = require(initArbPath);
			expect(module.config).toBe(undefined);
			await TestCoordinator.create(
				{ ...defaultTestCoordinatorConfig(), arbitrary: initArbPath },
				pluginArgs
			);
			expect(module.config).toBe(pluginArgs);
		});

		it('should shutdown loaded generator plugin', async () => {
			// eslint-disable-next-line import/no-dynamic-require, global-require
			const module = require(shutArbPath);
			const coordinator = await TestCoordinator.create(
				{ ...defaultTestCoordinatorConfig(), arbitrary: shutArbPath },
				pluginArgs
			);
			expect(coordinator.pluginShutdownFns.length).toBe(1);
			expect(module.result).toBeUndefined();
			await coordinator.shutdown(result);
			expect(module.result).toBe(result);
		});
	});
});
