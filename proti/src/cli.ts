import { run as runRaw } from 'jest';
import { Config } from './config';

export const options = {};

export const run = (args: string[]): void => {
	const cliDir = __dirname;
	const config: Config = {};
	const protiJestArgs = [
		'--roots',
		cliDir,
		'--testMatch',
		'**/?(*.)+(proti).[tj]s',
		'--globals',
		JSON.stringify({ proti: config }),
	];
	runRaw(protiJestArgs.concat(args));
};
