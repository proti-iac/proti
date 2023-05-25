import fs from 'fs';
import path from 'path';
import { assertEquals, is, TypeGuardError } from 'typia';
import type { Config } from './config';

export type ResourceType = string;
export type ResourceSchema = any;
export type ResourceSchemas = Record<ResourceType, ResourceSchema>;
export type SchemaFile = {
	name: string;
	version: string;
	resources: { [type: ResourceType]: ResourceSchema };
};

export class SchemaRegistry {
	private static instance: SchemaRegistry;

	private readonly loadedSchemaFiles: Set<string> = new Set();

	private readonly schemas = new Map<ResourceType, ResourceSchema>();

	private constructor(
		private readonly config: Config,
		private readonly cacheDir: string,
		private readonly log: (msg: string) => void
	) {
		this.log('Initializing Pulumi packages schema registry');
		if (config.loadCachedSchemas) {
			this.log('Loading cached schema files');
			this.findCachedSchemaFiles().forEach((file) => this.loadSchemaFile(file));
		}
		this.log('Loading configured schema files');
		this.config.schemaFiles.forEach((file) => this.loadSchemaFile(file));
		this.log('Add configured schemas');
		Object.entries(this.config.schemas).forEach(([type, resourceSchema]) =>
			this.registerSchema(type, resourceSchema)
		);
	}

	/**
	 * (Re-)initializes registry instance. Must be called before `getInstance`.
	 * @param config Plugin config.
	 * @param cacheDir Jest project cache directory.
	 * @param forceInit If false, re-initialization is ignored. If true, a new registry replaces previous one.
	 */
	public static initInstance(config: Config, cacheDir: string, forceInit = false): void {
		if (!SchemaRegistry.instance || forceInit)
			SchemaRegistry.instance = new SchemaRegistry(
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

	private findCachedSchemaFiles(): string[] {
		return fs.existsSync(this.cacheDir)
			? fs.readdirSync(this.cacheDir).map((file) => path.resolve(this.cacheDir, file))
			: [];
	}

	private loadSchemaFile(file: string): void {
		this.log(`Loading Pulumi package schemas from ${file}`);
		try {
			const schemaFileContent = fs.readFileSync(file).toString();
			const schemaFileJson = JSON.parse(schemaFileContent);
			const schemaFile = assertEquals<SchemaFile>(schemaFileJson);
			Object.entries(schemaFile.resources).forEach(([type, resourceSchema]) =>
				this.registerSchema(type, resourceSchema)
			);
			this.loadedSchemaFiles.add(`${schemaFile.name}-${schemaFile.version}`);
		} catch (e: unknown) {
			const err = 'Failed to load Pulumi package schema file';
			const typeGuardError = is<TypeGuardError>(e) ? ' due to invalid schema format' : '';
			throw new Error(`${err}${typeGuardError}: ${file}`, { cause: e });
		}
	}

	private registerSchema(type: ResourceType, schema: ResourceSchema): void {
		this.log(`Registering Pulumi packages schema for ${type}`);
		this.schemas.set(type, schema);
	}

	public getSchema(type: ResourceType): ResourceSchema {
		if (this.schemas.has(type) === false)
			throw new Error(`Schema for resource type ${type} not in schema registry`);
		return this.schemas.get(type);
	}
}
