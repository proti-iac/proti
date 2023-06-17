import * as fc from 'fast-check';
import type { CommandResult } from '@pulumi/pulumi/automation';
import { mapValues } from '@proti/core';
import {
	type ObjectTypeDetails,
	runPulumi,
	transformObjectTypeDetails,
	transformPropertyDefinition,
	transformResourceDefinition,
	transformTypeReference,
	type ResourceDefinition,
	type PropertyDefinition,
	type TypeReference,
} from '../src/pulumi';
import {
	arrayTypeArb,
	mapTypeArb,
	namedTypeArb,
	objectTypeDetailsArb,
	primitiveTypeArb,
	propertyDefinitionArb,
	resourceDefinitionArb,
	unionTypeArb,
} from './pulumi-package-metaschema/arbitraries';

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
