import * as fc from 'fast-check';
import prand from 'pure-rand';
import { createAppendOnlyMap, typeOf, type ResourceArgs } from '@proti/core';
import { createIs } from 'typia';
import {
	type Arbitrary,
	arrayTypeArbitrary,
	builtInTypeArbitrary,
	constArbitrary,
	cycleBreakerArbitrary,
	enumTypeDefinitionArbitrary,
	mapTypeArbitrary,
	objectTypeDetailsArbitrary,
	primitiveTypeArbitrary,
	propertyDefinitionArbitrary,
	PulumiPackagesSchemaGenerator,
	resourceDefinitionArbitrary,
	unionTypeArbitrary,
	unresolvableUriArbitrary,
} from '../src/arbitrary';
import { ArbitraryConfig, defaultArbitraryConfig } from '../src/config';
import { SchemaRegistry } from '../src/schema-registry';
import type {} from '../src/pulumi-package-metaschema';
import { resourceDefinitionArb, typeDefinitionArb } from './pulumi-package-metaschema/arbitraries';
import {
	builtInTypeUris,
	type BuiltInTypeUri,
	type NamedTypeArgs,
	type NormalizedUri,
	type PrimitiveType,
	type ResourceDefinition,
	type Transforms,
	type TypeDefinition,
} from '../src/pulumi';

const getResourceMock = jest.fn();
const resolveTypeRefMock = jest.fn();
jest.mock('../src/schema-registry', () => ({
	SchemaRegistry: {
		getInstance: () => ({
			getResource: getResourceMock,
			resolveTypeRef: resolveTypeRefMock,
		}),
	},
}));
const registry = SchemaRegistry.getInstance();
const conf = defaultArbitraryConfig();

describe('arbitraries', () => {
	describe('unresolvable URI arbitrary', () => {
		const ts = {} as Transforms<Arbitrary>;
		const ntArgs = {} as NamedTypeArgs<Arbitrary>;

		it('should fail for unresolved reference', () => {
			const c = { ...conf, failOnMissingTypeReference: true };
			const predicate = async (uri: string, path: string) => {
				expect(() => unresolvableUriArbitrary(c, ts, ntArgs)(uri, path)).rejects.toThrow(
					/has unknown type reference/
				);
			};
			return fc.assert(fc.asyncProperty(fc.string(), fc.string(), predicate));
		});

		it('should generate state for default resource definition', () => {
			console.warn = () => {};
			const predicate = async (uri: string, path: string) => {
				const arbitrary = await unresolvableUriArbitrary(conf, ts, ntArgs)(uri, path);
				const valuePredicate = (v: unknown) => v === undefined;
				fc.assert(fc.property(arbitrary, valuePredicate), { numRuns: 1 });
			};
			return fc.assert(fc.asyncProperty(fc.string(), fc.string(), predicate));
		});

		it.each([
			['resource definition', resourceDefinitionArb()],
			['type definition', typeDefinitionArb()],
		])('generate state for default type reference definition: %s', (_, arb) => {
			console.warn = () => {};
			const tss: Transforms<Arbitrary> = {
				arrayType: async () => fc.constant('VAL'),
				builtInType: async () => fc.constant('VAL'),
				cycleBreaker: () => fc.constant('VAL'),
				const: async () => fc.constant('VAL'),
				enumType: async () => fc.constant('VAL'),
				mapType: async () => fc.constant('VAL'),
				objType: async () => fc.constant('VAL'),
				resourceDef: async () => fc.constant('VAL'),
				primitive: async () => fc.constant('VAL'),
				propDef: async () => fc.constant('VAL'),
				secret: async () => fc.constant('VAL'),
				unionType: async () => fc.constant('VAL'),
				unresolvableUri: async () => fc.constant('VAL'),
			};
			const predicate = async (
				uri: string,
				path: string,
				def: ResourceDefinition | TypeDefinition
			) => {
				const c = { ...conf, defaultTypeReferenceDefinition: def };
				const arbitrary = await unresolvableUriArbitrary(c, tss, ntArgs)(uri, path);
				const valuePredicate = (v: unknown) => v === 'VAL';
				fc.assert(fc.property(arbitrary, valuePredicate), { numRuns: 1 });
			};
			return fc.assert(fc.asyncProperty(fc.string(), fc.string(), arb, predicate));
		});
	});

	describe('cycle breaker arbitrary', () => {
		it('should throw error before arbitrary is availablie', () => {
			const arbitrary = cycleBreakerArbitrary(new Promise(() => {}));
			expect(() => fc.assert(fc.property(arbitrary, () => true))).toThrow(/not initialized/);
		});

		it('should generate value after arbitrary is available', async () => {
			const arbitrary = cycleBreakerArbitrary(Promise.resolve(fc.constant('VAL')));
			const predicate = (value: unknown) => value === 'VAL';
			await Promise.resolve(); // Wait a tick to let cycle breaker init
			fc.assert(fc.property(arbitrary, predicate), { numRuns: 1 });
		});

		it('should shrink after arbitrary is available', async () => {
			const arbitrary = cycleBreakerArbitrary(Promise.resolve(fc.array(fc.anything())));
			await Promise.resolve(); // Wait a tick to let cycle breaker init
			expect(() =>
				fc.assert(
					fc.property(arbitrary, () => false),
					{ numRuns: 1 }
				)
			).toThrow(/Property failed by returning false/);
		});
	});

	const objArb = fc
		.array(fc.string())
		.map((props) => [
			Object.fromEntries(props.map((prop) => [prop, fc.constant(prop)])),
			props.filter((_, i) => i % 2 === 0),
		]);
	const validateObj =
		(propertyArbs: Record<string, Arbitrary>, required: string[]) => (value: unknown) =>
			typeOf(value) === 'object' && // is object
			Object.keys(value as object).every(
				(prop) => Object.keys(propertyArbs).includes(prop) // all props are defined
			) &&
			Object.entries(value as object).every(([prop, val]) => prop === val) && // All required props are present
			required.every((prop) => Object.keys(value as object).includes(prop));

	it.each([
		[
			'built-in type',
			'built-in',
			fc.tuple(fc.constantFrom(...builtInTypeUris)),
			builtInTypeArbitrary,
			(type: BuiltInTypeUri) => (value: unknown) =>
				typeof value === 'string' || type.startsWith('pulumi.json#/A'),
		],
		[
			'array type',
			'array',
			fc.tuple(fc.constant(fc.constant('VAL'))),
			arrayTypeArbitrary,
			() => (value: unknown) =>
				typeOf(value) === 'array' && (value as unknown[]).every((v) => v === 'VAL'),
		],
		[
			'map type',
			'map',
			fc.tuple(fc.constant(fc.constant('VAL'))),
			mapTypeArbitrary,
			() => (value: unknown) =>
				typeOf(value) === 'object' &&
				Object.values(value as object).every((v) => v === 'VAL'),
		],
		[
			'primitve type',
			'primitive',
			fc.tuple(fc.constantFrom('boolean', 'integer', 'number', 'string')),
			primitiveTypeArbitrary,
			(type: PrimitiveType['type']) => (value: unknown) =>
				type === 'integer' ? Number.isInteger(value) : typeof value === type,
		],
		[
			'union type',
			'union',
			fc.nat({ max: 10 }).map((n) => [[...Array(n + 1).keys()].map((i) => fc.constant(i))]),
			unionTypeArbitrary,
			(oneOfArb: Arbitrary[]) => (value: unknown) =>
				typeof value === 'number' && value >= 0 && value < oneOfArb.length,
		],
		[
			'property definition',
			'property',
			fc.tuple(
				fc.constant(fc.constant('val')),
				fc.constantFrom(undefined, fc.constant('default'))
			),
			propertyDefinitionArbitrary,
			(propArb: Arbitrary, defaultArb: Arbitrary) => (value: unknown) =>
				value === 'val' || (value === 'default' && defaultArb !== undefined),
		],
		[
			'const arbitrary',
			'const',
			fc.tuple(fc.anything()),
			constArbitrary,
			(constant: unknown) => (value: unknown) => constant === value,
		],
		[
			'object type details arbitrary',
			'object',
			objArb,
			objectTypeDetailsArbitrary,
			validateObj,
		],
		[
			'resource definition arbitrary',
			'resource',
			objArb.map(([props, req]) => [{}, [], props, req]),
			resourceDefinitionArbitrary,
			(_, __, propertyArbs, required) => validateObj(propertyArbs, required),
		],
		[
			'enum type definition arbitrary',
			'enum',
			fc.tuple(fc.array(fc.anything(), { minLength: 1 })),
			enumTypeDefinitionArbitrary,
			(values: any[]) => (value: unknown) => values.includes(value),
		],
	] as [string, string, Arbitrary<unknown[]>, (...v: any[]) => Promise<Arbitrary>, (...v: any[]) => (v: unknown) => boolean][])(
		'%s should generate %s values',
		(_, __, paramsArb, subject, validator) => {
			const predicate = async (vs: any[], path: string) => {
				const arb = await subject(...vs, path);
				fc.assert(fc.property(arb, validator(...vs, path)), { numRuns: 1 });
			};
			return fc.assert(fc.asyncProperty(paramsArb, fc.string(), predicate));
		}
	);
});

describe('pulumi packages schema generator', () => {
	const rng: fc.Random = new fc.Random(prand.xoroshiro128plus(42));
	const init = (
		c: Partial<ArbitraryConfig> = {},
		resourceDefinition: ResourceDefinition | undefined = undefined,
		[cache, appendC] = createAppendOnlyMap<NormalizedUri, Promise<Arbitrary>>()
	) => {
		getResourceMock.mockReset().mockReturnValueOnce(Promise.resolve(resourceDefinition));
		const config = { ...conf, ...c };
		return new PulumiPackagesSchemaGenerator(config, registry, cache, appendC, rng, undefined);
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
			const err = /Failed to generate resource arbitrary/;
			const predicate = (args: ResourceArgs) =>
				expect(() => init().generateResourceOutput(args)).rejects.toThrow(err);
			return fc.assert(fc.asyncProperty(resourceArgsArb, predicate));
		});

		it('should return state on resource type without definition', () => {
			console.warn = jest.fn();
			const predicate = async (
				args: ResourceArgs,
				defaultResourceDefinition: ResourceDefinition
			) => {
				const { id, state } = await init({
					failOnMissingResourceDefinition: false,
					defaultResourceDefinition,
				}).generateResourceOutput(args);
				expect(id).toBe(args.urn);
				expect(typeOf(state)).toBe('object');
				const isValidProp = (prop: string) =>
					Object.keys(defaultResourceDefinition.properties || {}).includes(prop);
				expect(Object.keys(state).every(isValidProp)).toBe(true);
				const required = defaultResourceDefinition.required || [];
				expect(required.every((prop) => Object.keys(state).includes(prop))).toBe(true);
			};
			return fc.assert(fc.asyncProperty(resourceArgsArb, resourceDefinitionArb(), predicate));
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
			'should return valid state for %s',
			(_, resDef, validateState) => {
				const predicate = async (args: ResourceArgs) => {
					const { id, state } = await init({}, resDef).generateResourceOutput(args);
					expect(id).toBe(args.urn);
					expect(validateState(state)).toBe(true);
				};
				return fc.assert(fc.asyncProperty(resourceArgsArb, predicate));
			}
		);

		const recursiveResDefArb: fc.Arbitrary<[ResourceDefinition, string]> = fc
			.tuple(resourceDefinitionArb(), fc.string())
			.map(([resDef, resType]) => [
				{
					...resDef,
					inputProperties: {
						[resType]: { $ref: `#/resources/${encodeURIComponent(resType)}` },
					},
					requiredInputs: [],
				},
				resType,
			]);
		it.each<[string, Partial<ArbitraryConfig>, boolean, boolean, number]>([
			['cache resource arbitrary', {}, true, true, 1],
			['cache named type arbitrary', {}, false, false, 3],
			['use arbitrary cached from named types for root resources', {}, false, true, 2],
		])('should %s', (a, c, sameTypeName1, sameTypeName2, resLookups) => {
			const predicate = async (
				resArgs: ResourceArgs,
				[resDef, resType]: [ResourceDefinition, string]
			) => {
				const arbitrary = init({ ...conf, ...c });
				getResourceMock.mockReset().mockReturnValue(resDef);
				const subject = async (type: string) => {
					const { id, state } = await arbitrary.generateResourceOutput({
						...resArgs,
						type,
						inputs: { [resType]: {} },
					});
					expect(id).toBe(resArgs.urn);
					expect(typeOf(state)).toBe('object');
				};
				await subject(`${resType}${sameTypeName1 ? '' : '_'}`);
				await subject(`${resType}${sameTypeName2 ? '' : '__'}`);
				expect(getResourceMock).toBeCalledTimes(resLookups);
			};
			return fc.assert(fc.asyncProperty(resourceArgsArb, recursiveResDefArb, predicate));
		});
	});
});
