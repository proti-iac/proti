import { promises as fs } from 'fs';
import path from 'path';
import { json } from 'typia';
import { PulumiPackageMetaschema } from '../src/pulumi-package-metaschema';

describe('pulumi package schema types', () => {
	it.each(['random@4.13.0', 'aws@5.39.0', 'aws-native@0.64.0'])(
		'should be compatibility and validate %s',
		async (schema) => {
			const file = path.join(__dirname, 'pulumi-package-metaschema', `${schema}.json`);
			const fileContent = await fs.readFile(file);
			expect(() =>
				json.assertParse<PulumiPackageMetaschema>(fileContent.toString())
			).not.toThrow();
		}
	);
});
