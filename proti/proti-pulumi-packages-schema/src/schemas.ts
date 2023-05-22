import path from 'path';
import type { Config } from './config';

export type ResourceType = string;
export type Schema = any;
export type Schemas = Record<ResourceType, Schema>;

export class SchemaRegistry {
	private static instance: SchemaRegistry;

	private readonly schemas = new Map<ResourceType, Schema>();

	private constructor(
		private readonly config: Config,
		private readonly cacheDir: string,
		private readonly log: (msg: string) => void
	) {
		log('Initializing Pulumi packages schema registry');
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
}
