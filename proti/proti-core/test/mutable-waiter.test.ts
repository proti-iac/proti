import fc from 'fast-check';
import { MutableWaiter } from '../src/mutable-waiter';

describe('Mutable Waiter', () => {
	it('should complete if all resolved', () =>
		fc.assert(
			fc.asyncProperty(fc.nat({ max: 1000 }), async (n) => {
				const waiter = new MutableWaiter();
				new Array(n).fill(waiter.wait(Promise.resolve()));
				return expect(waiter.isCompleted()).resolves.toBe(undefined);
			})
		));

	it('should complete if not resolved yet', () =>
		fc.assert(
			fc.asyncProperty(fc.nat({ max: 1000 }), async (n) => {
				const waiter = new MutableWaiter();
				const resolves = new Array(n)
					.fill(() => {
						const r = { resolve: undefined as ((v: any) => void) | undefined };
						waiter.wait(
							new Promise((resolve) => {
								r.resolve = resolve;
							})
						);
						return r;
					})
					.map((f) => f());
				const completed = waiter.isCompleted();
				resolves.forEach((resolve) => resolve.resolve());
				return expect(completed).resolves.toBe(undefined);
			})
		));

	it('should throw on add after completion', async () => {
		const waiter = new MutableWaiter();
		await expect(waiter.isCompleted()).resolves.toBe(undefined);
		expect(() => waiter.wait(Promise.resolve())).toThrow(
			'Adding promise to waiter after completing'
		);
	});

	it('should return same completion promise', async () => {
		const waiter = new MutableWaiter();
		expect(waiter.isCompleted()).toBe(waiter.isCompleted());
	});

	it('should return different completion promise after reset', async () => {
		const waiter = new MutableWaiter();
		const prevCompleted = waiter.isCompleted();
		waiter.reset();
		expect(waiter.isCompleted()).not.toBe(prevCompleted);
	});

	it('should work after reset', () =>
		fc.assert(
			fc.asyncProperty(fc.nat({ max: 1000 }), async (n) => {
				const waiter = new MutableWaiter();
				await expect(waiter.isCompleted()).resolves.toBe(undefined);
				waiter.reset();
				new Array(n).fill(waiter.wait(Promise.resolve()));
				return expect(waiter.isCompleted()).resolves.toBe(undefined);
			})
		));
});
