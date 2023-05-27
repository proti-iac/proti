import type { ModuleLoader } from '@proti/core';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { Config, config } from '../src/config';
import {
	ResourceType,
	ResourceSchema,
	SchemaRegistry,
	MutableResourceSchemas,
	PkgSchema,
} from '../src/schemas';

describe('schema registry', () => {
	const moduleLoader = new (jest.fn<ModuleLoader, []>())();
	const conf = config();
	let cacheDir: string;

	const schema: ResourceSchema = {};
	const schemaType: ResourceType = 'a';
	const schemaPkgName: string = 'foo';
	const schemaPkgVersion: string = '1.2.3';
	const schemaPkg: string = `${schemaPkgName}@${schemaPkgVersion}`;
	let schemaFileName: string;
	const schemaFile: PkgSchema = {
		name: schemaPkgName,
		version: schemaPkgVersion,
		resources: { a: schema },
	};
	const cachedSchema: ResourceSchema = { a: 2 };
	let cachedSchemaFileName: string;
	const cachedSchemaFile: PkgSchema = {
		name: 'bar',
		version: '1.2.3',
		resources: { a: cachedSchema },
	};

	beforeAll(async () => {
		cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'foo-'));
		schemaFileName = path.join(cacheDir, `${schemaPkg}.json`);
		cachedSchemaFileName = path.join(cacheDir, conf.cacheSubdir, `bar-1.2.3.json`);
		await Promise.all([
			fs.writeFile(schemaFileName, JSON.stringify(schemaFile)),
			fs.writeFile(cachedSchemaFileName, JSON.stringify(cachedSchemaFile)),
			fs.mkdir(path.join(cacheDir, conf.cacheSubdir)),
		]);
	});

	afterAll(async () => fs.rm(cacheDir, { recursive: true }));

	describe('initialization', () => {
		const init = (reInit: boolean = false) =>
			SchemaRegistry.initInstance(moduleLoader, conf, cacheDir, reInit);

		it('should fail without initialization', () => {
			expect(() => SchemaRegistry.getInstance()).toThrow(/registry not initialized/);
		});

		it('should initialize once', async () => {
			await init();
			const firstRegistry = SchemaRegistry.getInstance();
			await init();
			expect(SchemaRegistry.getInstance()).toBe(firstRegistry);
		});

		it('should replace on forced re-initialization', async () => {
			await init();
			const firstRegistry = SchemaRegistry.getInstance();
			await init(true);
			expect(SchemaRegistry.getInstance()).not.toBe(firstRegistry);
		});
	});

	describe('schema loading', () => {
		const init = (c: Partial<Config>) =>
			SchemaRegistry.initInstance(moduleLoader, { ...conf, ...c }, cacheDir, true);
		const getSchema = () => SchemaRegistry.getInstance().getSchema(schemaType);

		describe('initial', () => {
			it('loads package schema from cache', async () => {
				await init({});
				expect(await getSchema()).toStrictEqual(cachedSchema);
			});

			it('does not load package schema that is not in cache', async () => {
				await init({ cacheSubdir: 'other' });
				expect(getSchema).rejects.toThrow(/not in schema registry/);
			});

			it('does not load package schema that is in cache, if disabled', async () => {
				await init({ loadCachedSchemas: false });
				expect(getSchema).rejects.toThrow(/not in schema registry/);
			});

			it('loads package schema from schemaFiles config', async () => {
				await init({ loadCachedSchemas: false, schemaFiles: [cachedSchemaFileName] });
				expect(await getSchema()).toStrictEqual(cachedSchema);
			});

			it('does not load package schema from invalid schemaFiles config', () => {
				expect(() =>
					init({ loadCachedSchemas: false, schemaFiles: ['not-existing'] })
				).rejects.toThrow(/Failed to load Pulumi package schema file/);
			});

			it('schemaFiles config overrides cached schema', async () => {
				await init({ schemaFiles: [schemaFileName] });
				expect(await getSchema()).toStrictEqual(schema);
			});

			it('loads resource schemas from schemas config', async () => {
				const schemas: MutableResourceSchemas = {};
				schemas[schemaType] = cachedSchema;
				await init({ loadCachedSchemas: false, schemas });
				expect(await getSchema()).toStrictEqual(cachedSchema);
			});

			it('schemas config overrides schemaFiles config schemas', async () => {
				const schemas: MutableResourceSchemas = {};
				schemas[schemaType] = schema;
				await init({ schemaFiles: [cachedSchemaFileName], schemas });
				expect(await getSchema()).toStrictEqual(schema);
			});
		});

		describe('manually load packge schema file', () => {
			it('should load schema from file', async () => {
				await init({});
				expect(await getSchema()).toStrictEqual(cachedSchema);
				await SchemaRegistry.getInstance().loadPkgSchemaFile(schemaFileName);
				expect(await getSchema()).toStrictEqual(schema);
			});

			it('should not load file twice', async () => {
				await init({});
				await fs.copyFile(schemaFileName, `${schemaFileName}2`);
				await SchemaRegistry.getInstance().loadPkgSchemaFile(`${schemaFileName}2`);
				await fs.rm(`${schemaFileName}2`);
				// Next line does not fail because fail was already loaded and is not loaded again
				await SchemaRegistry.getInstance().loadPkgSchemaFile(`${schemaFileName}2`);
			});
		});
	});
});
