import type * as pulumi from '@pulumi/pulumi';
import type * as fc from 'fast-check';

export const gen = <T>(value: T) => {
	type GeneratorArbitrary = T extends pulumi.Output<infer S>
		? fc.Arbitrary<T | S>
		: fc.Arbitrary<T>;
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	return { with: (arbitrary: GeneratorArbitrary): T => value };
};
