import * as path from 'path';
import type * as fc from 'fast-check';
import { is } from 'typia';
import { defaultPluginsConfig, defaultTestCoordinatorConfig } from '../src/config';
import { TestCoordinator } from '../src/test-coordinator';
import { isOracle } from '../src/oracle';

describe('test coordinator', () => {
	const pluginConfig = defaultPluginsConfig();
	const cacheDir = 'CACHE';

	describe('loading test oracles', () => {
		const coordinatorForOracles = (oracles: string[]): TestCoordinator =>
			new TestCoordinator(
				{
					...defaultTestCoordinatorConfig(),
					oracles,
				},
				pluginConfig,
				cacheDir
			);
		const oraclePath = path.resolve(__dirname, './test-coordinator-tests/oracle');
		const initOraclePath = path.resolve(__dirname, './test-coordinator-tests/oracle-init');

		it('should not load oracles', async () => {
			const coordinator = coordinatorForOracles([]);
			expect(await coordinator.oracles).toStrictEqual([]);
		});

		it('should load oracles', async () => {
			const coordinator = coordinatorForOracles([oraclePath, oraclePath]);
			expect((await coordinator.oracles).length).toBe(2);
			(await coordinator.oracles).forEach((tc) => expect(isOracle(new tc.Ctor())).toBe(true));
		});

		it('should fail on loading non-existing oracle', () =>
			expect(() => coordinatorForOracles(['a']).oracles).rejects.toThrow(
				/Cannot find module 'a' from /
			));

		it('should init loaded oracle module', async () => {
			// eslint-disable-next-line import/no-dynamic-require, global-require
			const module = require(initOraclePath);
			expect(module.initPluginsConfig).toBe(undefined);
			expect(module.initCacheDir).toBe(undefined);
			await coordinatorForOracles([initOraclePath]).oracles;
			expect(module.initPluginsConfig).toBe(pluginConfig);
			expect(module.initCacheDir).toBe(cacheDir);
		});
	});

	describe('loading generator arbitrary', () => {
		const coordinatorForArbitrary = (arbitrary: string): TestCoordinator =>
			new TestCoordinator(
				{
					...defaultTestCoordinatorConfig(),
					arbitrary,
				},
				pluginConfig,
				cacheDir
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
			expect(module.initPluginsConfig).toBe(undefined);
			expect(module.initCacheDir).toBe(undefined);
			await coordinatorForArbitrary(initArbPath).arbitrary;
			expect(module.initPluginsConfig).toBe(pluginConfig);
			expect(module.initCacheDir).toBe(cacheDir);
		});
	});
});
