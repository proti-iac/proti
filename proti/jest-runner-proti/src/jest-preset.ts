import { defaults } from 'jest-config';
import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	moduleFileExtensions: [...defaults.moduleFileExtensions, 'yaml', 'yml'],
	runner: 'jest-runner-proti',
	testMatch: ['**/Pulumi.y?(a)ml'],
	verbose: true,
};

export default config;
