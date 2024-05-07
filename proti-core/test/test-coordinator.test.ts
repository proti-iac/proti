import * as path from 'path';
import type * as fc from 'fast-check';
import { is } from 'typia';
import { defaultPluginsConfig, defaultTestCoordinatorConfig } from '../src/config';
import type { ModuleLoader } from '../src/module-loader';
import { isOracle } from '../src/oracle';
import type { PluginArgs } from '../src/plugin';
import { TestCoordinator } from '../src/test-coordinator';

describe('test coordinator', () => {
	const pluginArgs = {
		moduleLoader: new (jest.fn<ModuleLoader, []>())(),
		pluginsConfig: defaultPluginsConfig(),
		testPath: 'TEST_PATH',
		cacheDir: 'CACHE',
	} as PluginArgs;

	describe('loading test oracles', () => {
		it('should not load oracles', async () => {
			Object.entries(
				await TestCoordinator.loadOracles(
					{ ...defaultTestCoordinatorConfig(), oracles: [] },
					pluginArgs
				)
			).forEach(([, oracles]) => expect(oracles.length).toBe(0));
		});

		type OracleTypes = 'resource' | 'asyncResource' | 'deployment' | 'asyncDeployment';
		it.each<readonly [string, readonly string[], readonly OracleTypes[]]>([
			['resource', ['resource-oracle'], ['resource']],
			['async resource', ['async-resource-oracle'], ['asyncResource']],
			['deployment', ['deployment-oracle'], ['deployment']],
			['async deployment', ['async-deployment-oracle'], ['asyncDeployment']],
			['combined', ['combined-oracle'], ['resource', 'asyncDeployment']],
		])('should load %s oracle', async (_, files, types) => {
			const oracles = await TestCoordinator.loadOracles(
				{
					...defaultTestCoordinatorConfig(),
					oracles: files.map((file) =>
						path.resolve(__dirname, './test-coordinator-tests/', file)
					),
				},
				pluginArgs
			);
			Object.entries(oracles).forEach(([type, orcls]) => {
				expect(orcls.length).toBe(types.includes(type as OracleTypes) ? 1 : 0);
				orcls.forEach((oracle: unknown) => expect(isOracle(oracle)).toBe(true));
			});
		});

		it('should fail on loading non-existing oracle', () => {
			const oracles = TestCoordinator.loadOracles(
				{ ...defaultTestCoordinatorConfig(), oracles: ['a'] },
				pluginArgs
			);
			expect(oracles).rejects.toThrow(/Cannot find module 'a' from /);
		});

		it('should init loaded oracle module', async () => {
			const initOraclePath = path.resolve(__dirname, './test-coordinator-tests/oracle-init');
			// eslint-disable-next-line import/no-dynamic-require, global-require
			const module = require(initOraclePath);
			expect(module.config).toBe(undefined);
			await TestCoordinator.loadOracles(
				{ ...defaultTestCoordinatorConfig(), oracles: [initOraclePath] },
				pluginArgs
			);
			expect(module.config).toBe(pluginArgs);
		});
	});

	describe('loading generator arbitrary', () => {
		const arbPath = path.resolve(__dirname, './test-coordinator-tests/arbitrary');
		const initArbPath = path.resolve(__dirname, './test-coordinator-tests/arbitrary-init');

		it('should load arbitrary', async () => {
			const arb = await TestCoordinator.loadArbitrary(
				{ ...defaultTestCoordinatorConfig(), arbitrary: arbPath },
				pluginArgs
			);
			expect(is<fc.Arbitrary<Generator>>(arb)).toBe(true);
		});

		it('should fail on loading non-existing arbitrary', () => {
			const arb = TestCoordinator.loadArbitrary(
				{ ...defaultTestCoordinatorConfig(), arbitrary: 'a' },
				pluginArgs
			);
			expect(arb).rejects.toThrow(/Cannot find module 'a' from /);
		});

		it('should init loaded arbitrary module', async () => {
			// eslint-disable-next-line import/no-dynamic-require, global-require
			const module = require(initArbPath);
			expect(module.config).toBe(undefined);
			await TestCoordinator.loadArbitrary(
				{ ...defaultTestCoordinatorConfig(), arbitrary: initArbPath },
				pluginArgs
			);
			expect(module.config).toBe(pluginArgs);
		});
	});
});
