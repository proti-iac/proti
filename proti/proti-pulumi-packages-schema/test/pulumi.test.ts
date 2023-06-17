import * as fc from 'fast-check';
import type { CommandResult } from '@pulumi/pulumi/automation';
import { mapValues } from '@proti/core';
import {
	type ObjectTypeDetails,
	runPulumi,
	transformNamedType,
	transformObjectTypeDetails,
	transformPropertyDefinition,
	transformResourceDefinition,
	transformTypeReference,
	type ResourceDefinition,
	type PropertyDefinition,
	type TypeReference,
	type NamedType,
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

const stringify = (...v: any[]) => JSON.stringify(v);
const stringify1 = (a: any) => stringify(a);
const asyncStringify = (...v: any[]) => Promise.resolve(JSON.stringify(v));
const asyncStringify1 = (a: any) => asyncStringify(a);
const throws = () => {
	throw new Error();
};
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
const builtInTypes: readonly string[] = [
	'pulumi.json#/Archive',
	'pulumi.json#/Asset',
	'pulumi.json#/Any',
	'pulumi.json#/Json',
];

describe('transform namedType type', () => {
	const arb = (refArb: fc.Arbitrary<string>): fc.Arbitrary<NamedType> =>
		fc.tuple(namedTypeArb(), refArb).map(([namedType, $ref]) => ({ ...namedType, $ref }));

	it('should transform built-in type URI', () => {
		const predicate = (namedType: NamedType, path: string) => {
			const transforms = { builtInType: stringify, unresolvableUri: throws };
			const e = transformNamedType(namedType, transforms, throws, throws, registry, path);
			const r = stringify(namedType.$ref, `${path}$builtIn:${namedType.$ref}`);
			return expect(e).resolves.toStrictEqual(r);
		};
		const ref = fc.constantFrom(...builtInTypes);
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
			mock.mockReset().mockResolvedValue(def);
			const ts = { builtInType: throws, unresolvableUri: throws };
			const e = transformNamedType(type, ts, transResDef, transTypeDef, registry, path);
			const r = stringify(def);
			await expect(e).resolves.toStrictEqual(r);
			expect(mock).toBeCalledTimes(1);
		};
		const resourceRef = (s: string) =>
			!s.includes(`#/${otherKind}/`) && !builtInTypes.some((t) => s.includes(t));
		const ref = fc
			.tuple(fc.string(), fc.integer({ max: 20 }))
			.map(([s, i]) => `${s.slice(0, i)}#/${kind}/${s.slice(i)}`)
			.filter(resourceRef);
		return fc.assert(fc.asyncProperty(arb(ref), kindArb, fc.string(), predicate));
	});

	it('should transform unresolvable URI', () => {
		getResourceMock.mockResolvedValue(undefined);
		getTypeMock.mockResolvedValue(undefined);
		const predicate = (namedType: NamedType, path: string) => {
			const transforms = { builtInType: throws, unresolvableUri: stringify };
			const e = transformNamedType(namedType, transforms, throws, throws, registry, path);
			const r = stringify(namedType.$ref, `${path}$unresolvable`);
			return expect(e).resolves.toStrictEqual(r);
		};
		const ref = fc
			.tuple(fc.constantFrom('#/resources/', '#/types/', ''), fc.string())
			.map(([p, s]) => p + s)
			.filter((s: string) => !builtInTypes.some((t) => s.includes(t)));
		return fc.assert(fc.asyncProperty(arb(ref), fc.string(), predicate));
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
	const subject = (typeRef: TypeReference, path: string) =>
		transformTypeReference(
			typeRef,
			{
				arrayType: stringify,
				mapType: stringify,
				primitive: stringify,
				unionType: stringify,
			},
			asyncStringify,
			path
		);
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
	it('should use const if set', () => {
		const arb = propertyDefinitionArb().filter((propDef) => propDef.const !== undefined);
		const predicate = (propDef: PropertyDefinition, path: string) => {
			const r = stringify(propDef.const, `${path}$const`);
			const e = transformPropertyDefinition(
				propDef,
				{ propDef: stringify, const: stringify },
				asyncStringify1,
				path
			);
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
			const e = transformPropertyDefinition(
				propDef,
				{ propDef: stringify, const: stringify1 },
				asyncStringify1,
				path
			);
			return expect(e).resolves.toStrictEqual(r);
		};
		return fc.assert(fc.asyncProperty(arb, fc.string(), predicate));
	});
});

describe('transform object type details', () => {
	it('should compose correctly', () => {
		const predicate = (objType: ObjectTypeDetails, path: string) => {
			const r = stringify(
				mapValues(objType.properties || {}, stringify1),
				objType.required || [],
				path
			);
			const e = transformObjectTypeDetails(
				objType,
				{ objType: stringify },
				asyncStringify1,
				path
			);
			return expect(e).resolves.toStrictEqual(r);
		};
		return fc.assert(fc.asyncProperty(objectTypeDetailsArb(), fc.string(), predicate));
	});
});

describe('transform resource definition', () => {
	it('should compose correctly', () => {
		const predicate = (resDef: ResourceDefinition, path: string) => {
			const r = stringify(
				mapValues(resDef.inputProperties || {}, stringify1),
				resDef.requiredInputs || [],
				mapValues(resDef.properties || {}, stringify1),
				resDef.required || [],
				path
			);
			const e = transformResourceDefinition(
				resDef,
				{ resourceDef: stringify },
				asyncStringify1,
				path
			);
			return expect(e).resolves.toStrictEqual(r);
		};
		return fc.assert(fc.asyncProperty(resourceDefinitionArb(), fc.string(), predicate));
	});
});
