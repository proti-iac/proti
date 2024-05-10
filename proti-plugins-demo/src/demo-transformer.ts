import { TransformedSource } from '@jest/transform';
import tsJest from 'ts-jest';
import type { TransformOptionsTsJest, TsJestTransformer, TsJestTransformerOptions } from 'ts-jest';

const customTransform = (src: TransformedSource): TransformedSource =>
	// We ignore manipulating the source map for now...
	({ ...src, code: `${src.code}\nconsole.info('Appended by demo transformer post transform');` });

/**
 * Jest transformer factory augmenting the ts-jest transformer with applying
 * {@link customTransform} to the transformed source.
 * @param config Tranformer config
 * @returns Augmented ts-jest transformer
 */
export const createTransformer = (config: TsJestTransformerOptions): TsJestTransformer => {
	const transformer = tsJest.createTransformer(config);
	const { process, processAsync } = transformer;

	transformer.process = (
		sourceText: string,
		sourcePath: string,
		transformOptions: TransformOptionsTsJest
	) => customTransform(process(sourceText, sourcePath, transformOptions));

	transformer.processAsync = async (
		sourceText: string,
		sourcePath: string,
		transformOptions: TransformOptionsTsJest
	) => customTransform(await processAsync(sourceText, sourcePath, transformOptions));

	return transformer;
};

export default { createTransformer };
