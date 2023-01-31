import { assertEquals } from 'typia';

type O = { a: number; b: string; c: boolean[]; d: { e: null } };
const os = [
	{ a: 1, b: '2', c: [true], d: { e: null } } as O,
	{ a: 1, b: '2', c: [true], d: { e: null, f: undefined } } as O,
];
const notOs = [
	// @ts-expect-error
	{ a: '1', b: '2', c: [true], d: { e: null } } as O,
	// @ts-expect-error
	1 as O,
];

describe('typia', () => {
	describe('static types', () => {
		it.each(notOs)('should raise on 1 %s', (notO) => {
			expect(() => assertEquals<O>(notO)).toThrow();
		});
		it.each(os)('should pass %s', (o) => {
			expect(assertEquals<O>(o)).toBe(o);
		});
	});

	describe('typeof types', () => {
		type Unpacked<T> = T extends (infer U)[] ? U : T;
		it.each(notOs)('should raise on %s', (notO) => {
			expect(() => assertEquals<Unpacked<typeof os>>(notO)).toThrow();
		});
		it.each(os)('should pass %s', (o) => {
			assertEquals<Unpacked<typeof os>>(o);
		});
	});

	describe('generic types', () => {
		// Throw already on compile: https://github.com/samchon/typia/issues/125
		// const generic = <T>(o: unknown): T => assertEquals<T>(o);
	});
});
