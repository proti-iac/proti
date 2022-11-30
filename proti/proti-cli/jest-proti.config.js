/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	testMatch: ['**/?(*.)+(proti).[tj]s'],
	testPathIgnorePatterns: ['/node_modules/(?!proti)'],
	haste: {
		retainAllFiles: true,
	},
	setupFilesAfterEnv: ['jest-expect-message'],
};
