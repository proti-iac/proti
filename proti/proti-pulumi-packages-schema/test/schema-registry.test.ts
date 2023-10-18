import type { ModuleLoader } from '@proti-iac/core';
import { promises as fs } from 'fs';
import type { CommandResult } from '@pulumi/pulumi/automation';
import os from 'os';
import path from 'path';
import { stringify } from 'typia';
import { config, SchemaRegistryConfig } from '../src/config';
import {
	type PkgSchema,
	type ResourceDefinition,
	runPulumi,
	type TypeDefinition,
	type Urn,
} from '../src/pulumi';
import { SchemaRegistry } from '../src/schema-registry';

jest.mock('../src/pulumi', () => ({ runPulumi: jest.fn() }));

type Definitions = readonly [ResourceDefinition, TypeDefinition];

describe('schema registry', () => {
	const conf = config().registry;
	const log = () => {};
	let projDir: string;
	let cacheDir: string;

	const resourceDefinition: ResourceDefinition = { isComponent: true };
	const resourceType: Urn = 'aR';
	const typeDefinition: TypeDefinition = {
		properties: { type: { type: 'boolean', const: true } },
	};
	const type: Urn = 'aT';
	const definitions: Definitions = [resourceDefinition, typeDefinition];
	const pkgName: string = 'foo';
	const pkgVersion: string = '1.2.3';
	const pkg: string = `${pkgName}@${pkgVersion}`;
	let pkgSchemaFile: string;
	const pkgSchema: PkgSchema = {
		name: pkgName,
		version: pkgVersion,
		resources: { aR: resourceDefinition },
		types: { aT: typeDefinition },
	};
	const pkgJson = {
		scripts: {
			install: `node scripts/install-pulumi-plugin.js resource ${pkgName} v${pkgVersion}`,
		},
	};
	let pkgJsonFile: string;
	const pkgJsonNoV = {
		scripts: {
			install: `node scripts/install-pulumi-plugin.js resource ${pkgName}`,
		},
	};
	let pkgJsonNoVFile: string;

	const cachedResourceDefinition: ResourceDefinition = { a: 2 };
	const cachedTypeDefinition: TypeDefinition = { cachedType: 'yay' };
	const cachedDefinitions: Definitions = [cachedResourceDefinition, cachedTypeDefinition];
	let cachedPkgSchemaFile: string;
	const cachedPkgSchema: PkgSchema = {
		name: 'bar',
		version: '1.2.3',
		resources: { aR: cachedResourceDefinition },
		types: { aT: cachedTypeDefinition },
	};

	beforeAll(async () => {
		[cacheDir, projDir, pkgJsonFile, pkgJsonNoVFile] = await Promise.all(
			['foo-', 'project-', 'pkg-', 'pkg-nov-'].map((name) =>
				fs.mkdtemp(path.join(os.tmpdir(), name))
			)
		);
		pkgSchemaFile = path.join(cacheDir, `${pkg}.json`);
		cachedPkgSchemaFile = path.join(cacheDir, conf.cacheSubdir, 'bar@1.2.3.json');
		pkgJsonFile = path.join(pkgJsonFile, 'package.json');
		pkgJsonNoVFile = path.join(pkgJsonNoVFile, 'package.json');
		await fs.mkdir(path.join(cacheDir, conf.cacheSubdir));
		await Promise.all([
			fs.writeFile(pkgSchemaFile, stringify(pkgSchema)),
			fs.writeFile(cachedPkgSchemaFile, stringify(cachedPkgSchema)),
			fs.writeFile(pkgJsonFile, stringify(pkgJson)),
			fs.writeFile(pkgJsonNoVFile, stringify(pkgJsonNoV)),
		]);
	});

	afterAll(() =>
		Promise.all(
			[projDir, cacheDir, path.dirname(pkgJsonFile), path.dirname(pkgJsonNoVFile)].map(
				(dir) => fs.rm(dir, { recursive: true })
			)
		)
	);

	const init = async (
		reInit: boolean = false,
		c: Partial<SchemaRegistryConfig> = {},
		moduleLoader: ModuleLoader = new (jest.fn<ModuleLoader, []>())()
	) => {
		const c2 = { ...conf, ...c };
		await SchemaRegistry.initInstance(moduleLoader, c2, projDir, cacheDir, log, reInit);
	};

	describe('initialization', () => {
		it('should fail without initialization', () => {
			expect(() => SchemaRegistry.getInstance()).toThrow(/registry not initialized/);
		});

		it('should fail without waiting for initialization', async () => {
			init(); // do not await!
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

	describe('definition loading', () => {
		const initLoading = async (
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
					}) as unknown as ModuleLoader
			))();
			await init(true, c, moduleLoader);
		};
		const getDefinitions = async (resType: Urn = resourceType, tType: Urn = type) => [
			await SchemaRegistry.getInstance().getResource(resType),
			await SchemaRegistry.getInstance().getType(tType),
		];
		const noDefinitions = [undefined, undefined];

		describe('initialization', () => {
			it('loads package schema from cache', async () => {
				await initLoading({});
				expect(await getDefinitions()).toStrictEqual(cachedDefinitions);
			});

			it('does not load package schema that is not in cache', async () => {
				await initLoading({ cacheSubdir: 'other' });
				expect(await getDefinitions()).toStrictEqual(noDefinitions);
			});

			it('does not load package schema that is in cache, if disabled', async () => {
				await initLoading({ loadCachedSchemas: false });
				expect(await getDefinitions()).toStrictEqual(noDefinitions);
			});

			it('loads package schema from schemaFiles config', async () => {
				await initLoading({ loadCachedSchemas: false, schemaFiles: [cachedPkgSchemaFile] });
				expect(await getDefinitions()).toStrictEqual(cachedDefinitions);
			});

			it('does not load package schema from invalid schemaFiles config', () =>
				expect(() =>
					initLoading({ loadCachedSchemas: false, schemaFiles: ['not-existing'] })
				).rejects.toThrow(/Failed to load Pulumi package schema file/));

			it('schemaFiles config overrides cached schemas', async () => {
				await initLoading({ schemaFiles: [pkgSchemaFile] });
				expect(await getDefinitions()).toStrictEqual(definitions);
			});

			it('loads definitions from config', async () => {
				await initLoading({
					loadCachedSchemas: false,
					resources: { [resourceType]: cachedResourceDefinition },
					types: { [type]: cachedTypeDefinition },
				});
				expect(await getDefinitions()).toStrictEqual(cachedDefinitions);
			});

			it('configured definitions override schemaFiles config definitions', async () => {
				await initLoading({
					schemaFiles: [cachedPkgSchemaFile],
					resources: { [resourceType]: resourceDefinition },
					types: { [type]: typeDefinition },
				});
				expect(await getDefinitions()).toStrictEqual(definitions);
			});
		});

		describe('manual file loading', () => {
			it('should load schema from file', async () => {
				await initLoading({});
				expect(await getDefinitions()).toStrictEqual(cachedDefinitions);
				await SchemaRegistry.getInstance().loadPkgSchemaFile(pkgSchemaFile);
				expect(await getDefinitions()).toStrictEqual(definitions);
			});

			it('should not load file twice', async () => {
				await initLoading({});
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
						resourceDefinition ? Promise.resolve(result) : Promise.reject()
					);
			};

			const e: ReadonlyMap<string, any> = new Map<string, any>();
			it.each([
				['', () => [new Map([[pkgJsonFile, null]]), e, e], true],
				['isolated ', () => [e, new Map([[pkgJsonFile, null]]), e], true],
				['mocked ', () => [e, e, new Map([[pkgJsonFile, null]])], true],
				['no-ver. ', () => [new Map([[pkgJsonNoVFile, null]]), e, e], false],
				['no-ver. isolated ', () => [e, new Map([[pkgJsonNoVFile, null]]), e], false],
				['no-ver. mocked ', () => [e, e, new Map([[pkgJsonNoVFile, null]])], false],
			] as ReadonlyArray<
				readonly [
					string,
					() => readonly [
						ReadonlyMap<string, any>,
						ReadonlyMap<string, any>,
						ReadonlyMap<string, any>,
					],
					boolean,
				]
			>)(
				'downloads schemas from %smodules on missing resource schema',
				async (_, modules, hasVersion) => {
					const pulumi = initPulumiMock(pkgSchema);
					await initLoading(
						{ loadCachedSchemas: false, cacheDownloadedSchemas: false },
						...modules()
					);
					expect(await getDefinitions()).toStrictEqual(definitions);
					expect(pulumi).toHaveBeenCalledWith(
						['package', 'get-schema', hasVersion ? pkg : pkgName],
						projDir,
						{}
					);
					expect(pulumi).toHaveBeenCalledTimes(1);
				}
			);

			it('does not download schemas if resource is registered', async () => {
				const pulumi = initPulumiMock();
				await initLoading({}, new Map([[pkgJsonFile, null]]));
				expect(await getDefinitions()).toStrictEqual(cachedDefinitions);
				expect(pulumi).toHaveBeenCalledTimes(0);
			});

			it('does not download schemas if downloading disabled', async () => {
				const pulumi = initPulumiMock();
				await initLoading(
					{ loadCachedSchemas: false, downloadSchemas: false },
					new Map([[pkgJsonFile, null]])
				);
				expect(await getDefinitions()).toStrictEqual(noDefinitions);
				expect(pulumi).toHaveBeenCalledTimes(0);
			});

			it('does not download schemas if package.json not existing', async () => {
				const pulumi = initPulumiMock();
				await initLoading(
					{ loadCachedSchemas: false },
					new Map([['INVALID/package.json', null]])
				);
				expect(await getDefinitions()).toStrictEqual(noDefinitions);
				expect(pulumi).toHaveBeenCalledTimes(0);
			});

			it('does not find resource after Pulumi failed downloading package schema', async () => {
				const pulumi = initPulumiMock();
				await initLoading(
					{ loadCachedSchemas: false, cacheDownloadedSchemas: false },
					new Map([[pkgJsonFile, null]])
				);
				expect(await getDefinitions()).toStrictEqual(noDefinitions);
				expect(pulumi).toHaveBeenCalledTimes(1);
			});

			it.each([
				'',
				'INVALID JSON',
				stringify({}),
				stringify({
					scripts: {
						install: `node scripts/install-pulumi-plugin.js resorce ${pkgName} v${pkgVersion}`,
					},
				}),
			])(
				'does not download schemas if wrong package.json content: %s',
				async (packageJson) => {
					const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'baz'));
					const file = path.join(dir, 'package.json');
					await fs.writeFile(file, packageJson);
					const pulumi = initPulumiMock();
					await initLoading({ loadCachedSchemas: false }, new Map([[file, null]]));
					expect(await getDefinitions()).toStrictEqual(noDefinitions);
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
							name: sameName ? pkgName : 'balla',
							version: sameVersion ? pkgVersion : '4.5.6',
							resources: { resource: { nonSchemaField: true } },
						})
					);

					await initLoading(
						{},
						new Map([[withVersion ? pkgJsonFile : pkgJsonNoVFile, null]])
					);
					expect(await getDefinitions('b')).toStrictEqual([
						undefined,
						cachedTypeDefinition,
					]);
					expect(await getDefinitions(resourceType, 'b')).toStrictEqual([
						cachedResourceDefinition,
						undefined,
					]);
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
							resources: { bR: resourceDefinition },
							types: { bT: typeDefinition },
						});
						const cacheFile = path.join(cacheDir, conf.cacheSubdir, 'barz@4.5.6.json');
						await expect(fs.access(cacheFile)).rejects.toThrow(); // Precondition: cache file does not exist yet
						const modules = new Map([[pkgJsonFile, null]]);

						await initLoading({ cacheDownloadedSchemas }, modules);
						expect(await getDefinitions('bR', 'bT')).toStrictEqual(definitions);
						await initLoading({ cacheDownloadedSchemas }, modules);
						expect(await getDefinitions('bR', 'bT')).toStrictEqual(definitions);

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
						resources: { bR: resourceDefinition },
						types: { bT: typeDefinition },
					});
					const cacheSubdir = 'anotherTmp';
					const fullCacheDir = path.join(cacheDir, cacheSubdir);
					await expect(fs.access(fullCacheDir)).rejects.toThrow(); // Precondition: cache dir does not exist yet

					const modules = new Map([[pkgJsonFile, null]]);
					await initLoading({ cacheSubdir }, modules);
					expect(await getDefinitions('bR')).toStrictEqual([
						resourceDefinition,
						undefined,
					]);
					expect(await getDefinitions('bR', 'bT')).toStrictEqual(definitions);

					await expect(fs.access(fullCacheDir)).resolves.toBe(undefined);
					await fs.rm(fullCacheDir, { recursive: true });
				});
			});
		});
	});
});
