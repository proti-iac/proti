import type * as pulumi from '@pulumi/pulumi';
import type * as fc from 'fast-check';

export const gen = <T>(value: T) => ({
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	with: <S extends T extends pulumi.Output<infer U> ? T | U : T>(arbitrary: fc.Arbitrary<S>): T =>
		value,
});
