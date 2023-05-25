import fs from 'fs';
import os from 'os';
import path from 'path';
import { Config, config } from '../src/config';
import {
	ResourceType,
	ResourceSchema,
	SchemaRegistry,
	ResourceSchemas,
	SchemaFile,
} from '../src/schemas';

describe('schema registry', () => {
	const conf = config();
	const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));

	const schema: ResourceSchema = {};
	const schemaType: ResourceType = 'a';
	const schemaFileName: string = path.join(cacheDir, `foo-1.2.3.json`);
	const schemaFile: SchemaFile = {
		name: 'foo',
		version: '1.2.3',
		resources: { a: schema },
	};
	const cachedSchema: ResourceSchema = { a: 2 };
	const cachedSchemaFileName: string = path.join(cacheDir, conf.cacheSubdir, `bar-1.2.3.json`);
	const cachedSchemaFile: SchemaFile = {
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
		it('should fail without initialization', () => {
			expect(() => SchemaRegistry.getInstance()).toThrow(/registry not initialized/);
		});

		it('should initialize once', () => {
			SchemaRegistry.initInstance(conf, cacheDir);
			const firstRegistry = SchemaRegistry.getInstance();
			SchemaRegistry.initInstance(conf, cacheDir);
			expect(SchemaRegistry.getInstance()).toBe(firstRegistry);
		});

		it('should replace on forced re-initialization', () => {
			SchemaRegistry.initInstance(conf, cacheDir);
			const firstRegistry = SchemaRegistry.getInstance();
			SchemaRegistry.initInstance(conf, cacheDir, true);
			expect(SchemaRegistry.getInstance()).not.toBe(firstRegistry);
		});
	});

	describe('initial schema loading', () => {
		const init = (c: Partial<Config>) =>
			SchemaRegistry.initInstance({ ...conf, ...c }, cacheDir, true);
		const getSchema = () => SchemaRegistry.getInstance().getSchema(schemaType);

		it('loads schema from cache', () => {
			init({});
			expect(getSchema()).toStrictEqual(cachedSchema);
		});

		it('does not load schema that is not in cache', () => {
			init({ cacheSubdir: 'other' });
			expect(getSchema).toThrow(/not in schema registry/);
		});

		it('does not load schema that is in cache, if disabled', () => {
			init({ loadCachedSchemas: false });
			expect(getSchema).toThrow(/not in schema registry/);
		});

		it('loads schema from schemaFiles config', () => {
			init({ loadCachedSchemas: false, schemaFiles: [cachedSchemaFileName] });
			expect(getSchema()).toStrictEqual(cachedSchema);
		});

		it('does not load schema from invalid schemaFiles config', () => {
			expect(() => init({ loadCachedSchemas: false, schemaFiles: ['not-existing'] })).toThrow(
				/Failed to load Pulumi package schema file/
			);
		});

		it('schemaFiles config overrides cached schema', () => {
			init({ schemaFiles: [schemaFileName] });
			expect(getSchema()).toStrictEqual(schema);
		});

		it('loads schema from schemas config', () => {
			const schemas: ResourceSchemas = {};
			schemas[schemaType] = cachedSchema;
			init({ loadCachedSchemas: false, schemas });
			expect(getSchema()).toStrictEqual(cachedSchema);
		});

		it('schemas config overrides schemaFiles config schema', () => {
			const schemas: ResourceSchemas = {};
			schemas[schemaType] = schema;
			init({ schemaFiles: [cachedSchemaFileName], schemas });
			expect(getSchema()).toStrictEqual(schema);
		});
	});
});
