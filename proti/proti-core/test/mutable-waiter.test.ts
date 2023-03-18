import fc from 'fast-check';
import { MutableWaiter } from '../src/mutable-waiter';

describe('Mutable Waiter', () => {
	it('should complete if all resolved', () =>
		fc.assert(
			fc.asyncProperty(fc.nat({ max: 100 }), fc.nat({ max: 100 }), async (errs, succs) => {
				const waiter = new MutableWaiter();
				const errors = new Array(errs).fill(new Error());
				errors.forEach((err) => waiter.wait(Promise.reject(err)));
				new Array(succs).fill(waiter.wait(Promise.resolve()));
				return expect(waiter.isCompleted()).resolves.toStrictEqual(errors);
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
				return expect(completed).resolves.toStrictEqual([]);
			})
		));

	it('should throw on add after completion', async () => {
		const waiter = new MutableWaiter();
		await expect(waiter.isCompleted()).resolves.toStrictEqual([]);
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
			fc.asyncProperty(
				fc.nat({ max: 100 }),
				fc.nat({ max: 100 }),
				fc.nat({ max: 100 }),
				async (errs1, errs2, succs2) => {
					const waiter = new MutableWaiter();
					const errors1 = new Array(errs1).fill(new Error());
					errors1.forEach((err) => waiter.wait(Promise.reject(err)));
					await expect(waiter.isCompleted()).resolves.toStrictEqual(errors1);
					waiter.reset();
					const errors2 = new Array(errs2).fill(new Error());
					errors2.forEach((err) => waiter.wait(Promise.reject(err)));
					new Array(succs2).fill(waiter.wait(Promise.resolve()));
					return expect(waiter.isCompleted()).resolves.toStrictEqual(errors2);
				}
			)
		));
});
