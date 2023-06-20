import * as fc from 'fast-check';
import type { CommandResult } from '@pulumi/pulumi/automation';
import { createAppendOnlyMap, mapValues } from '@proti/core';
import {
	builtInTypeUris,
	decodeUri,
	normalizeUri,
	runPulumi,
	setTransfResDefMock,
	setTransfTypeDefMock,
	transformNamedType,
	transformObjectTypeDetails,
	transformPropertyDefinition,
	transformResourceDefinition,
	transformTypeDefinition,
	transformTypeReference,
	type BuiltInTypeUri,
	type EncodedUri,
	type NamedType,
	type NamedTypeArgs,
	type NormalizedUri,
	type ObjectTypeDetails,
	type ResourceDefinition,
	type PropertyDefinition,
	type Transforms,
	type TypeReference,
	type TypeDefinition,
} from '../src/pulumi';
import {
	arrayTypeArb,
	mapTypeArb,
	namedTypeArb,
	objectTypeDetailsArb,
	primitiveTypeArb,
	propertyDefinitionArb,
	resourceDefinitionArb,
	typeDefinitionArb,
	unionTypeArb,
} from './pulumi-package-metaschema/arbitraries';
import { SchemaRegistry } from '../src/schema-registry';

import * as pulumi from '../src/pulumi';

describe('run pulumi', () => {
	it('should err', () =>
		expect(runPulumi(['version', 'fail'], process.cwd(), {})).rejects.toThrow(
			/stderr: Command failed with exit code 255: pulumi version fail --non-interactive/
		));

	it('should not err', () =>
		expect(
			runPulumi(['version'], process.cwd(), {}).then(({ code, err }: CommandResult) => ({
				code,
				err,
			}))
		).resolves.toEqual({
			code: 0,
			err: undefined,
		}));
});

const getResourceMock = jest.fn();
const getTypeMock = jest.fn();
jest.mock('../src/schema-registry', () => ({
	SchemaRegistry: {
		getInstance: () => ({
			getResource: getResourceMock,
			getType: getTypeMock,
		}),
	},
}));
const registry = SchemaRegistry.getInstance();

const stringify = (...v: any[]) => JSON.stringify(v);
const stringify1 = (a: any) => stringify(a);
const asyncStringify = (...v: any[]) => Promise.resolve(JSON.stringify(v));
const asyncStringify1 = (a: any) => asyncStringify(a);
const asyncStringify14 = (a: any, _: any, __: any, d: any) => asyncStringify(a, d);
const throws = () => {
	throw new Error('Testing error that should never be thrown');
};
const asyncThrows = () => Promise.reject(new Error('Testing error that should never be thrown'));
const transforms: Transforms<string> = {
	builtInType: asyncThrows,
	unresolvableUri: asyncThrows,
	cycleBreaker: throws,
	arrayType: asyncThrows,
	mapType: asyncThrows,
	primitive: asyncThrows,
	unionType: asyncThrows,
	resourceDef: asyncThrows,
	propDef: asyncThrows,
	const: asyncThrows,
	objType: asyncThrows,
	enumType: asyncThrows,
};
const ntArgs: NamedTypeArgs<string> = {
	registry,
	caching: false,
	cache: new Map(),
	appendCache: () => {},
	parentUris: [],
};

describe('normalize URI', () => {
	it('should be idempotent', () => {
		const predicate = (s: string) =>
			expect(normalizeUri(normalizeUri(s))).toBe(normalizeUri(s));
		fc.assert(fc.property(fc.string(), predicate));
	});

	it('should normalize', () => {
		const predicate = (s: string) => {
			const normUri = normalizeUri(s);
			expect(
				builtInTypeUris.includes(normUri as BuiltInTypeUri) ||
					!normUri.includes('#') ||
					normUri.length === 0 ||
					normUri[0] === '#'
			).toBe(true);
		};
		fc.assert(fc.property(fc.string(), predicate));
	});
});

describe('transform named type', () => {
	afterEach(() => {
		setTransfTypeDefMock();
		setTransfResDefMock();
	});
	const arb = (refArb: fc.Arbitrary<string>): fc.Arbitrary<NamedType> =>
		fc.tuple(namedTypeArb(), refArb).map(([namedType, $ref]) => ({ ...namedType, $ref }));
	const kArb = fc.oneof(fc.constantFrom('#/resources/', '#/types/'), fc.string());
	const uriArb = fc
		.tuple(
			fc.oneof(
				{ arbitrary: fc.constantFrom(...builtInTypeUris), weight: 1 },
				{ arbitrary: kArb, weight: 9 }
			),
			fc.string(),
			fc.integer({ max: 20 })
		)
		.map(([t, s, i]) =>
			builtInTypeUris.includes(t as BuiltInTypeUri) ? t : `${s.slice(0, i)}${t}${s.slice(i)}`
		);

	it('should transform built-in type URI', () => {
		const predicate = (namedType: NamedType, path: string) => {
			const ts = { ...transforms, builtInType: asyncStringify, unresolvableUri: asyncThrows };
			const e = transformNamedType(namedType, ts, ntArgs, path);
			const r = stringify(namedType.$ref, `${path}$builtIn:${namedType.$ref}`);
			return expect(e).resolves.toStrictEqual(r);
		};
		const ref = fc.constantFrom(...builtInTypeUris);
		return fc.assert(fc.asyncProperty(arb(ref), fc.string(), predicate));
	});

	it.each([
		['resources', 'types', resourceDefinitionArb(), getResourceMock, asyncStringify1, throws],
		['types', 'resources', typeDefinitionArb(), getTypeMock, throws, asyncStringify1],
	])('should transform %s URI', (kind, otherKind, kindArb, mock, transResDef, transTypeDef) => {
		const predicate = async (
			type: NamedType,
			def: ResourceDefinition | TypeDefinition,
			path: string
		) => {
			setTransfResDefMock(transResDef);
			setTransfTypeDefMock(transTypeDef);
			mock.mockReset().mockResolvedValue(def);
			const ts: Transforms<string> = {
				...transforms,
				builtInType: asyncThrows,
				unresolvableUri: asyncThrows,
			};
			const e = transformNamedType(type, ts, ntArgs, path);
			const r = stringify(def);
			await expect(e).resolves.toStrictEqual(r);
			expect(mock).toBeCalledTimes(1);
		};
		const resourceRef = (s: string) =>
			!s.includes(`#/${otherKind}/`) && !builtInTypeUris.some((t) => s.includes(t));
		const ref = fc
			.tuple(fc.string(), fc.integer({ max: 20 }), fc.boolean())
			.map(([s, i, encode]) => {
				const pref = s.slice(0, i).replace(/#/g, '');
				const suff = encode ? encodeURIComponent(s.slice(i)) : s.slice(i);
				return `${pref}#/${kind}/${suff}`;
			})
			.filter(resourceRef);
		return fc.assert(fc.asyncProperty(arb(ref), kindArb, fc.string(), predicate));
	});

	it('should transform unresolvable URI', () => {
		getResourceMock.mockResolvedValue(undefined);
		getTypeMock.mockResolvedValue(undefined);
		const predicate = (namedType: NamedType, path: string) => {
			const ts = { ...transforms, builtInType: asyncThrows, unresolvableUri: asyncStringify };
			const e = transformNamedType(namedType, ts, ntArgs, path);
			const r = stringify(normalizeUri(decodeUri(namedType.$ref)), `${path}$unresolvable`);
			return expect(e).resolves.toStrictEqual(r);
		};
		const ref = uriArb.filter((s: string) => !builtInTypeUris.some((t) => s.includes(t)));
		return fc.assert(fc.asyncProperty(arb(ref), fc.string(), predicate));
	});

	it.each([
		['cache', true, true, true],
		['not cache', false, false, false],
		['not cache if first call is not caching', false, true, false],
		['not cache if second call is not caching', true, false, false],
	])('should %s', async (_, cache1, cache2, cached) => {
		const predicate = async (type: NamedType, path: string) => {
			getResourceMock.mockReset();
			getTypeMock.mockReset();
			const asm = jest.fn().mockImplementation(asyncStringify);
			const ts: Transforms<string> = {
				...transforms,
				cycleBreaker: stringify,
				builtInType: asm,
				unresolvableUri: asm,
			};
			const [cache, appendCache] = createAppendOnlyMap<string, Promise<string>>();
			const subject = (caching: boolean) => {
				const ntArgsL: NamedTypeArgs<string> = {
					registry,
					caching,
					cache,
					appendCache,
					parentUris: [],
				};
				return transformNamedType(type, ts, ntArgsL, path);
			};
			const a = await subject(cache1);
			const b = await subject(cache2);

			// returned Ts and cache element are the same
			expect(a).toBe(b);
			if (cached) await expect(cache.values().next().value).resolves.toBe(a);

			// type resolution and transforms have not been called too often
			const resolveCalls = getResourceMock.mock.calls.length + getTypeMock.mock.calls.length;
			const callNum = cached ? 1 : 2;
			expect(resolveCalls).toBeLessThanOrEqual(callNum);
			expect(asm.mock.calls.length).toBe(callNum);
		};
		return fc.assert(fc.asyncProperty(arb(uriArb), fc.string(), predicate));
	});

	it.each([
		['should', true],
		['should not', false],
	])('%s insert cycle breaker for cyclic schemas', (_, hasParent) => {
		const predicate = async (ref: EncodedUri, path: string) => {
			const namedType: NamedType = { $ref: ref };
			const asm = jest.fn().mockImplementation(asyncStringify);
			const ts: Transforms<string> = {
				...transforms,
				cycleBreaker: asm,
			};
			const [cache, appendCache] = createAppendOnlyMap<NormalizedUri, Promise<string>>();
			appendCache(normalizeUri(decodeUri(ref)), Promise.resolve('VAL'));
			const ntArgsL: NamedTypeArgs<string> = {
				registry,
				caching: true,
				cache,
				appendCache,
				parentUris: hasParent ? [normalizeUri(decodeUri(ref))] : [],
			};
			await transformNamedType(namedType, ts, ntArgsL, path);
			expect(asm).toBeCalledTimes(hasParent ? 1 : 0);
		};
		return fc.assert(fc.asyncProperty(fc.string(), fc.string(), predicate));
	});
});

describe('transform union type', () => {
	// Tested in "transform type reference"
});
describe('transform array type', () => {
	// Tested in "transform type reference"
});
describe('transform map type', () => {
	// Tested in "transform type reference"
});

describe('transform type reference', () => {
	let spy: any;
	beforeAll(() => {
		spy = jest.spyOn(pulumi, 'transformNamedType').mockImplementation(asyncStringify14);
	});
	afterAll(() => spy.mockRestore());
	const subject = (typeRef: TypeReference, path: string) => {
		const ts = {
			...transforms,
			arrayType: asyncStringify,
			mapType: asyncStringify,
			primitive: asyncStringify,
			unionType: asyncStringify,
		};
		return transformTypeReference(typeRef, ts, ntArgs, path);
	};

	it('should transform named type', () => {
		const predicate = (typeRef: TypeReference, path: string) => {
			const e = subject(typeRef, path);
			return expect(e).resolves.toStrictEqual(stringify(typeRef, `${path}$namedType`));
		};
		return fc.assert(fc.asyncProperty(namedTypeArb(), fc.string(), predicate));
	});

	it('should transform union type', () => {
		const predicate = (typeRef: TypeReference, path: string) => {
			const r = typeRef.oneOf!.map((oneOf, i) =>
				stringify(oneOf.type, `${path}$unionType$oneOf:${i}$primitive:${oneOf.type}`)
			);
			const e = subject(typeRef, path);
			return expect(e).resolves.toStrictEqual(stringify(r, `${path}$unionType`));
		};
		return fc.assert(
			fc.asyncProperty(unionTypeArb(primitiveTypeArb()), fc.string(), predicate)
		);
	});

	it('should transform array type', () => {
		const predicate = (typeRef: TypeReference, path: string) => {
			const r = stringify(
				typeRef.items!.type,
				`${path}$arrayType$items$primitive:${typeRef.items!.type}`
			);
			const e = subject(typeRef, path);
			return expect(e).resolves.toStrictEqual(stringify(r, `${path}$arrayType`));
		};
		return fc.assert(
			fc.asyncProperty(arrayTypeArb(primitiveTypeArb()), fc.string(), predicate)
		);
	});

	it('should transform map type', () => {
		const predicate = (typeRef: TypeReference, path: string) => {
			const propType = typeRef.additionalProperties?.type || 'string';
			const r = stringify(
				propType,
				`${path}$mapType$additionalProperties$primitive:${propType}`
			);
			const e = subject(typeRef, path);
			return expect(e).resolves.toStrictEqual(stringify(r, `${path}$mapType`));
		};
		return fc.assert(fc.asyncProperty(mapTypeArb(primitiveTypeArb()), fc.string(), predicate));
	});
	// Primitive types is covered by the other type reference tests
});

describe('transform property definition', () => {
	let spy: any;
	beforeAll(() => {
		spy = jest.spyOn(pulumi, 'transformTypeReference').mockImplementation(asyncStringify1);
	});
	afterAll(() => spy.mockRestore());
	it('should use const if set', () => {
		const arb = propertyDefinitionArb().filter((propDef) => propDef.const !== undefined);
		const predicate = (propDef: PropertyDefinition, path: string) => {
			const r = stringify(propDef.const, `${path}$const`);
			const ts = { ...transforms, propDef: asyncStringify, const: asyncStringify };
			const e = transformPropertyDefinition(propDef, ts, ntArgs, path);
			return expect(e).resolves.toStrictEqual(r);
		};
		return fc.assert(fc.asyncProperty(arb, fc.string(), predicate));
	});

	it('should compose correctly if const unset', () => {
		const arb = propertyDefinitionArb().filter((propDef) => propDef.const === undefined);
		const predicate = (propDef: PropertyDefinition, path: string) => {
			const r = stringify(
				stringify(propDef),
				propDef.default === undefined ? undefined : stringify(propDef.default),
				path
			);
			const ts = { ...transforms, propDef: asyncStringify, const: asyncStringify1 };
			const e = transformPropertyDefinition(propDef, ts, ntArgs, path);
			return expect(e).resolves.toStrictEqual(r);
		};
		return fc.assert(fc.asyncProperty(arb, fc.string(), predicate));
	});
});

describe('transform object type details', () => {
	let spy: any;
	beforeAll(() => {
		spy = jest.spyOn(pulumi, 'transformPropertyDefinition').mockImplementation(asyncStringify1);
	});
	afterAll(() => spy.mockRestore());
	it('should compose correctly', () => {
		const predicate = (objType: ObjectTypeDetails, path: string) => {
			const r = stringify(
				mapValues(objType.properties || {}, stringify1),
				objType.required || [],
				path
			);
			const ts = { ...transforms, objType: asyncStringify };
			const e = transformObjectTypeDetails(objType, ts, ntArgs, path);
			return expect(e).resolves.toStrictEqual(r);
		};
		return fc.assert(fc.asyncProperty(objectTypeDetailsArb(), fc.string(), predicate));
	});
});

describe('transform type definition', () => {
	let spy: any;
	beforeAll(() => {
		spy = jest.spyOn(pulumi, 'transformObjectTypeDetails').mockImplementation(asyncStringify14);
	});
	afterAll(() => spy.mockRestore());
	it('should compose correctly', () => {
		const predicate = (typeDef: TypeDefinition, path: string) => {
			const t = typeDef?.type;
			const r =
				t === 'number' || t === 'boolean' || t === 'integer' || t === 'string'
					? stringify(
							typeDef.enum.map(({ value }) => value),
							`${path}$enum`
					  )
					: stringify(typeDef, `${path}$object`);
			const ts = { ...transforms, enumType: asyncStringify };
			const e = transformTypeDefinition(typeDef, ts, ntArgs, path);
			return expect(e).resolves.toStrictEqual(r);
		};
		return fc.assert(fc.asyncProperty(typeDefinitionArb(), fc.string(), predicate));
	});
});

describe('transform resource definition', () => {
	let spy: any;
	beforeAll(() => {
		spy = jest.spyOn(pulumi, 'transformPropertyDefinition').mockImplementation(asyncStringify1);
	});
	afterAll(() => spy.mockRestore());
	it('should compose correctly', () => {
		const predicate = (resDef: ResourceDefinition, path: string) => {
			const r = stringify(
				mapValues(resDef.inputProperties || {}, stringify1),
				resDef.requiredInputs || [],
				mapValues(resDef.properties || {}, stringify1),
				resDef.required || [],
				path
			);
			const ts = { ...transforms, resourceDef: asyncStringify };
			const e = transformResourceDefinition(resDef, ts, ntArgs, path);
			return expect(e).resolves.toStrictEqual(r);
		};
		return fc.assert(fc.asyncProperty(resourceDefinitionArb(), fc.string(), predicate));
	});
});
