import * as pulumi from '@pulumi/pulumi';
import * as fc from 'fast-check';
import { Map, Set } from 'immutable';
import { Config, fromPrimitiveConfig, PrimitiveConfig } from './config';
import { Preloader } from './module-preloader';

declare const proti: PrimitiveConfig;
const config: Config = fromPrimitiveConfig(proti);

const showModules = (headline: string, modules: Set<string>): void =>
	console.info(`${headline} (${modules.size}):\n${modules.join('\n')}`);

describe(proti.projectDir, () => {
	const dynamicallyLoadedModules: Set<string>[] = [];

	beforeAll(async () => {
		const preloader = new Preloader(config);
		const preloadedModules = await preloader.preloadModules();
		if (proti.showPreloadedImports)
			showModules(
				'Preloaded modules that are shared among all test executions',
				preloadedModules.keySeq().toSet()
			);

		// We need to mutate the same runtime instance that is later used by the Pulumi project
		const pulumiPath = preloader.resolveInProject('@pulumi/pulumi');
		const projectPulumi: typeof pulumi = preloadedModules.get(pulumiPath);

		projectPulumi.runtime.setMocks({
			newResource(args: pulumi.runtime.MockResourceArgs): { id: string; state: any } {
				return {
					id: `${args.inputs.name}_id`,
					state: { ...args.inputs, versioning: { enabled: true }, bucket: null },
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
			preloadedModules.forEach((mod, modPath) => jest.mock(modPath, () => mod));
		}
	});

	fc.assert(
		fc.property(fc.string(), (testName) => {
			it(`should run ${testName}`, async () => {
				jest.isolateModules(() => {
					// Run the IaC program
					// eslint-disable-next-line import/no-dynamic-require, global-require
					require(proti.projectDir);

					// Evaluate which modules have been dynamically loaded for this single test execution
					const loadedModules: Set<string> = Set([
						...(jest.getIsolatedModuleRegistry() || Map<string, any>()).keys(),
					]);
					expect(
						loadedModules,
						"Isolated module registry does not contain Pulumi program's main module. The tests do not execute the IaC program!"
					).toContain(require.resolve(config.projectDir));
					if (proti.showDynamicImports) dynamicallyLoadedModules.push(loadedModules);
				});

				// Wait for all async code to settle
				await new Promise(process.nextTick);
			});
		}),
		{ numRuns: 10 }
	);

	afterAll(() => {
		if (proti.showDynamicImports) {
			const padLength = Math.log10(dynamicallyLoadedModules.length) + 1;
			showModules(
				'Dynamically loaded modules [test runs: module]',
				dynamicallyLoadedModules
					.reduce((acc, run) => acc.concat(run.toArray()), [] as string[])
					.reduce(
						(stat, mod) => stat.set(mod, (stat.get(mod) || 0) + 1),
						Map<string, number>()
					)
					.map((numTests, mod) => `${numTests.toString().padStart(padLength)}: ${mod}`)
					.toSet()
			);
		}
	});
});
