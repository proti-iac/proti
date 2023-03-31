import { defaultTestCoordinatorConfig } from '../src/config';
import { TestCoordinator } from '../src/test-coordinator';
import { isTest } from '../src/tests';

describe('test coordinator', () => {
	describe('loading test classes', () => {
		it('should not load test classes', async () => {
			const coordinator = new TestCoordinator(
				{
					...defaultTestCoordinatorConfig(),
					tests: [],
				},
				200
			);
			await coordinator.isReady;
			expect(coordinator.testClasses).toStrictEqual([]);
		});

		it('should load test classes', async () => {
			const coordinator = new TestCoordinator(defaultTestCoordinatorConfig(), 500);
			await coordinator.isReady;
			expect(coordinator.testClasses.length).toBeGreaterThan(0);
			coordinator.testClasses.forEach((tc) => expect(isTest(new tc.Ctor())).toBe(true));
		});
	});
});
