import type { ModuleLoader } from '@proti/core';
import { promises as fs } from 'fs';
import type { CommandResult } from '@pulumi/pulumi/automation';
import os from 'os';
import path from 'path';
import { stringify } from 'typia';
import { config, SchemaRegistryConfig } from '../src/config';
import {
	MutableResourceSchemas,
	PkgSchema,
	ResourceType,
	ResourceSchema,
	runPulumi,
} from '../src/pulumi';
import { SchemaRegistry } from '../src/schema-registry';

jest.mock('../src/pulumi', () => ({ runPulumi: jest.fn() }));

describe('schema registry', () => {
	const conf = config().registry;
	const log = () => {};
	let projDir: string;
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
		[cacheDir, projDir, schemaPkgJsonFile, schemaPkgJsonNoVFile] = await Promise.all(
			['foo-', 'project-', 'pkg-', 'pkg-nov-'].map((name) =>
				fs.mkdtemp(path.join(os.tmpdir(), name))
			)
		);
		pkgSchemaFile = path.join(cacheDir, `${schemaPkg}.json`);
		cachedPkgSchemaFile = path.join(cacheDir, conf.cacheSubdir, 'bar@1.2.3.json');
		schemaPkgJsonFile = path.join(schemaPkgJsonFile, 'package.json');
		schemaPkgJsonNoVFile = path.join(schemaPkgJsonNoVFile, 'package.json');
		await Promise.all([
			fs.writeFile(pkgSchemaFile, stringify(pkgSchema)),
			fs.writeFile(cachedPkgSchemaFile, stringify(cachedPkgSchema)),
			fs.writeFile(schemaPkgJsonFile, stringify(schemaPkgJson)),
			fs.writeFile(schemaPkgJsonNoVFile, stringify(schemaPkgJsonNoV)),
			fs.mkdir(path.join(cacheDir, conf.cacheSubdir)),
		]);
	});

	afterAll(() =>
		Promise.all(
			[
				projDir,
				cacheDir,
				path.dirname(schemaPkgJsonFile),
				path.dirname(schemaPkgJsonNoVFile),
			].map((dir) => fs.rm(dir, { recursive: true }))
		)
	);

	describe('initialization', () => {
		const init = async (reInit: boolean = false) => {
			const moduleLoader = new (jest.fn<ModuleLoader, []>())();
			await SchemaRegistry.initInstance(moduleLoader, conf, projDir, cacheDir, log, reInit);
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
			c: Partial<SchemaRegistryConfig>,
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
				projDir,
				cacheDir,
				log,
				true
			);
		};
		const getSchema = (type: ResourceType = schemaType) =>
			SchemaRegistry.getInstance().getSchema(type);

		describe('initialization', () => {
			it('loads package schema from cache', async () => {
				await init({});
				expect(await getSchema()).toStrictEqual(cachedSchema);
			});

			it('does not load package schema that is not in cache', async () => {
				await init({ cacheSubdir: 'other' });
				expect(await getSchema()).toBe(undefined);
			});

			it('does not load package schema that is in cache, if disabled', async () => {
				await init({ loadCachedSchemas: false });
				expect(await getSchema()).toBe(undefined);
			});

			it('loads package schema from schemaFiles config', async () => {
				await init({ loadCachedSchemas: false, schemaFiles: [cachedPkgSchemaFile] });
				expect(await getSchema()).toStrictEqual(cachedSchema);
			});

			it('does not load package schema from invalid schemaFiles config', () =>
				expect(() =>
					init({ loadCachedSchemas: false, schemaFiles: ['not-existing'] })
				).rejects.toThrow(/Failed to load Pulumi package schema file/));

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
					stdout: stringify(downloadedSchema),
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
					await init(
						{ loadCachedSchemas: false, cacheDownloadedSchemas: false },
						...modules()
					);
					expect(await getSchema()).toStrictEqual(schema);
					expect(pulumi).toHaveBeenCalledWith(
						['package', 'get-schema', hasVersion ? schemaPkg : schemaPkgName],
						projDir,
						{}
					);
					expect(pulumi).toHaveBeenCalledTimes(1);
				}
			);

			it('does not download schemas if resource schema is registered', async () => {
				const pulumi = initPulumiMock();
				await init({}, new Map([[schemaPkgJsonFile, null]]));
				expect(await getSchema()).toStrictEqual(cachedSchema);
				expect(pulumi).toHaveBeenCalledTimes(0);
			});

			it('does not download schemas if downloading disabled', async () => {
				const pulumi = initPulumiMock();
				await init(
					{ loadCachedSchemas: false, downloadSchemas: false },
					new Map([[schemaPkgJsonFile, null]])
				);
				expect(await getSchema()).toBe(undefined);
				expect(pulumi).toHaveBeenCalledTimes(0);
			});

			it('does not download schemas if package.json not existing', async () => {
				const pulumi = initPulumiMock();
				await init({ loadCachedSchemas: false }, new Map([['INVALID/package.json', null]]));
				expect(await getSchema()).toBe(undefined);
				expect(pulumi).toHaveBeenCalledTimes(0);
			});

			it('does not find resource schema after Pulumi failed downloading package schema', async () => {
				const pulumi = initPulumiMock();
				await init(
					{ loadCachedSchemas: false, cacheDownloadedSchemas: false },
					new Map([[schemaPkgJsonFile, null]])
				);
				expect(await getSchema()).toBe(undefined);
				expect(pulumi).toHaveBeenCalledTimes(1);
			});

			it.each([
				'',
				'INVALID JSON',
				stringify({}),
				stringify({
					scripts: {
						install: `node scripts/install-pulumi-plugin.js resorce ${schemaPkgName} v${schemaPkgVersion}`,
					},
				}),
			])(
				'does not download schemas if wrong package.json content: %s',
				async (packageJson) => {
					const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'baz'));
					const file = path.join(dir, 'package.json');
					await fs.writeFile(file, packageJson);
					const pulumi = initPulumiMock();
					await init({ loadCachedSchemas: false }, new Map([[file, null]]));
					expect(await getSchema()).toBe(undefined);
					expect(pulumi).toHaveBeenCalledTimes(0);
					await fs.rm(dir, { recursive: true });
				}
			);

			it.each([
				['does not download for loaded package', true, true, true, false],
				['downloads for other package version', true, true, false, true],
				['downloads for not loaded package', true, false, true, true],
				['does not download for loaded package (no version)', false, true, true, false],
				['does not download for other version (no version)', false, true, false, false],
				['downloads for not loaded package (no version)', false, false, true, true],
			])(
				'%s found in package.json',
				async (_, withVersion, sameName, sameVersion, download) => {
					const pulumi = initPulumiMock();
					const tmpFile = path.join(cacheDir, conf.cacheSubdir, 'tmp.json');
					await fs.writeFile(
						tmpFile,
						stringify<PkgSchema>({
							name: sameName ? schemaPkgName : 'balla',
							version: sameVersion ? schemaPkgVersion : '4.5.6',
							resources: { resource: { nonSchemaField: true } },
						})
					);

					await init(
						{},
						new Map([[withVersion ? schemaPkgJsonFile : schemaPkgJsonNoVFile, null]])
					);
					expect(await getSchema('b')).toBe(undefined);
					expect(pulumi).toHaveBeenCalledTimes(download ? 1 : 0);

					await fs.rm(tmpFile); // Cleanup
				}
			);

			describe('caching', () => {
				it.each([
					['adds', true, 1],
					['does not add', false, 2],
				])(
					'%s downloaded schemas to cache',
					async (_, cacheDownloadedSchemas, pulumiCalls) => {
						const pulumi = initPulumiMock({
							name: 'barz',
							version: '4.5.6',
							resources: { b: schema },
						});
						const cacheFile = path.join(cacheDir, conf.cacheSubdir, 'barz@4.5.6.json');
						await expect(fs.access(cacheFile)).rejects.toThrow(); // Precondition: cache file does not exist yet
						const modules = new Map([[schemaPkgJsonFile, null]]);

						await init({ cacheDownloadedSchemas }, modules);
						expect(await getSchema('b')).toStrictEqual(schema);
						await init({ cacheDownloadedSchemas }, modules);
						expect(await getSchema('b')).toStrictEqual(schema);

						expect(pulumi).toHaveBeenCalledTimes(pulumiCalls);
						if (cacheDownloadedSchemas) {
							await expect(fs.access(cacheFile)).resolves.toBe(undefined);
							await fs.rm(cacheFile); // Cleanup after test
						} else {
							await expect(fs.access(cacheFile)).rejects.toThrow();
						}
					}
				);

				it('creates cache dir if missing', async () => {
					initPulumiMock({
						name: 'barz',
						version: '4.5.6',
						resources: { b: schema },
					});
					const cacheSubdir = 'anotherTmp';
					const fullCacheDir = path.join(cacheDir, cacheSubdir);
					await expect(fs.access(fullCacheDir)).rejects.toThrow(); // Precondition: cache dir does not exist yet

					const modules = new Map([[schemaPkgJsonFile, null]]);
					await init({ cacheSubdir }, modules);
					expect(await getSchema('b')).toStrictEqual(schema);

					await expect(fs.access(fullCacheDir)).resolves.toBe(undefined);
					await fs.rm(fullCacheDir, { recursive: true });
				});
			});
		});
	});
});
