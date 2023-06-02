import type { ModuleLoader } from '@proti/core';
import { promises as fs } from 'fs';
import path from 'path';
import { assertParse, is, stringify, TypeGuardError } from 'typia';
import type { Config } from './config';
import { PkgSchema, ResourceSchema, ResourceType, runPulumi } from './pulumi';

export class SchemaRegistry {
	private static instance: SchemaRegistry;

	/**
	 * Package name (key) and package versions (value, format: \d+.\d+.\d+) of loaded package schemas.
	 */
	private readonly loadedPkgSchemas: Map<string, Set<string>> = new Map();

	private readonly loadedPkgSchemaFiles: Set<string> = new Set();

	/**
	 * package.json files that are already analyzed and can be skipped when searching new resource modules.
	 */
	private readonly processedPkgJSONs: Set<string> = new Set();

	private readonly resourceSchemas = new Map<ResourceType, ResourceSchema>();

	public readonly inited: Promise<void>;

	private constructor(
		private readonly moduleLoader: ModuleLoader,
		private readonly config: Config,
		private readonly projectDir: string,
		private readonly cacheDir: string,
		private readonly log: (msg: string) => void
	) {
		this.inited = this.init();
	}

	private async init(): Promise<void> {
		this.log('Initializing Pulumi packages schema registry');
		if (this.config.loadCachedSchemas) {
			this.log('Loading cached package schemas');
			const cachedSchemaFiles = await this.findCachedPkgSchemaFiles();
			await Promise.all(cachedSchemaFiles.map((file) => this.loadPkgSchemaFile(file)));
		}
		this.log('Loading configured package schema files');
		await Promise.all(this.config.schemaFiles.map((file) => this.loadPkgSchemaFile(file)));
		this.log('Add configured resource schemas');
		Object.entries(this.config.schemas).forEach(([type, resourceSchema]) =>
			this.registerSchema(type, resourceSchema)
		);
	}

	/**
	 * (Re-)initializes registry instance. Must be called before `getInstance`.
	 * @param moduleLoader
	 * @param config Plugin config.
	 * @param cacheDir Jest project cache directory.
	 * @param forceInit If false, re-initialization is ignored. If true, a new registry replaces previous one.
	 */
	public static async initInstance(
		moduleLoader: ModuleLoader,
		config: Config,
		projectDir: string,
		cacheDir: string,
		forceInit = false
	): Promise<void> {
		if (!SchemaRegistry.instance || forceInit)
			SchemaRegistry.instance = new SchemaRegistry(
				moduleLoader,
				config,
				projectDir,
				path.resolve(cacheDir, config.cacheSubdir),
				config.verbose ? console.log : () => {}
			);
		else SchemaRegistry.instance.log('Skipping Pulumi packages schema registry initalization');
		await SchemaRegistry.instance.inited;
	}

	/**
	 * Returns schema registry instance after it was initialized using `initInstance`.
	 * @returns schema registry
	 */
	public static getInstance(): SchemaRegistry {
		if (!SchemaRegistry.instance)
			throw new Error('Pulumi packages schema registry not initialized');
		return SchemaRegistry.instance;
	}

	private async findCachedPkgSchemaFiles(): Promise<string[]> {
		try {
			const files = await fs.readdir(this.cacheDir);
			return files.map((file) => path.resolve(this.cacheDir, file));
		} catch (e) {
			this.log(`Failed finding Pulumi package schemas in ${this.cacheDir}. Cause: ${e}`);
			return [];
		}
	}

	/**
	 * Load als resource schemas from a Pulumi package schema stored in a JSON file into the registry.
	 */
	public async loadPkgSchemaFile(file: string): Promise<void> {
		if (this.loadedPkgSchemaFiles.has(file))
			return this.log(`Skip loading already loaded Pulumi package schema from ${file}`);
		this.log(`Loading Pulumi package schema from ${file}`);
		try {
			const fileContent = await fs.readFile(file);
			const schema = assertParse<PkgSchema>(fileContent.toString());
			return this.loadPkgSchema(schema, file);
		} catch (e: unknown) {
			const err = 'Failed to load Pulumi package schema file';
			const typeGuardError = is<TypeGuardError>(e) ? ' due to invalid schema format' : '';
			throw new Error(`${err}${typeGuardError}: ${file}`, { cause: e });
		}
	}

	private loadPkgSchema(schema: PkgSchema, file?: string): void {
		this.log(`Loading resource schemas of Pulumi package ${schema.name}@${schema.version}`);
		Object.entries(schema.resources).forEach(([type, resourceSchema]) =>
			this.registerSchema(type, resourceSchema)
		);
		if (file !== undefined) this.loadedPkgSchemaFiles.add(file);
		const pkgSchemaVersionsLoaded = this.loadedPkgSchemas.get(schema.name);
		if (pkgSchemaVersionsLoaded === undefined)
			this.loadedPkgSchemas.set(schema.name, new Set([schema.version]));
		else pkgSchemaVersionsLoaded.add(schema.version);
	}

	private registerSchema(type: ResourceType, schema: ResourceSchema): void {
		this.log(`Registering Pulumi packages schema for ${type}`);
		this.resourceSchemas.set(type, schema);
	}

	public async getSchema(type: ResourceType): Promise<ResourceSchema> {
		if (this.config.downloadSchemas && this.resourceSchemas.has(type) === false)
			await this.downloadPkgSchemas();
		const schema = this.resourceSchemas.get(type);
		if (schema === undefined)
			throw new Error(`Schema for resource type ${type} not in schema registry`);
		return schema;
	}

	/**
	 * Searches for package.json modules that have been loaded and tries to
	 * extract the Pulumi package name and version, if it installs a Pulumi
	 * resource plugin. If it finds packages that are not loaded yet, it tries
	 * to download their package schemas and loads them.
	 *
	 * To avoid duplicated work and inconsistencies, this method is synchronized.
	 * If the critical section is executing, all new calls are bundled into a single
	 * execution that starts after the previous execution left the critical section.
	 */
	private readonly downloadPkgSchemas: () => Promise<void> = (() => {
		let previousRun: Promise<void> = Promise.resolve();
		let nextRun: Promise<void> | null = null;

		const criticalSection = async () => {
			this.log('Trying to download schemas of new Pulumi packages');
			const newPkgs = await this.findNewPulumiPkgs();
			const downloads = newPkgs.map(([pkgName, version]) =>
				this.downloadPackageSchema(pkgName, version).then(async (schema): Promise<void> => {
					if (schema !== undefined) {
						this.loadPkgSchema(schema);
						if (this.config.cacheDownloadedSchemas) await this.cachePkgSchema(schema);
					}
				})
			);
			await Promise.all(downloads);
		};

		return () => {
			if (nextRun === null)
				nextRun = previousRun.then(() => {
					previousRun = criticalSection();
					nextRun = null;
					return previousRun;
				});
			return nextRun;
		};
	})();

	/**
	 * @returns List of new modules as tuple of name and optional version in semver format
	 */
	private async findNewPulumiPkgs(): Promise<
		ReadonlyArray<readonly [string, string | undefined]>
	> {
		const modules = [
			...this.moduleLoader.modules().keys(),
			...this.moduleLoader.isolatedModules().keys(),
			...this.moduleLoader.mockedModules().keys(),
		];
		const newPkgJSONs = Array.from(new Set(modules)).filter(
			(module) => module.endsWith('/package.json') && !this.processedPkgJSONs.has(module)
		);
		newPkgJSONs.forEach((pkgJson) => this.processedPkgJSONs.add(pkgJson));
		const foundPkgs = await Promise.all(newPkgJSONs.map((j) => this.findPulumiPkgInPkgJSON(j)));
		return foundPkgs
			.flatMap((pkg) => (pkg === undefined ? [] : [pkg]))
			.filter(
				// Ignore already loaded packages (if version is specified, only ignore if same version is loaded)
				([pkgName, pkgVersion]) =>
					!this.loadedPkgSchemas.has(pkgName) ||
					(pkgVersion !== undefined &&
						!this.loadedPkgSchemas.get(pkgName)?.has(pkgVersion))
			);
	}

	private async findPulumiPkgInPkgJSON(
		file: string
	): Promise<readonly [string, string | undefined] | undefined> {
		this.log(`Searching for Pulumi package in ${file}`);
		try {
			const content = assertParse<Readonly<{ scripts: Readonly<{ install: string }> }>>(
				(await fs.readFile(file)).toString()
			);
			const match = content.scripts.install.match(/\s+resource\s+([^\s]+)(\s+v([^\s]+))?/);
			if (match !== null) {
				this.log(`Found Pulumi package ${match[1]} (version: ${match[3]}) in ${file}`);
				return [match[1], match[3]];
			}
			this.log(`Did not find Pulumi package in ${file}`);
		} catch (e) {
			this.log(`Failed to find Pulumi package in ${file}. Cause: ${e}`);
		}
		return undefined;
	}

	private async downloadPackageSchema(
		pkgName: string,
		pkgVersion?: string
	): Promise<PkgSchema | undefined> {
		const pkg = pkgName + (pkgVersion === undefined ? '' : `@${pkgVersion}`);
		try {
			const result = await runPulumi(['package', 'get-schema', pkg], this.projectDir, {});
			const schema = assertParse<PkgSchema>(result.stdout);
			this.log(`Downloaded schema for Pulumi package ${pkg}`);
			return schema;
		} catch (e) {
			this.log(`Failed to download schema for Pulumi package ${pkg}. Cause: ${e}`);
			return undefined;
		}
	}

	private async cachePkgSchema(schema: PkgSchema): Promise<void> {
		await fs.mkdir(this.cacheDir, { recursive: true });
		const fileName = `${schema.name}@${schema.version}.json`;
		await fs.writeFile(path.join(this.cacheDir, fileName), stringify(schema));
	}
}
