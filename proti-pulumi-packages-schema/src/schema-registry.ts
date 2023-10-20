import type { ModuleLoader } from '@proti-iac/core';
import { promises as fs } from 'fs';
import path from 'path';
import { assertParse, is, stringify, TypeGuardError } from 'typia';
import type { SchemaRegistryConfig } from './config';
import {
	type PkgSchema,
	type ResourceDefinition,
	runPulumi,
	type TypeDefinition,
	type Urn,
} from './pulumi';

export class SchemaRegistry {
	private static instance: SchemaRegistry;

	/**
	 * Package name (key) and package versions (value, format: \d+.\d+.\d+) of
	 * loaded package schemas.
	 */
	private readonly loadedPkgSchemas: Map<string, Set<string>> = new Map();

	private readonly loadedPkgSchemaFiles: Set<string> = new Set();

	/**
	 * package.json files that are already analyzed and can be skipped when
	 * searching new resource modules.
	 */
	private readonly processedPkgJSONs: Set<string> = new Set();

	private readonly resources = new Map<Urn, ResourceDefinition>();

	private readonly types = new Map<Urn, TypeDefinition>();

	private constructor(
		private readonly moduleLoader: ModuleLoader,
		private readonly config: SchemaRegistryConfig,
		private readonly projectDir: string,
		private readonly cacheDir: string,
		private readonly log: (msg: string) => void
	) {}

	private initialized: boolean = false;

	private async init(): Promise<void> {
		this.log('Initializing Pulumi packages schema registry');
		if (this.config.loadCachedSchemas) {
			this.log('Loading cached package schemas');
			const cachedSchemaFiles = await this.findCachedPkgSchemaFiles();
			await Promise.all(cachedSchemaFiles.map((file) => this.loadPkgSchemaFile(file)));
		}

		this.log(`Loading ${this.config.schemaFiles.length} configured package schema files`);
		await Promise.all(this.config.schemaFiles.map((file) => this.loadPkgSchemaFile(file)));

		const resourceCount = Object.keys(this.config.resources).length;
		const typeCount = Object.keys(this.config.types).length;
		this.log(`Adding configured definitions: ${resourceCount} resources, ${typeCount} types`);
		this.registerDefinitions(this.config.resources, this.config.types);

		this.initialized = true;
	}

	private static initialized: Promise<void>;

	/**
	 * (Re-)initializes registry instance. Must be called and awaited once
	 * before {@link getInstance}.
	 * @param moduleLoader Program's module loader.
	 * @param config Plugin config.
	 * @param projectDir Jest project directorry.
	 * @param cacheDir Jest project cache directory.
	 * @param logger Logging function.
	 * @param forceInit If false, re-initialization is ignored. If true, a new
	 * registry replaces previous one.
	 */
	public static async initInstance(
		moduleLoader: ModuleLoader,
		config: SchemaRegistryConfig,
		projectDir: string,
		cacheDir: string,
		logger: (l: string) => void,
		forceInit = false
	): Promise<void> {
		if (!SchemaRegistry.instance || forceInit) {
			SchemaRegistry.instance = new SchemaRegistry(
				moduleLoader,
				config,
				projectDir,
				path.resolve(cacheDir, config.cacheSubdir),
				logger
			);
			SchemaRegistry.initialized = SchemaRegistry.instance.init();
		} else
			SchemaRegistry.instance.log('Skipping Pulumi packages schema registry initalization');
		await SchemaRegistry.initialized;
	}

	/**
	 * Returns schema registry instance after it was initialized.
	 * {@link initInstance} must be called and awaited before.
	 * @returns schema registry
	 * @throws If {@link initInstance} was not called and awaited before.
	 */
	public static getInstance(): SchemaRegistry {
		const { instance } = SchemaRegistry;
		if (!instance || !instance.initialized)
			throw new Error('Pulumi packages schema registry not initialized');
		return instance;
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
	 * Load all definitions from a Pulumi package schema JSON file.
	 * @param file Path of JSON file containing Pulumi package schema.
	 * @returns Promise that resolves once all definitions are loaded from file.
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
		this.log(`Loading definitions of Pulumi package ${schema.name}@${schema.version}`);
		this.registerDefinitions(schema.resources, schema.types);
		if (file !== undefined) this.loadedPkgSchemaFiles.add(file);
		const pkgSchemaVersionsLoaded = this.loadedPkgSchemas.get(schema.name);
		if (pkgSchemaVersionsLoaded === undefined)
			this.loadedPkgSchemas.set(
				schema.name,
				new Set(schema.version === undefined ? [] : [schema.version])
			);
		else if (schema.version !== undefined) pkgSchemaVersionsLoaded.add(schema.version);
	}

	private registerDefinitions(
		resources: Readonly<Record<Urn, ResourceDefinition>> = {},
		types: Readonly<Record<Urn, TypeDefinition>> = {}
	): void {
		Object.keys(resources).forEach((type) => this.registerResource(type, resources[type]));
		Object.keys(types).forEach((type) => this.registerType(type, types[type]));
	}

	private registerResource(type: Urn, definition: ResourceDefinition): void {
		this.log(`Registering resource definition of ${type}`);
		this.resources.set(type, definition);
	}

	/**
	 * Retrieves the definition for a resource type from the registry. If
	 * resource type is not in registry and downloading schemas is enabled, it
	 * transparently downloads new Pulumi package schemas found in imported
	 * package.json modules.
	 * @param type Resource type.
	 * @returns Resource definition or `undefined` if definition not available.
	 */
	public async getResource(type: Urn): Promise<ResourceDefinition | undefined> {
		return this.getDefinition(type, this.resources);
	}

	private registerType(type: Urn, definition: TypeDefinition): void {
		this.log(`Registering type definition of ${type}`);
		this.types.set(type, definition);
	}

	/**
	 * Retrieves the definition for a type from the registry. If type is not in
	 * registry and downloading schemas is enabled, it transparently downloads
	 * new Pulumi package schemas found in imported package.json modules.
	 * @param type Type.
	 * @returns Type definition or `undefined` if definition not available.
	 */
	public getType(type: Urn): Promise<TypeDefinition | undefined> {
		return this.getDefinition(type, this.types);
	}

	private async getDefinition<T, D>(
		type: T,
		register: ReadonlyMap<T, D>
	): Promise<D | undefined> {
		const definition = register.get(type);
		if (definition === undefined && this.config.downloadSchemas) {
			await this.downloadPkgSchemas();
			return register.get(type);
		}
		return definition;
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
	 * @returns List of new Pulumi packages as tuple of name and optional
	 * version in semver format.
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
			// Some Pulumi versions write a line "Downloading provider: ..." to STDOUT
			// before returning the schema.
			// https://github.com/pulumi/pulumi/issues/14252
			const stdout = result.stdout.replace(/^Downloading provider:.*\n?/, '');
			const schema = assertParse<PkgSchema>(stdout);
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
