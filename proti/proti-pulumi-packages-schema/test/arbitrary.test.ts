import * as fc from 'fast-check';
import prand from 'pure-rand';
import type { DeepReadonly, ResourceArgs, ResourceOutput } from '@proti/core';
import { Arbitrary } from 'fast-check';
import { createIs } from 'typia';
import {
	objectTypeDetailsToArbitrary,
	propertyDefinitionToArbitrary,
	PulumiPackagesSchemaGenerator,
	resourceOutputTraceToString,
	typeReferenceToArbitrary,
} from '../src/arbitrary';
import { ArbitraryConfig, defaultArbitraryConfig } from '../src/config';
import { SchemaRegistry } from '../src/schema-registry';
import type {
	ObjectTypeDetails,
	PrimitiveType,
	PropertyDefinition,
	TypeReference,
} from '../src/pulumi-package-metaschema';
import {
	arrayTypeArb,
	mapTypeArb,
	objectTypeDetailsArb,
	primitiveTypeArb,
	propertyDefinitionArb,
	unionTypeArb,
} from './pulumi-package-metaschema/arbitraries';
import { ResourceDefinition } from '../src/pulumi';

jest.mock('../src/schema-registry', () => ({
	SchemaRegistry: {
		getInstance: () => ({
			getResource: jest.fn(),
		}),
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
		valueCheck: (_: unknown, typeRefDef: DeepReadonly<TypeReference>) => void
	) => {
		const predicate = async (typeRefDef: DeepReadonly<TypeReference>) => {
			const valuePredicate = (value: unknown) => valueCheck(value, typeRefDef);
			const typeRefArb = await typeReferenceToArbitrary(typeRefDef);
			fc.assert(fc.property(typeRefArb, valuePredicate), { numRuns: 1 });
		};
		return fc.assert(fc.asyncProperty(arb, predicate));
	};

	it.each(['boolean', 'number', 'string'] as PrimitiveType['type'][])(
		'primitive type should generate %s values',
		async (type) => {
			const arb = primitiveTypeArb().map((primitiveType) => ({ ...primitiveType, type }));
			const valueCheck = (value: unknown) => expect(typeof value).toBe(type);
			await testTypeReferenceArbValues(arb, valueCheck);
		}
	);

	it('primitive type should generate integer values', async () => {
		const arb = primitiveTypeArb().map((primitiveType) => ({
			...primitiveType,
			type: 'integer' as 'integer',
		}));
		const valueCheck = (value: unknown) => {
			expect(typeof value).toBe('number');
			expect(Number.isInteger(value)).toBe(true);
		};
		await testTypeReferenceArbValues(arb, valueCheck);
	});

	it('array type should generate array values', async () => {
		const arb = arrayTypeArb(jsTypeArb);
		const valueCheck = (value: unknown, typeRefDef: DeepReadonly<TypeReference>) => {
			expect(Array.isArray(value)).toBe(true);
			const correctItemType = (item: unknown) => typeof item === typeRefDef.items!.type;
			expect((value as unknown[]).every(correctItemType)).toBe(true);
		};
		await testTypeReferenceArbValues(arb, valueCheck);
	});

	it('map type should generate dictionary values', async () => {
		const arb = mapTypeArb(jsTypeArb);
		const valueCheck = (value: unknown, typeRefDef: DeepReadonly<TypeReference>) => {
			expect(typeof value).toBe('object');
			const correctKeyType = (key: unknown) => typeof key === 'string';
			expect(Object.keys(value as object).every(correctKeyType)).toBe(true);
			const correctValueType = (val: unknown) =>
				typeof val === typeRefDef.additionalProperties?.type || 'string';
			expect(Object.values(value as object).every(correctValueType)).toBe(true);
		};
		await testTypeReferenceArbValues(arb, valueCheck);
	});

	// @TODO: Not anymore once we support them...
	// it('named type should throw', () => {
	// 	const predicate = (typeSchema: DeepReadonly<TypeReference>) =>
	// 		expect(async () =>
	// 			fc.check(fc.property(await typeReferenceToArbitrary(typeSchema), () => {}))
	// 		).rejects.toThrow(/Support for named types not implemented.*Found reference to.*in/);
	// 	return fc.assert(fc.asyncProperty(namedTypeArb(), predicate));
	// });

	it('union type should generate correct values', async () => {
		const arb = unionTypeArb(jsTypeArb);
		const valueCheck = (value: unknown, typeRefDef: DeepReadonly<TypeReference>) => {
			const types: string[] = typeRefDef.oneOf!.map((def) => def.type!);
			expect(types.includes(typeof value)).toBe(true);
		};
		await testTypeReferenceArbValues(arb, valueCheck);
	});
});

describe('property definition to arbitrary', () => {
	it.each([
		[
			'should generate constant value if const is set',
			(propDef) => propDef.const !== undefined,
			(propDefArb) => (propDef) => {
				const check = (value: unknown) => expect(value).toStrictEqual(propDef.const);
				fc.assert(fc.property(propDefArb, check), { numRuns: 1 });
			},
		],
		[
			'should generate default value at least once if default is set',
			(propDef) => propDef.const === undefined && propDef.default !== undefined,
			(propDefArb) => (propDef) => {
				let defaultOccured: boolean = false;
				const check = (value: unknown) => {
					if (Object.is(value, propDef.default)) defaultOccured = true;
				};
				fc.assert(fc.property(propDefArb, check), { numRuns: 20 });
				expect(defaultOccured).toBe(true);
			},
		],
	] as [string, (p: DeepReadonly<PropertyDefinition>) => boolean, (arb: Arbitrary<unknown>) => (p: DeepReadonly<PropertyDefinition>) => void][])(
		'%s',
		(_, propDefFilter, predicate) => {
			const arb = propertyDefinitionArb().filter(propDefFilter);
			const pred = async (propSchema: DeepReadonly<PropertyDefinition>) =>
				predicate(await propertyDefinitionToArbitrary(propSchema))(propSchema);
			return fc.assert(fc.asyncProperty(arb, pred));
		}
	);
});

describe('object type details to arbitrary', () => {
	const testObjectTypeDetailsArbValues = (
		arb: fc.Arbitrary<DeepReadonly<ObjectTypeDetails>>,
		valueCheck: (value: unknown, objTypeDetails: DeepReadonly<ObjectTypeDetails>) => void
	) => {
		const predicate = async (objTypeDetails: DeepReadonly<ObjectTypeDetails>) => {
			const valuePredicate = (value: unknown) => valueCheck(value, objTypeDetails);
			const objTypeDetailsArb = await objectTypeDetailsToArbitrary(objTypeDetails);
			fc.assert(fc.property(objTypeDetailsArb, valuePredicate), { numRuns: 1 });
		};
		return fc.assert(fc.asyncProperty(arb, predicate));
	};

	it.each([
		[undefined, undefined],
		[undefined, []],
		[{}, undefined],
		[{}, []],
	] as [Record<string, PropertyDefinition> | undefined, string[] | undefined][])(
		'should generate empty dictionary if properties %s and required %s',
		async (properties, required) => {
			const arb = objectTypeDetailsArb().map((objTypeDetails) => ({
				...objTypeDetails,
				properties,
				required,
			}));
			const predicate = (value: unknown) => expect(value).toStrictEqual({});
			await testObjectTypeDetailsArbValues(arb, predicate);
		}
	);

	it('should only generate specified properties', async () => {
		const predicate = (value: any, objTypeDetails: DeepReadonly<ObjectTypeDetails>) => {
			expect(typeof value).toBe('object');
			Object.keys(value).forEach((prop) =>
				expect(Object.keys(objTypeDetails.properties || {}).includes(prop)).toBe(true)
			);
		};
		await testObjectTypeDetailsArbValues(objectTypeDetailsArb(), predicate);
	});

	it('should always generate properties required in schema', async () => {
		const predicate = (value: any, objTypeDetails: DeepReadonly<ObjectTypeDetails>) => {
			expect(typeof value).toBe('object');
			const propCheck = (requiredProp: string) => expect(value[requiredProp]).toBeDefined;
			(objTypeDetails.required || []).forEach(propCheck);
		};
		await testObjectTypeDetailsArbValues(objectTypeDetailsArb(), predicate);
	});

	it('should throw on non-defined but required property', async () => {
		const arb = fc
			.tuple(fc.string(), objectTypeDetailsArb())
			.filter(([newProp, resDef]) => !Object.keys(resDef.properties || {}).includes(newProp))
			.map(([nonExistingProp, resDef]) => ({
				...resDef,
				required: [...(resDef.required || []), nonExistingProp],
			}));
		const predicate = (objTypeDetails: DeepReadonly<ObjectTypeDetails>) =>
			expect(() => objectTypeDetailsToArbitrary(objTypeDetails)).rejects.toThrow(
				/Property ".*" required but not defined in /
			);
		await fc.assert(fc.asyncProperty(arb, predicate));
	});
});

describe('pulumi packages schema generator', () => {
	const conf = defaultArbitraryConfig();
	const registry: SchemaRegistry = SchemaRegistry.getInstance();
	const rng: fc.Random = new fc.Random(prand.xoroshiro128plus(42));
	const init = (
		c: Partial<ArbitraryConfig> = {},
		resourceDefinition: ResourceDefinition | undefined = undefined
	) => {
		(registry.getResource as jest.MockedFunction<typeof registry.getResource>)
			.mockReset()
			.mockReturnValueOnce(Promise.resolve(resourceDefinition));
		return new PulumiPackagesSchemaGenerator({ ...conf, ...c }, registry, rng, undefined);
	};
	const resourceArgsArb: fc.Arbitrary<ResourceArgs> = fc.record(
		{
			type: fc.string(),
			name: fc.string(),
			inputs: fc.anything(),
			urn: fc.string(),
			provider: fc.string(),
			custom: fc.boolean(),
			id: fc.string(),
		},
		{ requiredKeys: ['type', 'name', 'inputs', 'urn'] }
	);

	it('should instantiate', () => {
		expect(() => init()).not.toThrow();
	});

	describe('generating resource output', () => {
		it('should throw on resource type without definition', () => {
			const err = /Failed to find resource definition/;
			const predicate = (args: ResourceArgs) =>
				expect(() => init().generateResourceOutput(args)).rejects.toThrow(err);
			return fc.assert(fc.asyncProperty(resourceArgsArb, predicate));
		});

		it('should return default state on resource type without definition', () => {
			console.warn = jest.fn();
			const predicate = (args: ResourceArgs, defaultResourceState: any) =>
				expect(
					init({
						failOnMissingResourceDefinition: false,
						defaultResourceState,
					}).generateResourceOutput(args)
				).resolves.toStrictEqual({ id: args.urn, state: defaultResourceState });
			return fc.assert(fc.asyncProperty(resourceArgsArb, fc.anything(), predicate));
		});

		it.each([
			['empty', {}, createIs<{}>()],
			[
				'a-b-resource',
				{
					properties: {
						a: { type: 'number' },
						b: { type: 'array', items: { type: 'string' } },
					},
					required: ['a'],
				},
				createIs<{ a: number; b?: string[] }>(),
			],
		] as [string, ResourceDefinition, (_: any) => boolean][])(
			'should generate valid state for %s',
			(_, resDef, validateState) => {
				const predicate = async (args: ResourceArgs) => {
					const { id, state } = await init({}, resDef).generateResourceOutput(args);
					expect(id).toBe(args.urn);
					expect(validateState(state)).toBe(true);
				};
				return fc.assert(fc.asyncProperty(resourceArgsArb, predicate));
			}
		);
	});
});
