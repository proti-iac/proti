import { Config, DeepPartial } from '@proti-iac/core';
import { defaults } from 'jest-config';
import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
	preset: 'ts-jest',
	transform: {
		'^.+\\.tsx?$': [
			'ts-jest',
			{
				// compiler: 'ttypescript',
				// tsconfig: {
				// 	plugins: [
				// 		{
				// 			transform: '@proti-iac/transformer',
				// 		},
				// 	],
				// },
			},
		],
	},
	globals: {
		proti: {} as DeepPartial<Config>,
	},

	injectGlobals: true, // Inject globals into each test environment, e.g., expect, otherwise explicit import is required
	moduleFileExtensions: [...defaults.moduleFileExtensions, 'yaml', 'yml'],
	runner: '@proti-iac/runner',
	// seed: 0, // Tests' rng seed. Set to a value for deterministic reruns.
	// reporters: [
	// 	'default', // Jest's default console reporting
	// 	'@proti-iac/reporter', // ProTI's CSV reporter
	// ],
	testEnvironment: 'node',
	testMatch: ['**/Pulumi.y?(a)ml'],
	testRunner: '@proti-iac/test-runner',
};

export default config;
