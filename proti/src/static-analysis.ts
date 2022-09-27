import { Set } from 'immutable';

/**
 * Finds all imported identifiers in a single typescript source file.
 * @param file Filename of the TypeScript source file.
 * @returns Imported identifiers (e.g., Set('@pulumi/pulumi', './cli.ts')).
 */
// eslint-disable-next-line import/prefer-default-export, @typescript-eslint/no-unused-vars
export const findImports = (file: string): Set<string> => {
	throw new Error(); // @TODO implement
};
