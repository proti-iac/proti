import type { ModuleLoader } from '@proti/core';
import fs from 'fs';
import path from 'path';
import { assertEquals, is, TypeGuardError } from 'typia';
import type { Config } from './config';

export type ResourceType = string;
export type ResourceSchema = any;
export type MutableResourceSchemas = Record<ResourceType, ResourceSchema>;
export type ResourceSchemas = Readonly<MutableResourceSchemas>;
export type PkgSchema = Readonly<{
	name: string;
	version: string;
	resources: ResourceSchemas;
}>;

export class SchemaRegistry {
	private static instance: SchemaRegistry;

	/**
	 * Package name (key) and package versions (value, format: \d+.\d+.\d+) of loaded package schemas.
	 */
	private readonly loadedPkgSchemas: Map<string, Set<string>> = new Map();

	private readonly loadedPkgSchemaFiles: Set<string> = new Set();

	private readonly resourceSchemas = new Map<ResourceType, ResourceSchema>();

	private constructor(
		private readonly moduleLoader: ModuleLoader,
		private readonly config: Config,
		private readonly cacheDir: string,
		private readonly log: (msg: string) => void
	) {
		this.log('Initializing Pulumi packages schema registry');
		if (config.loadCachedSchemas) {
			this.log('Loading cached package schemas');
			this.findCachedPkgSchemaFiles().forEach((file) => this.loadPkgSchemaFile(file));
		}
		this.log('Loading configured package schema files');
		this.config.schemaFiles.forEach((file) => this.loadPkgSchemaFile(file));
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
	public static initInstance(
		moduleLoader: ModuleLoader,
		config: Config,
		cacheDir: string,
		forceInit = false
	): void {
		if (!SchemaRegistry.instance || forceInit)
			SchemaRegistry.instance = new SchemaRegistry(
				moduleLoader,
				config,
				path.resolve(cacheDir, config.cacheSubdir),
				config.verbose ? console.log : () => {}
			);
		else SchemaRegistry.instance.log('Skipping Pulumi packages schema registry initalization');
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

	private findCachedPkgSchemaFiles(): string[] {
		return fs.existsSync(this.cacheDir)
			? fs.readdirSync(this.cacheDir).map((file) => path.resolve(this.cacheDir, file))
			: [];
	}

	/**
	 * Load als resource schemas from a Pulumi package schema stored in a JSON file into the registry.
	 */
	public loadPkgSchemaFile(file: string): void {
		if (this.loadedPkgSchemaFiles.has(file)) {
			this.log(`Skip loading already loaded Pulumi package schema from ${file}`);
			return;
		}
		this.log(`Loading Pulumi package schema from ${file}`);
		try {
			const schemaFileContent = fs.readFileSync(file).toString();
			const schemaJson = JSON.parse(schemaFileContent);
			const schema = assertEquals<PkgSchema>(schemaJson);
			this.loadPkgSchema(schema, file);
		} catch (e: unknown) {
			const err = 'Failed to load Pulumi package schema file';
			const typeGuardError = is<TypeGuardError>(e) ? ' due to invalid schema format' : '';
			throw new Error(`${err}${typeGuardError}: ${file}`, { cause: e });
		}
	}

	private loadPkgSchema(schema: PkgSchema, file?: string): void {
		this.log(`Loading resource schemas of  package ${schema.name} version ${schema.version}`);
		Object.entries(schema.resources).forEach(([type, resourceSchema]) =>
			this.registerSchema(type, resourceSchema)
		);
		if (file !== undefined) this.loadedPkgSchemaFiles.add(file);
		const pkgSchemaVersionsLoaded = this.loadedPkgSchemas.get(schema.name);
		if (pkgSchemaVersionsLoaded === undefined)
			this.loadedPkgSchemas.set(schema.name, new Set(schema.version));
		else pkgSchemaVersionsLoaded.add(schema.version);
	}

	private registerSchema(type: ResourceType, schema: ResourceSchema): void {
		this.log(`Registering Pulumi packages schema for ${type}`);
		this.resourceSchemas.set(type, schema);
	}

	public getSchema(type: ResourceType): ResourceSchema {
		if (this.resourceSchemas.has(type) === false)
			throw new Error(`Schema for resource type ${type} not in schema registry`);
		return this.resourceSchemas.get(type);
	}
}
