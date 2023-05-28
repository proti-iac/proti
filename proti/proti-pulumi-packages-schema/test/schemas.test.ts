import type { ModuleLoader } from '@proti/core';
import { promises as fs } from 'fs';
import type { CommandResult } from '@pulumi/pulumi/automation';
import os from 'os';
import path from 'path';
import { Config, config } from '../src/config';
import { runPulumi } from '../src/pulumi';
import {
	ResourceType,
	ResourceSchema,
	SchemaRegistry,
	MutableResourceSchemas,
	PkgSchema,
} from '../src/schemas';

jest.mock('../src/pulumi', () => ({ runPulumi: jest.fn() }));

describe('schema registry', () => {
	const conf = config();
	let projectDir: string;
	let cacheDir: string;

	const schema: ResourceSchema = {};
	const schemaType: ResourceType = 'a';
	const schemaPkgName: string = 'foo';
	const schemaPkgVersion: string = '1.2.3';
	const schemaPkg: string = `${schemaPkgName}@${schemaPkgVersion}`;
	let pkgSchemaFile: string;
	const pkgSchema: PkgSchema = {
		name: schemaPkgName,
		version: schemaPkgVersion,
		resources: { a: schema },
	};
	const schemaPkgJson = {
		scripts: {
			install: `node scripts/install-pulumi-plugin.js resource ${schemaPkgName} v${schemaPkgVersion}`,
		},
	};
	let schemaPkgJsonFile: string;
	const schemaPkgJsonNoV = {
		scripts: {
			install: `node scripts/install-pulumi-plugin.js resource ${schemaPkgName}`,
		},
	};
	let schemaPkgJsonNoVFile: string;

	const cachedSchema: ResourceSchema = { a: 2 };
	let cachedPkgSchemaFile: string;
	const cachedPkgSchema: PkgSchema = {
		name: 'bar',
		version: '1.2.3',
		resources: { a: cachedSchema },
	};

	beforeAll(async () => {
		[cacheDir, projectDir, schemaPkgJsonFile, schemaPkgJsonNoVFile] = await Promise.all(
			['foo-', 'project-', 'pkg-', 'pkg-nov-'].map((name) =>
				fs.mkdtemp(path.join(os.tmpdir(), name))
			)
		);
		pkgSchemaFile = path.join(cacheDir, `${schemaPkg}.json`);
		cachedPkgSchemaFile = path.join(cacheDir, conf.cacheSubdir, 'bar-1.2.3.json');
		schemaPkgJsonFile = path.join(schemaPkgJsonFile, 'package.json');
		schemaPkgJsonNoVFile = path.join(schemaPkgJsonNoVFile, 'package.json');
		await Promise.all([
			fs.writeFile(pkgSchemaFile, JSON.stringify(pkgSchema)),
			fs.writeFile(cachedPkgSchemaFile, JSON.stringify(cachedPkgSchema)),
			fs.writeFile(schemaPkgJsonFile, JSON.stringify(schemaPkgJson)),
			fs.writeFile(schemaPkgJsonNoVFile, JSON.stringify(schemaPkgJsonNoV)),
			fs.mkdir(path.join(cacheDir, conf.cacheSubdir)),
		]);
	});

	afterAll(() =>
		Promise.all(
			[
				projectDir,
				cacheDir,
				path.dirname(schemaPkgJsonFile),
				path.dirname(schemaPkgJsonNoVFile),
			].map((dir) => fs.rm(dir, { recursive: true }))
		)
	);

	describe('initialization', () => {
		const init = async (reInit: boolean = false) => {
			const moduleLoader = new (jest.fn<ModuleLoader, []>())();
			await SchemaRegistry.initInstance(moduleLoader, conf, projectDir, cacheDir, reInit);
		};

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
		const init = async (
			c: Partial<Config>,
			modules: ReadonlyMap<string, any> = new Map(),
			isolatedModules: ReadonlyMap<string, any> = new Map(),
			mockedModules: ReadonlyMap<string, any> = new Map()
		) => {
			const moduleLoader = new (jest.fn<ModuleLoader, []>(
				() =>
					({
						modules: () => modules,
						isolatedModules: () => isolatedModules,
						mockedModules: () => mockedModules,
					} as unknown as ModuleLoader)
			))();
			await SchemaRegistry.initInstance(
				moduleLoader,
				{ ...conf, ...c },
				projectDir,
				cacheDir,
				true
			);
		};
		const getSchema = () => SchemaRegistry.getInstance().getSchema(schemaType);

		describe('initialization', () => {
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
				await init({ loadCachedSchemas: false, schemaFiles: [cachedPkgSchemaFile] });
				expect(await getSchema()).toStrictEqual(cachedSchema);
			});

			it('does not load package schema from invalid schemaFiles config', () => {
				expect(() =>
					init({ loadCachedSchemas: false, schemaFiles: ['not-existing'] })
				).rejects.toThrow(/Failed to load Pulumi package schema file/);
			});

			it('schemaFiles config overrides cached schema', async () => {
				await init({ schemaFiles: [pkgSchemaFile] });
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
				await init({ schemaFiles: [cachedPkgSchemaFile], schemas });
				expect(await getSchema()).toStrictEqual(schema);
			});
		});

		describe('manually file loading', () => {
			it('should load schema from file', async () => {
				await init({});
				expect(await getSchema()).toStrictEqual(cachedSchema);
				await SchemaRegistry.getInstance().loadPkgSchemaFile(pkgSchemaFile);
				expect(await getSchema()).toStrictEqual(schema);
			});

			it('should not load file twice', async () => {
				await init({});
				await fs.copyFile(pkgSchemaFile, `${pkgSchemaFile}2`);
				await SchemaRegistry.getInstance().loadPkgSchemaFile(`${pkgSchemaFile}2`);
				await fs.rm(`${pkgSchemaFile}2`);
				// Next line does not fail because fail was already loaded and is not loaded again
				await SchemaRegistry.getInstance().loadPkgSchemaFile(`${pkgSchemaFile}2`);
			});
		});

		describe('automated downloading', () => {
			const initPulumiMock = (downloadedSchema?: PkgSchema) => {
				const result: CommandResult = {
					code: 0,
					stdout: JSON.stringify(downloadedSchema),
					stderr: '',
				};
				return (runPulumi as jest.MockedFunction<typeof runPulumi>)
					.mockReset()
					.mockImplementation(() =>
						schema ? Promise.resolve(result) : Promise.reject()
					);
			};

			const e: ReadonlyMap<string, any> = new Map<string, any>();
			it.each([
				['', () => [new Map([[schemaPkgJsonFile, null]]), e, e], true],
				['isolated ', () => [e, new Map([[schemaPkgJsonFile, null]]), e], true],
				['mocked ', () => [e, e, new Map([[schemaPkgJsonFile, null]])], true],
				['no-ver. ', () => [new Map([[schemaPkgJsonNoVFile, null]]), e, e], false],
				['no-ver. isolated ', () => [e, new Map([[schemaPkgJsonNoVFile, null]]), e], false],
				['no-ver. mocked ', () => [e, e, new Map([[schemaPkgJsonNoVFile, null]])], false],
			] as ReadonlyArray<readonly [string, () => readonly [ReadonlyMap<string, any>, ReadonlyMap<string, any>, ReadonlyMap<string, any>], boolean]>)(
				'downloads schemas from %smodules on missing resource schema',
				async (_, modules, hasVersion) => {
					const pulumi = initPulumiMock(pkgSchema);
					await init({ loadCachedSchemas: false }, ...modules());
					expect(await getSchema()).toStrictEqual(schema);
					expect(pulumi).toHaveBeenCalledWith(
						['package', 'get-schema', hasVersion ? schemaPkg : schemaPkgName],
						projectDir,
						{}
					);
					expect(pulumi).toHaveBeenCalledTimes(1);
				}
			);
		});
	});
});
