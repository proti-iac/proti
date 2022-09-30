import { Set } from 'immutable';
import { Project } from 'ts-morph';

/**
 * Finds all imported identifiers in a single typescript source file.
 * @param file Filename of the TypeScript source file.
 * @returns Imported identifiers (e.g., Set('@pulumi/pulumi', './cli.ts')).
 */
// eslint-disable-next-line import/prefer-default-export
export const findImports = (file: string): Set<string> => {
	const project = new Project();
	const sourceFile = project.addSourceFileAtPath(file);
	const imports = sourceFile.getImportDeclarations();
	return Set(imports.map((imp) => imp.getModuleSpecifierValue()));
};
