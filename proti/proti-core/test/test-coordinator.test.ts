import { defaultTestCoordinatorConfig } from '../src/config';
import { TestCoordinator } from '../src/test-coordinator';
import { isOracle } from '../src/oracle';

describe('test coordinator', () => {
	describe('loading test oracles', () => {
		it('should not load oracles', async () => {
			const coordinator = new TestCoordinator({
				...defaultTestCoordinatorConfig(),
				oracles: [],
			});
			expect(await coordinator.oracles).toStrictEqual([]);
		});

		it('should load oracles', async () => {
			const coordinator = new TestCoordinator(defaultTestCoordinatorConfig());
			expect((await coordinator.oracles).length).toBeGreaterThan(0);
			(await coordinator.oracles).forEach((tc) => expect(isOracle(new tc.Ctor())).toBe(true));
		});
	});
});