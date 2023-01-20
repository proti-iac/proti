import { defaults } from 'jest-config';
import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	moduleFileExtensions: [...defaults.moduleFileExtensions, 'yaml', 'yml'],
	runner: __dirname,
	testMatch: ['**/Pulumi.y?(a)ml'],
	verbose: true,
	roots: [__dirname],
};

export default config;
