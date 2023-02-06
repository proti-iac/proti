import { defaults } from 'jest-config';
import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
	preset: 'ts-jest',

	injectGlobals: true, // Inject globals into each test environment, e.g., expect, otherwise explicit import is required
	moduleFileExtensions: [...defaults.moduleFileExtensions, 'yaml', 'yml'],
	runner: '@proti/runner',
	// seed: 0, // Tests' rng seed. Set to a value for deterministic reruns.
	testEnvironment: 'node',
	testMatch: ['**/Pulumi.y?(a)ml'],
	testRunner: '@proti/test-runner',
};

export default config;
