import { Map, Set } from 'immutable';
import * as path from 'path';
import { Preloader, PreloaderConfig } from '../src/module-preloader';
import { findImports } from '../src/static-analysis';

jest.mock('../src/static-analysis', () => ({
	findImports: jest.fn(),
}));

const modules = {
	a: {
		absolute: path.resolve(path.join(__dirname, 'empty-ts-modules/src/a.ts')),
		project: path.resolve(path.join(__dirname, 'empty-ts-modules')),
	},
	b: {
		absolute: path.resolve(path.join(__dirname, 'empty-ts-modules/src/b.ts')),
		relative: './b',
	},
	c: {
		absolute: path.resolve(path.join(__dirname, 'empty-ts-modules/node_modules/c/see.ts')),
		package: 'c',
	},
};

describe('Module Preloader', () => {
	beforeEach(() => (findImports as jest.Mock).mockReset());
	const config: PreloaderConfig = {
		preload: Set(),
		preloadAbsoluteImports: false,
		preloadPackageImports: false,
		preloadRelativeImports: false,
		projectDir: modules.a.project,
		searchImportsProjectMain: false,
		searchImportsRecursively: false,
		searchImportsFrom: Set(),
		searchImportsExclude: Set(),
	};
	const preloader = new Preloader(config);

	it('should find main file', () => {
		expect(preloader.projectMain).toBe(modules.a.absolute);
	});

	it('should resolve imports in project', () => {
		expect(preloader.resolveInProject(modules.a.project)).toBe(modules.a.absolute);
		expect(preloader.resolveInProject(modules.b.relative)).toBe(modules.b.absolute);
		expect(preloader.resolveInProject(modules.c.package)).toBe(modules.c.absolute);
	});

	describe('module search', () => {
		it('should not search in anything', async () => {
			await preloader.preloadModules();
			expect(findImports).toHaveBeenCalledTimes(0);
		});

		it('should search in project main', async () => {
			(findImports as jest.Mock).mockReturnValue(Set());
			await new Preloader({ ...config, searchImportsProjectMain: true }).preloadModules();
			expect(findImports).toHaveBeenCalledTimes(1);
			expect(findImports).toBeCalledWith(modules.a.absolute);
		});

		it('should search in search from list', async () => {
			(findImports as jest.Mock).mockReturnValue(Set());
			await new Preloader({
				...config,
				searchImportsFrom: Set([modules.b.relative, modules.c.package]),
			}).preloadModules();
			expect(findImports).toHaveBeenCalledTimes(2);
			expect(findImports).toBeCalledWith(modules.b.absolute);
			expect(findImports).toBeCalledWith(modules.c.absolute);
		});

		it('should not search recursively', async () => {
			(findImports as jest.Mock).mockReturnValue(
				Set([modules.b.relative, modules.c.package])
			);
			await new Preloader({ ...config, searchImportsProjectMain: true }).preloadModules();
			expect(findImports).toHaveBeenCalledTimes(1);
		});

		it('should search recursively', async () => {
			(findImports as jest.Mock)
				.mockReturnValueOnce(Set([modules.b.relative, modules.c.package]))
				.mockReturnValue(Set());
			await new Preloader({
				...config,
				searchImportsProjectMain: true,
				searchImportsRecursively: true,
			}).preloadModules();
			expect(findImports).toHaveBeenCalledTimes(3);
			expect(findImports).toBeCalledWith(modules.a.absolute);
			expect(findImports).toBeCalledWith(modules.b.absolute);
			expect(findImports).toBeCalledWith(modules.c.absolute);
		});

		it('should respect rescursive search exclusion for preloaded modules', async () => {
			(findImports as jest.Mock).mockReturnValueOnce(Set([modules.c.package]));
			await new Preloader({
				...config,
				searchImportsProjectMain: true,
				searchImportsRecursively: true,
				preloadPackageImports: true,
			}).preloadModules();
			expect(findImports).toHaveBeenCalledTimes(1);
		});

		it('should respect rescursive manual search exclusion and preloads', async () => {
			(findImports as jest.Mock)
				.mockReturnValueOnce(Set([modules.b.relative, modules.c.package]))
				.mockReturnValue(Set());
			await new Preloader({
				...config,
				searchImportsProjectMain: true,
				searchImportsRecursively: true,
				searchImportsExclude: Set([modules.a.absolute, modules.b.relative]),
				preload: Set([modules.c.package]),
			}).preloadModules();
			expect(findImports).toHaveBeenCalledTimes(1);
		});
	});

	describe('module preloading', () => {
		beforeEach(() => {
			(findImports as jest.Mock).mockReturnValue(
				Set([modules.a.project, modules.b.relative, modules.c.package])
			);
		});

		it('should not preload anything', async () => {
			const mods = await new Preloader({
				...config,
				searchImportsProjectMain: true,
			}).preloadModules();
			expect(mods).toBe(Map());
		});

		it('should preload list', async () => {
			const mods = await new Preloader({
				...config,
				searchImportsProjectMain: true,
				preload: Set([modules.a.project, modules.b.relative]),
			}).preloadModules();
			expect(mods.keySeq().toArray()).toEqual([modules.a.absolute, modules.b.absolute]);
		});

		it('should preload absolute imports', async () => {
			const mods = await new Preloader({
				...config,
				searchImportsProjectMain: true,
				preloadAbsoluteImports: true,
			}).preloadModules();
			expect(mods.keySeq().toArray()).toEqual([modules.a.absolute]);
		});

		it('should preload relative imports', async () => {
			const mods = await new Preloader({
				...config,
				searchImportsProjectMain: true,
				preloadRelativeImports: true,
			}).preloadModules();
			expect(mods.keySeq().toArray()).toEqual([modules.b.absolute]);
		});

		it('should preload package imports', async () => {
			const mods = await new Preloader({
				...config,
				searchImportsProjectMain: true,
				preloadPackageImports: true,
			}).preloadModules();
			expect(mods.keySeq().toArray()).toEqual([modules.c.absolute]);
		});
	});
});
