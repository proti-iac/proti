import * as ts from 'typescript';

export default (): ts.TransformerFactory<ts.SourceFile> => () => (sourceFile) =>
	// transformation code here
	sourceFile;
