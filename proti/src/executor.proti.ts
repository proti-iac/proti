import * as pulumi from '@pulumi/pulumi';
import * as fc from 'fast-check';
import { Map } from 'immutable';
import * as path from 'path';
import { Config } from './config';

declare const proti: Config;

describe(proti.projectDir, () => {
	const dynamicallyLoadedModules: string[] = [];

	beforeAll(async () => {
		// We need to mutate the same runtime instance that is later used by the Pulumi project
		const projPulumiPath = require.resolve('@pulumi/pulumi', { paths: [proti.projectDir] });
		const projectPulumi: typeof pulumi = await import(projPulumiPath);

		projectPulumi.runtime.setMocks({
			newResource(args: pulumi.runtime.MockResourceArgs): { id: string; state: any } {
				return {
					id: `${args.inputs.name}_id`,
					state: args.inputs,
				};
			},
			call(args: pulumi.runtime.MockCallArgs) {
				return args.inputs;
			},
		});

		// Mocks must be set in own block. Otherwise, Jest hoists them before
		// the mock constants' initialization.
		// eslint-disable-next-line no-lone-blocks
		{
			jest.mock(projPulumiPath, () => projectPulumi);
		}
	});

	fc.assert(
		fc.property(fc.string(), (testName) => {
			it(`should run ${testName}`, async () => {
				jest.isolateModules(() => {
					// eslint-disable-next-line import/no-dynamic-require, global-require
					require(proti.projectDir);

					// Evaluate which modules have been dynamically loaded for this single test execution
					const loadedModules: string[] = [
						...(jest.getIsolatedModuleRegistry() || Map<string, any>()).keys(),
					];
					expect(
						loadedModules,
						"Isolated module registry does not contain Pulumi program's main module. The tests do not execute the IaC program!"
					).toContain(require.resolve(proti.projectDir));
					if (proti.showDynamicImports) dynamicallyLoadedModules.push(...loadedModules);
				});

				// Wait for all async code to settle
				await new Promise(process.nextTick);
			});
		}),
		{ numRuns: 10 }
	);

	afterAll(() => {
		if (proti.showDynamicImports && !proti.silent) {
			const moduleStats = dynamicallyLoadedModules
				.reduce(
					(stats, mod) => stats.set(mod, (stats.get(mod) || 0) + 1),
					Map<string, number>()
				)
				.toArray()
				.sort()
				.map(([mod, tests]) => `${tests.toString().padStart(5, ' ')} ${mod}`)
				.join('\n');
			console.info(`Dynamically loaded modules [test runs, module name]:\n${moduleStats}`);
		}
	});
});
