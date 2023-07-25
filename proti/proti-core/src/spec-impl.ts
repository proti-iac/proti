import * as ps from '@proti/spec';
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
});
