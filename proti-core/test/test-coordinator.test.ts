import * as path from 'path';
import type * as fc from 'fast-check';
import { is } from 'typia';
import { defaultPluginsConfig, defaultTestCoordinatorConfig } from '../src/config';
import type { ModuleLoader } from '../src/module-loader';
import { isOracle } from '../src/oracle';
import { TestCoordinator, TestModuleConfig } from '../src/test-coordinator';

describe('test coordinator', () => {
	const testModuleConfig: TestModuleConfig = {
		moduleLoader: new (jest.fn<ModuleLoader, []>())(),
		pluginsConfig: defaultPluginsConfig(),
		testPath: 'TEST_PATH',
		cacheDir: 'CACHE',
	};

	describe('loading test oracles', () => {
		const coordinatorForOracles = (oracles: string[]): TestCoordinator =>
			new TestCoordinator({ ...defaultTestCoordinatorConfig(), oracles }, testModuleConfig);

		it('should not load oracles', async () => {
			const coordinator = coordinatorForOracles([]);
			Object.entries(await coordinator.oracles).forEach(([, oracles]) =>
				expect(oracles.length).toBe(0)
			);
		});

		type OracleTypes = 'resource' | 'asyncResource' | 'deployment' | 'asyncDeployment';
		it.each<readonly [string, readonly string[], readonly OracleTypes[]]>([
			['resource', ['resource-oracle'], ['resource']],
			['async resource', ['async-resource-oracle'], ['asyncResource']],
			['deployment', ['deployment-oracle'], ['deployment']],
			['async deployment', ['async-deployment-oracle'], ['asyncDeployment']],
			['combined', ['combined-oracle'], ['resource', 'asyncDeployment']],
		])('should load %s oracle', async (_, files, types) => {
			const coordinator = coordinatorForOracles(
				files.map((file) => path.resolve(__dirname, './test-coordinator-tests/', file))
			);
			Object.entries(await coordinator.oracles).forEach(([type, oracles]) => {
				expect(oracles.length).toBe(types.includes(type as OracleTypes) ? 1 : 0);
				oracles.forEach((oracle: unknown) => expect(isOracle(oracle)).toBe(true));
			});
		});

		it('should fail on loading non-existing oracle', () =>
			expect(() => coordinatorForOracles(['a']).oracles).rejects.toThrow(
				/Cannot find module 'a' from /
			));

		it('should init loaded oracle module', async () => {
			const initOraclePath = path.resolve(__dirname, './test-coordinator-tests/oracle-init');
			// eslint-disable-next-line import/no-dynamic-require, global-require
			const module = require(initOraclePath);
			expect(module.config).toBe(undefined);
			await coordinatorForOracles([initOraclePath]).oracles;
			expect(module.config).toBe(testModuleConfig);
		});
	});

	describe('loading generator arbitrary', () => {
		const coordinatorForArbitrary = (arbitrary: string): TestCoordinator =>
			new TestCoordinator(
				{
					...defaultTestCoordinatorConfig(),
					arbitrary,
				},
				testModuleConfig
			);
		const arbPath = path.resolve(__dirname, './test-coordinator-tests/arbitrary');
		const initArbPath = path.resolve(__dirname, './test-coordinator-tests/arbitrary-init');

		it('should load arbitrary', async () => {
			const coordinator = coordinatorForArbitrary(arbPath);
			expect(is<fc.Arbitrary<Generator>>(await coordinator.arbitrary)).toBe(true);
		});

		it('should fail on loading non-existing arbitrary', () =>
			expect(() => coordinatorForArbitrary('a').arbitrary).rejects.toThrow(
				/Cannot find module 'a' from /
			));

		it('should init loaded arbitrary module', async () => {
			// eslint-disable-next-line import/no-dynamic-require, global-require
			const module = require(initArbPath);
			expect(module.config).toBe(undefined);
			await coordinatorForArbitrary(initArbPath).arbitrary;
			expect(module.config).toBe(testModuleConfig);
		});
	});
});
