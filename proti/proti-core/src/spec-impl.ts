import type { Output } from '@pulumi/pulumi';
import * as ps from '@proti/spec';
import { stringify } from 'typia';
import { Generator } from './generator';
import { popErrStack } from './utils';

export const createSpecImpl = (generator: Generator): typeof ps => ({
	...ps,
	expect: <T>(value: T) => ({
		to: (predicate: (value: T) => boolean | Promise<boolean>): T => {
			// Instantiate error here to capture call stack
			const error = new Error();
			Promise.resolve(predicate(value))
				.catch((err) => {
					error.message = `Ad-hoc specification rejected expecting '${value}' to '${predicate}`;
					error.cause = err;
					throw popErrStack(error);
				})
				.then((result: boolean) => {
					if (result === false) {
						error.message = `Ad-hoc specification found 🐞: expected '${value}' to '${predicate}'`;
						throw popErrStack(error);
					}
				});
			return value;
		},
	}),
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	generate: <T>(value: T) => {
		type S = T extends Output<infer U> ? T | U : T;
		return {
			with: (arbitrary: ps.Arbitrary<S>): S => {
				// Instantiate error here to capture call stack
				const specLocation = new Error().stack?.match(
					/(?:[^\n]*\n){2}[^\n]*\(([^\n\\(\\)]+)\)/
				);
				return generator.generateValue(
					`ad-hoc-oracle::${specLocation ? specLocation[1] : stringify(arbitrary)}`,
					arbitrary
				);
			},
		};
	},
});
