import { runCLI as runJest } from 'jest';
import { buildArgv as buildJestArgv } from 'jest-cli/build/cli';
import * as path from 'path';
import yargs = require('yargs');
import { Config, defaultConfig } from './config';
import { keys, pick } from './utilities';

export type Options = Config & { jest: string; showConfig: boolean };
export const options: { [key in keyof Options]: yargs.Options } = {
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
		return;
	}

	const jestConf = [
		`--rootDir=${config.protiDir}`,
		`--config=${path.resolve(config.protiDir, '../jest-proti.config.js')}`,
		`--globals=${JSON.stringify({ proti: config })}`,
	];
	if (argv.silent) jestConf.push('--silent');
	const jestArgs: string[] = argv.jest.match(/(?:[^\s"']+|['"][^'"]*["'])+/g) || [];
	const jestArgv = await buildJestArgv(jestArgs.concat(jestConf));
	// Jest ignores --config if multiple projects are configured or the project is not cwd
	const { results: jestResults } = await runJest(jestArgv, [process.cwd()]);
	if (!jestResults?.success) throw new Error('Jest tests failed');
};
