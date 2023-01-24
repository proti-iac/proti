import { defaults } from 'jest-config';
import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
	preset: 'ts-jest',
	runner: '@proti/runner',
	testEnvironment: 'node',
	moduleFileExtensions: [...defaults.moduleFileExtensions, 'yaml', 'yml'],
	testMatch: ['**/Pulumi.y?(a)ml'],
	testRunner: '@proti/test-runner',
};

export default config;
