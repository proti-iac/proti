import { Map, Set } from 'immutable';
import * as path from 'path';
import { findImports } from './static-analysis';

export type PreloaderConfig = {
	preload: Set<string>;
	preloadAbsoluteImports: boolean;
	preloadPackageImports: boolean;
	preloadRelativeImports: boolean;
	projectDir: string;
	searchImportsProjectMain: boolean;
	searchImportsRecursively: boolean;
	searchImportsFrom: Set<string>;
	searchImportsExclude: Set<string>;
};

type UnresolvedImport = string;
type ResolvedImport = string;
type Import = UnresolvedImport | ResolvedImport;

export class Preloader {
	constructor(protected readonly config: PreloaderConfig) {
		this.projectMain = require.resolve(this.config.projectDir);
		this.searchImportsFrom = (
			this.config.searchImportsProjectMain ? Set([this.projectMain]) : Set<ResolvedImport>()
		).union(this.config.searchImportsFrom.map(this.resolveInProject));
	}

	/**
	 * The project's main file.
	 */
	public readonly projectMain: ResolvedImport;

	/**
	 * Resolves an import from project main file.
	 * @param imp Import string to resolve.
	 * @returns Resolved import path.
	 */
	public readonly resolveInProject = (imp: Import): ResolvedImport =>
		require.resolve(imp, { paths: [path.dirname(this.projectMain)] });

	protected readonly searchImportsFrom: Set<ResolvedImport>;

	/**
	 * Decides for import, whether it shall be preloaded.
	 * @param imp Import string to assess.
	 * @returns If true, import shall be preloaded.
	 */
	protected readonly shallPreload = (imp: Import): boolean => {
		if (path.isAbsolute(imp)) return this.config.preloadAbsoluteImports;
		if (imp.startsWith('.')) return this.config.preloadRelativeImports;
		return this.config.preloadPackageImports;
	};

	/**
	 * Searches and resolves all imports in a TypeScript module or source file.
	 * @param file TypeScript source file to search in.
	 * @param ignore Set of imports to ignore.
	 * @returns Found imports to preload (resolved).
	 */
	protected readonly searchImports = (
		file: ResolvedImport,
		ignore: Set<Import>
	): Set<ResolvedImport> =>
		findImports(file)
			.filterNot((imp) => ignore.contains(imp)) // Allow filter unresolved, in case resolving causes error
			.map((imp: UnresolvedImport): [UnresolvedImport, ResolvedImport] => [
				imp,
				require.resolve(imp, { paths: [path.dirname(file)] }),
			])
			.filterNot(([, resolvedImp]) => ignore.contains(resolvedImp)) // Filter resolved
			.flatMap(([imp, resolvedImp]) => {
				if (this.shallPreload(imp)) return Set([resolvedImp]);
				if (this.config.searchImportsRecursively)
					return this.searchImports(resolvedImp, ignore.add(resolvedImp));
				return Set();
			});

	/**
	 * Search for imports and preload modules as configured.
	 * @returns Preloaded modules mapped to their resolved import name. Map does not contain indirectly preloaded modules.
	 */
	public readonly preloadModules = async (): Promise<Map<ResolvedImport, any>> => {
		const manualPreloads = this.config.preload.map((imp: UnresolvedImport) =>
			this.resolveInProject(imp)
		);
		const searchPreloads = this.searchImportsFrom.flatMap((imp) =>
			this.searchImports(imp, manualPreloads.union(this.config.searchImportsExclude))
		);
		const preloads = manualPreloads
			.union(searchPreloads)
			.map(async (imp: ResolvedImport) => [imp, await import(imp)] as [ResolvedImport, any]);
		return Map(await Promise.all(preloads));
	};
}
