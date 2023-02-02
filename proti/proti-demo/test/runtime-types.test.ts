import { assertEquals } from 'typia';
import { getType } from 'rttist';
import * as aws from '@pulumi/aws';

import { OProgram, osProgram, notOsProgram } from '../src/index';

type OTests = { a: number; b: string; c: boolean[]; d: { e: null } };
const osTests = [
	{ a: 1, b: '2', c: [true], d: { e: null } } as OTests,
	{ a: 1, b: '2', c: [true], d: { e: null, f: undefined } } as OTests,
];
const notOsTests = [
	// @ts-expect-error
	{ a: '1', b: '2', c: [true], d: { e: null } } as OTests,
	// @ts-expect-error
	1 as OTests,
];

describe('typia', () => {
	describe('assert static types', () => {
		it.each(notOsTests)('should raise on tests %s', (notO) => {
			expect(() => assertEquals<OTests>(notO)).toThrow();
		});
		it.each(notOsProgram)('should raise on program %s', (notO) => {
			expect(() => assertEquals<OProgram>(notO)).toThrow();
		});
		it.each(osTests)('should pass tests %s', (o) => {
			expect(assertEquals<OTests>(o)).toBe(o);
		});
		it.each(osProgram)('should pass program %s', (o) => {
			expect(assertEquals<OProgram>(o)).toBe(o);
		});
	});

	describe('assert typeof types', () => {
		type Unpacked<T> = T extends (infer U)[] ? U : T;
		it.each(notOsTests)('should raise on tests %s', (notO) => {
			expect(() => assertEquals<Unpacked<typeof osTests>>(notO)).toThrow();
		});
		it.each(notOsProgram)('should raise on program %s', (notO) => {
			expect(() => assertEquals<Unpacked<typeof osProgram>>(notO)).toThrow();
		});
		it.each(osTests)('should pass tests %s', (o) => {
			assertEquals<Unpacked<typeof osTests>>(o);
		});
		it.each(osProgram)('should pass program %s', (o) => {
			assertEquals<Unpacked<typeof osProgram>>(o);
		});
	});

	describe('assert generic types', () => {
		// Throws already on compile: https://github.com/samchon/typia/issues/125
		// const generic = <T>(o: unknown): T => assertEquals<T>(o);
	});
});

describe('rttist', () => {
	it('should find same type for same things', () => {
		osProgram.forEach((o) => expect(getType<typeof o>()).toStrictEqual(getType<OProgram>()));
		osTests.forEach((o) => expect(getType<typeof o>()).toStrictEqual(getType<OTests>()));
	});
	it('should find different type for different things', () => {
		osProgram.forEach((o) => expect(getType<typeof o>()).not.toStrictEqual(getType<OTests>()));
		osTests.forEach((o) => expect(getType<typeof o>()).not.toStrictEqual(getType<OProgram>()));
	});

	it('should work on @pulumi/aws if type T is used with getType<T>() in program', () => {
		const t = getType<aws.s3.Bucket>();
		expect(t.isClass()).toBe(true);
		if (t.isClass()) {
			expect(t.getConstructors().length).toBe(1);
			t.getConstructors().forEach((c) => {
				expect(c.getParameters().map((p) => p.name)).toStrictEqual([
					'name',
					'args',
					'opts',
				]);
			});
		}
	});

	it('fail on @pulumi/aws if type T is not used with getType<T>() in program', () => {
		const t = getType<aws.s3.BucketMetric>();
		expect(t.isClass()).toBe(false);
	});
});
