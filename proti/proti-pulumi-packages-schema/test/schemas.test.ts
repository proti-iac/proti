import type { ModuleLoader } from '@proti/core';
import fs from 'fs';
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
	const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));

	const schema: ResourceSchema = {};
	const schemaType: ResourceType = 'a';
	const schemaPkgName: string = 'foo';
	const schemaPkgVersion: string = '1.2.3';
	const schemaPkg: string = `${schemaPkgName}@${schemaPkgVersion}`;
	const schemaFileName: string = path.join(cacheDir, `${schemaPkg}.json`);
	const schemaFile: PkgSchema = {
		name: schemaPkgName,
		version: schemaPkgVersion,
		resources: { a: schema },
	};
	const cachedSchema: ResourceSchema = { a: 2 };
	const cachedSchemaFileName: string = path.join(cacheDir, conf.cacheSubdir, `bar-1.2.3.json`);
	const cachedSchemaFile: PkgSchema = {
		name: 'bar',
		version: '1.2.3',
		resources: { a: cachedSchema },
	};

	beforeAll(() => {
		fs.mkdirSync(path.join(cacheDir, conf.cacheSubdir));
		fs.writeFileSync(schemaFileName, JSON.stringify(schemaFile));
		fs.writeFileSync(cachedSchemaFileName, JSON.stringify(cachedSchemaFile));
	});

	afterAll(() => {
		fs.rmSync(cacheDir, { recursive: true });
	});

	describe('initialization', () => {
		const init = (reInit: boolean = false) =>
			SchemaRegistry.initInstance(moduleLoader, conf, cacheDir, reInit);

		it('should fail without initialization', () => {
			expect(() => SchemaRegistry.getInstance()).toThrow(/registry not initialized/);
		});

		it('should initialize once', () => {
			init();
			const firstRegistry = SchemaRegistry.getInstance();
			init();
			expect(SchemaRegistry.getInstance()).toBe(firstRegistry);
		});

		it('should replace on forced re-initialization', () => {
			init();
			const firstRegistry = SchemaRegistry.getInstance();
			init(true);
			expect(SchemaRegistry.getInstance()).not.toBe(firstRegistry);
		});
	});

	describe('schema loading', () => {
		const init = (c: Partial<Config>) =>
			SchemaRegistry.initInstance(moduleLoader, { ...conf, ...c }, cacheDir, true);
		const getSchema = () => SchemaRegistry.getInstance().getSchema(schemaType);

		describe('initial', () => {
			it('loads package schema from cache', () => {
				init({});
				expect(getSchema()).toStrictEqual(cachedSchema);
			});

			it('does not load package schema that is not in cache', () => {
				init({ cacheSubdir: 'other' });
				expect(getSchema).toThrow(/not in schema registry/);
			});

			it('does not load package schema that is in cache, if disabled', () => {
				init({ loadCachedSchemas: false });
				expect(getSchema).toThrow(/not in schema registry/);
			});

			it('loads package schema from schemaFiles config', () => {
				init({ loadCachedSchemas: false, schemaFiles: [cachedSchemaFileName] });
				expect(getSchema()).toStrictEqual(cachedSchema);
			});

			it('does not load package schema from invalid schemaFiles config', () => {
				expect(() =>
					init({ loadCachedSchemas: false, schemaFiles: ['not-existing'] })
				).toThrow(/Failed to load Pulumi package schema file/);
			});

			it('schemaFiles config overrides cached schema', () => {
				init({ schemaFiles: [schemaFileName] });
				expect(getSchema()).toStrictEqual(schema);
			});

			it('loads resource schemas from schemas config', () => {
				const schemas: MutableResourceSchemas = {};
				schemas[schemaType] = cachedSchema;
				init({ loadCachedSchemas: false, schemas });
				expect(getSchema()).toStrictEqual(cachedSchema);
			});

			it('schemas config overrides schemaFiles config schemas', () => {
				const schemas: MutableResourceSchemas = {};
				schemas[schemaType] = schema;
				init({ schemaFiles: [cachedSchemaFileName], schemas });
				expect(getSchema()).toStrictEqual(schema);
			});
		});

		describe('manually load packge schema file', () => {
			it('should load schema from file', () => {
				init({});
				expect(getSchema()).toStrictEqual(cachedSchema);
				SchemaRegistry.getInstance().loadPkgSchemaFile(schemaFileName);
				expect(getSchema()).toStrictEqual(schema);
			});

			it('should not load file twice', () => {
				init({});
				fs.copyFileSync(schemaFileName, `${schemaFileName}2`);
				SchemaRegistry.getInstance().loadPkgSchemaFile(`${schemaFileName}2`);
				fs.rmSync(`${schemaFileName}2`);
				// Next line does not fail because fail was already loaded and is not loaded again
				SchemaRegistry.getInstance().loadPkgSchemaFile(`${schemaFileName}2`);
			});
		});
	});
});
