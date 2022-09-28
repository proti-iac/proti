import { runCLI as runJest } from 'jest';
import { buildArgv as buildJestArgv } from 'jest-cli/build/cli';
import * as fs from 'fs';
import * as path from 'path';
import yargs = require('yargs');
import { defaultConfig, PrimitiveConfig, toPrimitiveConfig } from './config';
import { dropUndefined, keys, pick } from './utilities';

const defaultOptions: PrimitiveConfig = toPrimitiveConfig(defaultConfig);
export const options = <T>(argv: yargs.Argv<T>): yargs.Argv<PrimitiveConfig> =>
	argv.options({
		preload: {
			default: defaultOptions.preload,
			description: 'List of imports to preload before and reuse in the test runs',
			type: 'array',
		},
		preloadAbsoluteImports: {
			default: defaultOptions.preloadAbsoluteImports,
			description:
				'Preload all absolute path imports found in the project before the test runs and reuse them',
			type: 'boolean',
		},
		preloadPackageImports: {
			default: defaultOptions.preloadPackageImports,
			description:
				'Preload all package imports found in the project before the test runs and reuse them',
			type: 'boolean',
		},
		preloadRelativeImports: {
			default: defaultOptions.preloadRelativeImports,
			description:
				'Preload all relative path imports found in the project before the test runs and reuse them',
			type: 'boolean',
		},
		projectDir: {
			alias: 'p',
			default: defaultOptions.projectDir,
			description: 'Root directory of the project to test',
			type: 'string',
		},
		protiDir: {
			alias: 'r',
			default: defaultOptions.protiDir,
			description: 'Root directory of the executing ProTI scripts',
			type: 'string',
		},
		jest: {
			alias: 'j',
			default: defaultOptions.jest,
			description: 'Argument string to pass to pass to jest',
			type: 'string',
		},
		searchImportsExclude: {
			default: defaultOptions.searchImportsExclude,
			description:
				'Exclude these imports from the search for imports to preload (package name, absolute path, or path relative to project dir)',
			type: 'array',
		},
		searchImportsFrom: {
			default: defaultOptions.searchImportsFrom,
			description:
				'Module strings to start search for imports to preload from (package name, absolute path, or path relative to project dir)',
			type: 'array',
		},
		searchImportsProjectMain: {
			default: defaultOptions.searchImportsProjectMain,
			description: "Search for imports to preload in the project's main file",
			type: 'boolean',
		},
		searchImportsRecursively: {
			default: defaultOptions.searchImportsRecursively,
			description: 'Search recursively for imports to preload',
			type: 'boolean',
		},
		showConfig: {
			default: defaultOptions.showConfig,
			description: 'Show config and exit without executing ProTI',
			type: 'boolean',
		},
		showDynamicImports: {
			default: defaultOptions.showDynamicImports,
			description: 'Print to console which modules each test execution dynamically imports',
			type: 'boolean',
		},
		showPreloadedImports: {
			default: defaultOptions.showPreloadedImports,
			description:
				'Print to console which imports are preloaded before and reused in the runs',
			type: 'boolean',
		},
		silent: {
			default: defaultOptions.silent,
			description: 'Hide console output',
			type: 'boolean',
		},
	});

export const check = (opts: yargs.Arguments<Partial<PrimitiveConfig>>): true => {
	if (!opts.projectDir || !fs.existsSync(opts.projectDir))
		throw new Error(`❌ Project path does not exist: ${opts.projectDir}`);
	return true;
};

export const run = async (args: string[]): Promise<void> => {
	const partialBloatedConfig = await options(yargs(args))
		.scriptName('proti')
		.usage('$0 [project Dir]', 'Run ProTI on project')
		.alias('h', 'help')
		.alias('v', 'version')
		.coerce('projectDir', (projectDir) => path.resolve(process.cwd(), projectDir))
		.check(check)
		.fail((msg, err) => {
			if (!args.join(' ').includes('--silent')) {
				console.error(msg);
				console.error('💡 Use --help to display the manual');
			}
			throw err;
		})
		.strict(true).argv;
	const config: PrimitiveConfig = {
		...defaultOptions,
		...dropUndefined(pick(partialBloatedConfig, keys(defaultConfig))),
	};

	if (config.showConfig === true) {
		console.log(config);
		return;
	}

	const jestConf = [
		`--rootDir=${config.protiDir}`,
		`--config=${path.resolve(config.protiDir, '../jest-proti.config.js')}`,
		`--globals=${JSON.stringify({ proti: config })}`,
	];
	if (config.silent) jestConf.push('--silent');
	const jestArgs: string[] = config.jest.match(/(?:[^\s"']+|['"][^'"]*["'])+/g) || [];
	const jestArgv = await buildJestArgv(jestArgs.concat(jestConf));
	// Jest ignores --config if multiple projects are configured or the project is not cwd
	const { results: jestResults } = await runJest(jestArgv, [process.cwd()]);
	if (!jestResults?.success) throw new Error('Jest tests failed');
};
