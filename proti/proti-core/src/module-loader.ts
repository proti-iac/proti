import type { IHasteFS } from 'jest-haste-map';
import type Resolver from 'jest-resolve';
import type Runtime from 'jest-runtime';
import { DependencyResolver } from 'jest-resolve-dependencies';
import { buildSnapshotResolver } from 'jest-snapshot';
import type { Config } from '@jest/types';

import type { ModuleLoadingConfig } from './config';
import { errMsg } from './utils';

// eslint-disable-next-line import/prefer-default-export
export class ModuleLoader {
	private log: (msg: string) => void;

	private dependencyResolver: Promise<DependencyResolver>;

	private program: Promise<string>;

	private programDependencies: Promise<string[]>;

	private preloads: Promise<string[]>;

	private modules: () => Map<string, unknown>;

	private mockedModules: () => Map<string, unknown>;

	private isolatedModules: () => Map<string, unknown>;

	constructor(
		private projectConfig: Config.ProjectConfig,
		private config: ModuleLoadingConfig,
		private runtime: Runtime,
		private resolver: Resolver,
		hasteFS: IHasteFS,
		programPath: string
	) {
		this.log = config.verbose ? console.log : () => {};
		// eslint-disable-next-line no-underscore-dangle
		this.modules = () => (runtime as any)._moduleRegistry;
		// eslint-disable-next-line no-underscore-dangle
		this.mockedModules = () => (runtime as any)._isolatedMockRegistry;
		// eslint-disable-next-line no-underscore-dangle
		this.isolatedModules = () => (runtime as any)._isolatedModuleRegistry;
		this.program = this.resolveProgram(programPath);
		this.dependencyResolver = (async () =>
			new DependencyResolver(
				resolver,
				hasteFS,
				await buildSnapshotResolver(this.projectConfig)
			))();
		this.programDependencies = this.findProgramDependencies();
		this.preloads = this.findPreloads();
	}

	public preload = async (): Promise<Map<string, unknown>> => {
		const program = await this.program;
		// eslint-disable-next-line no-underscore-dangle
		const modulesBefore = this.modules().size;
		const preloads: Map<string, unknown> = new Map(
			(await this.preloads).map((preload) => {
				this.log(`Preloading ${preload} in ${program}`);
				return [preload, this.runtime.requireActual(program, preload)];
			})
		);
		this.log(`Preloaded ${this.modules().size - modulesBefore} modules`);
		if (this.config.showPreloaded)
			this.log(`Preloaded modules:\n${[...this.modules().keys()].join('\n')}`);
		return preloads;
	};

	/**
	 * Transforms program including its dependencies. Can be used to trigger code transformation
	 * eplicitely before its execution, e.g., with `execProgram`.
	 */
	public transformProgram = async (): Promise<void> => {
		const programModules = [await this.program, ...(await this.programDependencies)];
		const logModules = this.config.showTransformed ? [':', ...programModules].join('\n') : '';
		this.log(`Transforming ${programModules.length} modules${logModules}`);
		programModules.forEach((module) => (this.runtime as any).transformFile(module));
	};

	/**
	 * Loads the program module, causing it to execute. Reuses transformded verison in cache.
	 * @returns Loaded program module.
	 */
	public execProgram = async <T>(): Promise<T> => {
		const program = await this.program;
		this.log(`Loading program ${program}`);
		const module: T = this.runtime.requireActual(program, '.');
		this.log(
			`Loaded ${this.modules().size} global modules (${this.mockedModules().size} shared, ${
				this.isolatedModules().size
			} isolated)`
		);
		if (this.config.showShared)
			this.log(`Shared modules:\n${[...this.mockedModules().keys()].join('\n')}`);
		if (this.config.showIsolated)
			this.log(`Isolated modules:\n${[...this.isolatedModules().keys()].join('\n')}`);
		return module;
	};

	public mockModules = async (modules: Map<string, unknown>) => {
		const program = await this.program;
		modules.forEach((module, name) => this.runtime.setMock(program, name, () => module));
	};

	private resolveProgram = async (programPath: string): Promise<string> =>
		errMsg(
			this.resolver
				.resolveModuleAsync(programPath, '.')
				.catch(() => this.resolver.resolveModuleFromDirIfExists(programPath, '.'))
				.then((resolvedPath: string | null): string => {
					if (resolvedPath === null)
						throw new Error(`Program resolved to null in ${programPath}`);
					this.log(`Resolved program to ${resolvedPath}`);
					return resolvedPath;
				}),
			`Failed to resolve  program from path ${programPath}`
		);

	private resolveDependenciesRecursively = async (module: string): Promise<string[]> => {
		const dependencyResolver = await this.dependencyResolver;
		const recResolve = (m: string): string[] => [
			...dependencyResolver
				.resolve(m)
				.reduce(
					(deps, dep) => new Set([...deps, dep, ...recResolve(dep)]),
					new Set<string>()
				),
		];
		return recResolve(module);
	};

	private findProgramDependencies = async () =>
		this.resolveDependenciesRecursively(await this.program);

	private findPreloads = async () => [
		...this.config.preload,
		...(await this.programDependencies).filter((dependency) =>
			this.config.preloadDependencies.some((pattern) => new RegExp(pattern).test(dependency))
		),
	];
}
