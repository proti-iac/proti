import * as jestCli from 'jest-cli';
import { Options as YOptions } from 'yargs';
import yargs = require('yargs');
import { Config, defaultConfig } from './config';
import { keys, pick } from './utilities';

export type Options = Config & { jest: string; showConfig: boolean };
export const options: { [key in keyof Options]: YOptions } = {
	projectDir: {
		alias: 'p',
		default: defaultConfig.projectDir,
		description: 'Root directory of the project to test',
		type: 'string',
	},
	protiDir: {
		alias: 'r',
		default: defaultConfig.protiDir,
		description: 'Root directory of the executing ProTI scripts',
		type: 'string',
	},
	jest: {
		alias: 'j',
		default: '',
		description: 'Argument string to pass to pass to jest',
		type: 'string',
	},
	showConfig: {
		description: 'Show config and exit without executing ProTI',
		type: 'boolean',
	},
};

export const run = (args: string[]): void => {
	const argv = yargs(args)
		.scriptName('proti')
		.usage('$0 [project Dir]', 'Run ProTI on project')
		.options(options)
		.alias('h', 'help')
		.alias('v', 'version')
		.strict(true).argv as Options;

	const config = {
		...defaultConfig,
		...pick(argv, keys(defaultConfig)),
	};

	if (argv.showConfig === true) {
		console.log(config);
		process.exit(0);
	}

	const jestConf = [
		'--rootDir',
		config.protiDir,
		'--testMatch',
		'**/?(*.)+(proti).[tj]s',
		'--globals',
		JSON.stringify({ proti: config }),
	];
	const jestArgs: string[] = argv.jest.match(/(?:[^\s"']+|['"][^'"]*["'])+/g) || [];
	jestCli.run(jestArgs.concat(jestConf));
};
