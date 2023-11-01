import { Output, output } from '@pulumi/pulumi';
import * as ps from '@proti-iac/spec';
import { json } from 'typia';
import { Generator } from './generator';
import { popErrStack } from './utils';

const stringify = json.assertStringify;

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
			with: (arbitrary: ps.Arbitrary<S>): T => {
				// Instantiate error here to capture call stack
				const specLocation = new Error().stack?.match(
					/(?:[^\n]*\n){2}[^\n]*\(([^\n\\(\\)]+)\)/
				);
				const generatorId = `ad-hoc-oracle::${
					specLocation ? specLocation[1] : stringify(arbitrary)
				}`;
				const generatedValue = generator.generateValue(generatorId, arbitrary);
				return Output.isInstance(value) && !Output.isInstance(generatedValue)
					? (output(generatedValue) as T)
					: (generatedValue as T);
			},
		};
	},
});
