import * as fc from 'fast-check';
import type { RandomGenerator } from 'pure-rand';
import type { DeepReadonly, ResourceOutput } from '@proti/core';
import {
	PulumiPackagesSchemaGenerator,
	resourceOutputTraceToString,
	typeReferenceToArbitrary,
} from '../src/arbitrary';
import { defaultArbitraryConfig } from '../src/config';
import { SchemaRegistry } from '../src/schema-registry';
import type { PrimitiveType, TypeReference } from '../src/pulumi-package-metaschema';
import {
	arrayTypeArb,
	mapTypeArb,
	namedTypeArb,
	primitiveTypeArb,
	unionTypeArb,
} from './pulumi-package-metaschema/arbitraries';

jest.spyOn(fc, 'Random').mockImplementation(jest.fn());
jest.mock('../src/schema-registry', () => ({
	SchemaRegistry: {
		getInstance: jest.fn(),
	},
}));

describe('resource output trace to string', () => {
	const res = { id: 'a', state: {} };
	it.each([
		['empty trace', [], ''],
		['single resource with empty state', [res], '0: a'],
		[
			'single resource with state',
			[{ id: 'a', state: { b: 'c', d: 2 } }],
			'0: a\n   - b: "c"\n   - d: 2',
		],
		[
			'multiple resource with state',
			[res, { id: 'b', state: { c: false } }, res, res, res, res, res, res, res, res, res],
			' 0: a\n 1: b\n    - c: false\n 2: a\n 3: a\n 4: a\n 5: a\n 6: a\n 7: a\n 8: a\n 9: a\n10: a',
		],
	] as [string, ReadonlyArray<ResourceOutput>, string][])(
		'should correctly format %s',
		(_, trace, result) => {
			expect(resourceOutputTraceToString(trace)).toBe(result);
		}
	);
});

describe('type reference to arbitrary', () => {
	const jsTypeArb = primitiveTypeArb().filter((primitiveType) =>
		['boolean', 'number', 'string'].includes(primitiveType.type)
	);
	const testTypeReferenceArbValues = (
		arb: fc.Arbitrary<DeepReadonly<TypeReference>>,
		valueCheck: (_: unknown, typeSchema: DeepReadonly<TypeReference>) => void
	) => {
		const predicate = (typeSchema: DeepReadonly<TypeReference>) => {
			const valuePredicate = (value: unknown) => valueCheck(value, typeSchema);
			fc.assert(fc.property(typeReferenceToArbitrary(typeSchema), valuePredicate), {
				numRuns: 1,
			});
		};
		fc.assert(fc.property(arb, predicate));
	};

	it.each(['boolean', 'number', 'string'] as PrimitiveType['type'][])(
		'primitive type should generate %s values',
		(type) => {
			const arb = primitiveTypeArb().map((primitiveType) => ({ ...primitiveType, type }));
			const valueCheck = (value: unknown) => expect(typeof value).toBe(type);
			testTypeReferenceArbValues(arb, valueCheck);
		}
	);

	it('primitive type should generate integer values', () => {
		const arb = primitiveTypeArb().map((primitiveType) => ({
			...primitiveType,
			type: 'integer' as 'integer',
		}));
		const valueCheck = (value: unknown) => {
			expect(typeof value).toBe('number');
			expect(Number.isInteger(value)).toBe(true);
		};
		testTypeReferenceArbValues(arb, valueCheck);
	});

	it('array type should generate array values', () => {
		const arb = arrayTypeArb(jsTypeArb);
		const valueCheck = (value: unknown, typeSchema: DeepReadonly<TypeReference>) => {
			expect(Array.isArray(value)).toBe(true);
			const correctItemType = (item: unknown) => typeof item === typeSchema.items!.type;
			expect((value as unknown[]).every(correctItemType)).toBe(true);
		};
		testTypeReferenceArbValues(arb, valueCheck);
	});

	it('map type should generate dictionary values', () => {
		const arb = mapTypeArb(jsTypeArb);
		const valueCheck = (value: unknown, typeSchema: DeepReadonly<TypeReference>) => {
			expect(typeof value).toBe('object');
			const correctKeyType = (key: unknown) => typeof key === 'string';
			expect(Object.keys(value as object).every(correctKeyType)).toBe(true);
			const correctValueType = (val: unknown) =>
				typeof val === typeSchema.additionalProperties?.type || 'string';
			expect(Object.values(value as object).every(correctValueType)).toBe(true);
		};
		testTypeReferenceArbValues(arb, valueCheck);
	});

	// @TODO: Not anymore once we support them...
	it('named type should throw', () => {
		const predicate = (typeSchema: DeepReadonly<TypeReference>) => {
			expect(() =>
				fc.check(fc.property(typeReferenceToArbitrary(typeSchema), () => {}))
			).toThrow(/Support for named types not implemented/);
		};
		fc.assert(fc.property(namedTypeArb(), predicate));
	});

	it('union type should generate correct values', () => {
		const arb = unionTypeArb(jsTypeArb);
		const valueCheck = (value: unknown, typeSchema: DeepReadonly<TypeReference>) => {
			const types: string[] = typeSchema.oneOf!.map((schema) => schema.type!);
			expect(types.includes(typeof value)).toBe(true);
		};
		testTypeReferenceArbValues(arb, valueCheck);
	});
});

describe('pulumi packages schema generator', () => {
	const conf = defaultArbitraryConfig();
	const registry: SchemaRegistry = SchemaRegistry.getInstance();
	const rng: fc.Random = new fc.Random(undefined as unknown as RandomGenerator);

	it('should instantiate', () => {
		expect(
			() => new PulumiPackagesSchemaGenerator(conf, registry, rng, undefined)
		).not.toThrow();
	});
});
