import type { IHasteFS } from 'jest-haste-map';
import type Resolver from 'jest-resolve';
import type Runtime from 'jest-runtime';
import { DependencyResolver } from 'jest-resolve-dependencies';
import { buildSnapshotResolver } from 'jest-snapshot';
import type { Config } from '@jest/types';

import type { ModuleLoadingConfig } from './config';
import { DeepReadonly, errMsg } from './utils';

export class ModuleLoader {
	public readonly modules: () => ReadonlyMap<string, unknown>;

	public readonly mockedModules: () => ReadonlyMap<string, unknown>;

	public readonly isolatedModules: () => ReadonlyMap<string, unknown>;

	private constructor(
		private readonly program: string,
		private readonly config: ModuleLoadingConfig,
		private readonly runtime: Runtime,
		private readonly programDependencies: ReadonlyArray<string>,
		private readonly preloads: ReadonlyArray<string>,
		private readonly log: (msg: string) => void
	) {
		// eslint-disable-next-line no-underscore-dangle
		this.modules = () => (runtime as any)._moduleRegistry || new Map();
		// eslint-disable-next-line no-underscore-dangle
		this.mockedModules = () => (runtime as any)._isolatedMockRegistry || new Map();
		// eslint-disable-next-line no-underscore-dangle
		this.isolatedModules = () => (runtime as any)._isolatedModuleRegistry || new Map();
	}

	public static create = async (
		projectConfig: DeepReadonly<Config.ProjectConfig>,
		config: ModuleLoadingConfig,
		runtime: Runtime,
		resolver: Resolver,
		hasteFS: IHasteFS,
		programPath: string
	): Promise<ModuleLoader> => {
		const log = config.verbose ? console.log : () => {};
		const program = await this.resolveProgram(programPath, resolver, log);
		const dependencyResolver = new DependencyResolver(
			resolver,
			hasteFS,
			await buildSnapshotResolver(projectConfig as Config.ProjectConfig)
		);
		const programDependencies = this.resolveDependenciesRecursively(
			program,
			dependencyResolver
		);
		const preloads = this.findPreloads(config, programDependencies);
		return new ModuleLoader(program, config, runtime, programDependencies, preloads, log);
	};

	/**
	 * @param dependency Program dependency file to check for.
	 * @returns True if `dependency` is suffix of a resolved program dependency.
	 */
	public isProgramDependency = (dependency: string): boolean =>
		this.programDependencies.some((s) => s.endsWith(dependency));

	public preload = (): ReadonlyMap<string, unknown> => {
		// eslint-disable-next-line no-underscore-dangle
		const modulesBefore = this.modules().size;
		const preloads: ReadonlyMap<string, unknown> = new Map(
			this.preloads.map((preload) => {
				this.log(`Preloading ${preload} in ${this.program}`);
				return [preload, this.runtime.requireActual(this.program, preload)];
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
	public transformProgram = (): void => {
		const programModules = [this.program, ...this.programDependencies];
		const logModules = this.config.showTransformed ? [':', ...programModules].join('\n') : '';
		this.log(`Transforming ${programModules.length} modules${logModules}`);
		programModules.forEach((module) => (this.runtime as any).transformFile(module));
	};

	/**
	 * Loads the program module, causing it to execute. Reuses transformed version in cache.
	 * @returns Loaded program module.
	 */
	public execProgram = <T>(): T => {
		this.log(`Loading program ${this.program}`);
		const module: T = this.runtime.requireActual(this.program, '.');
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

	public mockModules = (modules: ReadonlyMap<string, unknown>) => {
		modules.forEach((module, name) => this.runtime.setMock(this.program, name, () => module));
	};

	private static resolveProgram = async (
		programPath: string,
		resolver: Resolver,
		log: (msg: string) => void
	): Promise<string> =>
		errMsg(
			resolver
				.resolveModuleAsync(programPath, '.')
				.catch(() => resolver.resolveModuleFromDirIfExists(programPath, '.'))
				.then((resolvedPath: string | null): string => {
					if (resolvedPath === null)
						throw new Error(`Program resolved to null in ${programPath}`);
					log(`Resolved program to ${resolvedPath}`);
					return resolvedPath;
				}),
			`Failed to resolve program from path ${programPath}`
		);

	private static resolveDependenciesRecursively = (
		module: string,
		dependencyResolver: DependencyResolver
	): ReadonlyArray<string> => {
		const recResolve = (m: string): ReadonlyArray<string> => [
			...dependencyResolver
				.resolve(m)
				.reduce<ReadonlySet<string>>(
					(deps, dep) => new Set([...deps, dep, ...recResolve(dep)]),
					new Set<string>()
				),
		];
		return recResolve(module);
	};

	private static findPreloads = (
		config: ModuleLoadingConfig,
		programDependencies: ReadonlyArray<string>
	): ReadonlyArray<string> => [
		...config.preload,
		...programDependencies.filter((dependency) =>
			config.preloadDependencies.some((pattern) => new RegExp(pattern).test(dependency))
		),
	];
}
