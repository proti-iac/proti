import * as fc from 'fast-check';
import type { DeepReadonly, ResourceArgs } from '@proti/core';
import { type OracleConfig, defaultOracleConfig } from '../src/config';
import {
	PulumiPackagesSchemaOracle,
	enumTypeDefToValidator,
	objTypeToValidator as objTypeToV,
	objTypeToValidator,
	typeRefToValidator,
} from '../src/oracle';
import { ResourceDefinition } from '../src/pulumi';
import {
	arrayTypeArb,
	enumTypeDefinitionArb,
	mapTypeArb,
	namedTypeArb,
	objectTypeDetailsArb,
	primitiveTypeArb,
	resourceDefinitionArb,
	typeReferenceArb,
	unionTypeArb,
} from './pulumi-package-metaschema/arbitraries';
import type {
	ArrayType,
	EnumTypeDefinition,
	MapType,
	NamedType,
	ObjectTypeDetails,
	PrimitiveType,
	TypeReference,
	UnionType,
} from '../src/pulumi-package-metaschema';
import { SchemaRegistry } from '../src/schema-registry';

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
const conf = defaultOracleConfig();

describe('enum type definition to validator', () => {
	it('should validate enum values', () => {
		const arb: fc.Arbitrary<[DeepReadonly<EnumTypeDefinition>, unknown]> = fc
			.tuple(enumTypeDefinitionArb(), fc.array(fc.string()), fc.string())
			.map(([enumType, values, value]) => {
				const vals = new Set([value, ...values]);
				const enumVals = [...vals].map((v: string) => ({ value: v }));
				return [{ ...enumType, enum: enumVals }, value];
			});
		const predicate = ([enumType, value]: [DeepReadonly<EnumTypeDefinition>, unknown]) =>
			expect(enumTypeDefToValidator(enumType, '')(value)).toBe(true);
		fc.assert(fc.property(arb, predicate));
	});

	it('should not validate non-enum values', () => {
		const arb: fc.Arbitrary<[DeepReadonly<EnumTypeDefinition>, unknown]> = fc
			.tuple(enumTypeDefinitionArb(), fc.string())
			.filter(([enumType, value]) => enumType.enum.every((v) => v.value !== value));
		const predicate = ([enumType, value]: [DeepReadonly<EnumTypeDefinition>, unknown]) =>
			expect(() => enumTypeDefToValidator(enumType, '')(value)).toThrowError();
		fc.assert(fc.property(arb, predicate));
	});
});

describe('type reference validator', () => {
	const typeRefPredicate =
		(valid: boolean) => async (typeDef: DeepReadonly<TypeReference>, value: unknown) => {
			const validator = await typeRefToValidator(typeDef, registry, conf, objTypeToV, '');
			if (valid) expect(validator(value)).toBe(true);
			else expect(() => validator(value)).toThrowError();
		};

	describe('named type', () => {
		beforeAll(() =>
			resolveTypeRefMock.mockImplementation((type) => {
				const enumType: EnumTypeDefinition = {
					type: 'integer',
					enum: [{ value: 1 }, { value: 2 }],
				};
				const objType: ObjectTypeDetails = {
					properties: { a: { type: 'string' } },
					required: ['a'],
				};
				if (type === 'enum') return enumType;
				if (type === 'object') return objType;
				return undefined;
			})
		);

		const types: ReadonlyArray<string> = [
			// Built-in
			'pulumi.json#/Archive',
			'pulumi.json#/Asset',
			'pulumi.json#/Any',
			'pulumi.json#/Json',
			// Object
			'object',
			// Enum
			'enum',
		];
		type Case = readonly [string, fc.Arbitrary<unknown>, ReadonlyArray<string>];
		const cases: ReadonlyArray<Case> = [
			[
				'string',
				fc.string().filter((s) => {
					try {
						JSON.parse(s);
						return false;
					} catch (e) {
						return true;
					}
				}),
				['pulumi.json#/Archive', 'pulumi.json#/Asset', 'pulumi.json#/Any'],
			],
			[
				'json',
				fc.json(),
				[
					'pulumi.json#/Archive',
					'pulumi.json#/Asset',
					'pulumi.json#/Any',
					'pulumi.json#/Json',
				],
			],
			['float', fc.float().filter((f) => !Number.isInteger(f)), ['pulumi.json#/Any']],
			['1 or 2', fc.oneof(fc.constant(1), fc.constant(2)), ['pulumi.json#/Any', 'enum']],
			['a-object', fc.record({ a: fc.string() }), ['pulumi.json#/Any', 'object']],
			[
				'non-a-object',
				fc.dictionary(
					fc.string().filter((v) => v !== 'a'),
					fc.string()
				),
				['pulumi.json#/Any'],
			],
		];
		const mapCases =
			(type: string) =>
			([valueType, arb, validTypes]: Case): [string, string, string, fc.Arbitrary<unknown>] =>
				[type, `${validTypes.includes(type) ? '' : 'not '}validate`, valueType, arb];
		it.each(types.flatMap((type) => cases.map(mapCases(type))))(
			'%s named type should %s %s',
			($ref, validate, valueType, arb) => {
				const typeArb = namedTypeArb().map(
					(type): DeepReadonly<NamedType> => ({ ...type, $ref })
				);
				const predicate = typeRefPredicate(validate === 'validate');
				return fc.assert(fc.asyncProperty(typeArb, arb, predicate));
			}
		);

		const unresolvedNamedTypeArb = namedTypeArb().filter((type) => !types.includes(type.$ref));
		it('should fail for unresolved reference', () => {
			const c = { ...conf, failOnMissingTypeReference: true };
			const predicate = async (namedType: DeepReadonly<NamedType>) =>
				expect(typeRefToValidator(namedType, registry, c, objTypeToV, '')).rejects.toThrow(
					/has unknown type reference/
				);
			return fc.assert(fc.asyncProperty(unresolvedNamedTypeArb, predicate));
		});

		it('should validate for default unresolvable reference', () => {
			console.warn = () => {};
			const predicate = typeRefPredicate(true);
			return fc.assert(fc.asyncProperty(unresolvedNamedTypeArb, fc.anything(), predicate));
		});

		it('should not validate for default unresolvable reference', () => {
			console.warn = () => {};
			const nonEmptyObjArb = fc.object().filter((o) => Object.keys(o).length > 0);
			const predicate = async (typeDef: DeepReadonly<TypeReference>, value: unknown) => {
				const c = { ...conf, defaultTypeReferenceDefinition: {} };
				const validator = await typeRefToValidator(typeDef, registry, c, objTypeToV, '');
				expect(() => validator(value)).toThrowError();
			};
			return fc.assert(fc.asyncProperty(unresolvedNamedTypeArb, nonEmptyObjArb, predicate));
		});
	});

	describe('union type', () => {
		const unionArb = unionTypeArb(typeReferenceArb()).map(
			(unionType): DeepReadonly<UnionType> => ({
				...unionType,
				oneOf: [{ type: 'string' }, { type: 'boolean' }],
			})
		);
		it('should validate string and boolean values', () => {
			const valueArb = fc.oneof(fc.string(), fc.boolean());
			return fc.assert(fc.asyncProperty(unionArb, valueArb, typeRefPredicate(true)));
		});

		it('should not validate non-string-or-boolean values', () => {
			const valueArb = fc
				.anything()
				.filter((v) => typeof v !== 'string' && typeof v !== 'boolean');
			return fc.assert(fc.asyncProperty(unionArb, valueArb, typeRefPredicate(false)));
		});
	});

	describe('array type', () => {
		const stringArrayArb = arrayTypeArb(typeReferenceArb()).map(
			(arrType): DeepReadonly<ArrayType> => ({ ...arrType, items: { type: 'string' } })
		);

		it('should validate string arrays', () => {
			const predicate = typeRefPredicate(true);
			return fc.assert(fc.asyncProperty(stringArrayArb, fc.array(fc.string()), predicate));
		});

		it('should not validate non-string-array values', () => {
			const valArb = fc
				.anything()
				.filter((v) => !Array.isArray(v) || v.some((i) => typeof i !== 'string'));
			return fc.assert(fc.asyncProperty(stringArrayArb, valArb, typeRefPredicate(false)));
		});
	});

	describe('map type', () => {
		const typeArb = mapTypeArb(typeReferenceArb());
		const numberMapArb = typeArb.map(
			(m): DeepReadonly<MapType> => ({ ...m, additionalProperties: { type: 'number' } })
		);
		const stringMapArb = typeArb.map(
			(m): DeepReadonly<MapType> => ({ ...m, additionalProperties: undefined })
		);

		it('should validate number map types', () => {
			const valArb = fc.dictionary(fc.string(), fc.float());
			return fc.assert(fc.asyncProperty(numberMapArb, valArb, typeRefPredicate(true)));
		});

		it('should validate default type map types', () => {
			const valArb = fc.dictionary(fc.string(), fc.string());
			return fc.assert(fc.asyncProperty(stringMapArb, valArb, typeRefPredicate(true)));
		});

		it('should not validate non-string-string-map values', () => {
			const valArb = fc
				.anything()
				.filter(
					(v) =>
						typeof v !== 'object' ||
						Object.values(v || {}).some((i) => typeof i !== 'string')
				);
			return fc.assert(fc.asyncProperty(stringMapArb, valArb, typeRefPredicate(false)));
		});
	});

	describe('primitive type', () => {
		const primitiveTypes: PrimitiveType['type'][] = ['boolean', 'integer', 'number', 'string'];
		type RawCase = readonly [string, fc.Arbitrary<unknown>, ReadonlyArray<string>];
		const cases: ReadonlyArray<RawCase> = [
			['boolean', fc.boolean(), ['boolean']],
			['integer', fc.integer(), ['integer', 'number']],
			['float', fc.float().filter((f) => !Number.isInteger(f)), ['number']],
			['string', fc.string(), ['string']],
			['undefined', fc.constant(undefined), []],
			['object', fc.object(), []],
		];
		type Case = DeepReadonly<[PrimitiveType['type'], string, string, fc.Arbitrary<unknown>]>;
		const mapCase =
			(validatorType: PrimitiveType['type']) =>
			([valueType, arb, validTypes]: RawCase): Case =>
				[
					validatorType,
					`${validTypes.includes(validatorType) ? '' : 'not '}validate`,
					valueType,
					arb,
				];
		it.each(primitiveTypes.flatMap((validatorType) => cases.map(mapCase(validatorType))))(
			'%s validator should %s %s',
			(type, validate, valueType, arb) => {
				const typeArb = primitiveTypeArb().map(
					(primType): DeepReadonly<PrimitiveType> => ({ ...primType, type })
				);
				const predicate = typeRefPredicate(validate === 'validate');
				return fc.assert(fc.asyncProperty(typeArb, arb, predicate));
			}
		);
	});
});

describe('object type details validator', () => {
	const adjustObjType = (obj: object, objType: DeepReadonly<ObjectTypeDetails>) => ({
		...objType,
		properties: Object.fromEntries(
			Object.keys(obj).map((k) => [k, { type: 'string' }])
		) as Record<string, TypeReference>,
		required: Object.keys(obj),
	});
	const arbs: fc.Arbitrary<[unknown, DeepReadonly<ObjectTypeDetails>]> = fc
		.tuple(fc.dictionary(fc.string(), fc.string()), objectTypeDetailsArb())
		.map(([obj, objType]) => [obj, adjustObjType(obj, objType)]);

	it('should validate valid objects', () => {
		const predicate = async ([obj, objType]: [unknown, DeepReadonly<ObjectTypeDetails>]) =>
			expect((await objTypeToValidator(objType, registry, conf, ''))(obj)).toBe(true);
		return fc.assert(fc.asyncProperty(arbs, predicate));
	});

	it('should not validate if value is no object', () => {
		const objTypeArb = objectTypeDetailsArb();
		const valArb = fc
			.anything()
			.filter((v) => typeof v !== 'object' || Array.isArray(v) || v === null);
		const predicate = async (objType: DeepReadonly<ObjectTypeDetails>, value: unknown) => {
			const validator = await objTypeToValidator(objType, registry, conf, '');
			expect(() => validator(value)).toThrowError();
		};
		return fc.assert(fc.asyncProperty(objTypeArb, valArb, predicate));
	});

	it('should not validate if required properties are missing', () => {
		const predicate = async ([obj, objType]: [any, DeepReadonly<ObjectTypeDetails>]) => {
			const type: DeepReadonly<ObjectTypeDetails> = {
				...objType,
				properties: { ...objType.properties, a: { type: 'string' } },
				required: ['a'],
			};
			// eslint-disable-next-line no-param-reassign
			delete obj.a;
			const validator = await objTypeToValidator(type, registry, conf, '');
			expect(() => validator(obj)).toThrowError();
		};
		return fc.assert(fc.asyncProperty(arbs, predicate));
	});

	it('should not validate if object has non-defined properties', () => {
		const predicate = async ([obj, objType]: [any, DeepReadonly<ObjectTypeDetails>]) => {
			const type: DeepReadonly<ObjectTypeDetails> = {
				...objType,
				properties: Object.fromEntries(
					Object.keys(objType.properties || {})
						.slice(0, -1)
						.map((k) => [k, objType.properties![k]])
				) as Record<string, TypeReference>,
			};
			if (Object.keys(objType.properties || {}).length === 0)
				// eslint-disable-next-line no-param-reassign
				obj.a = 'true';
			const validator = await objTypeToValidator(type, registry, conf, '');
			expect(() => validator(obj)).toThrowError();
		};
		return fc.assert(fc.asyncProperty(arbs, predicate));
	});
});

describe('Pulumi packages schema oracle', () => {
	const init = (
		c: Partial<OracleConfig> = {},
		resourceDefinition: ResourceDefinition | undefined = undefined
	) => {
		getResourceMock.mockReset().mockReturnValueOnce(Promise.resolve(resourceDefinition));
		return new PulumiPackagesSchemaOracle({ ...conf, ...c });
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

	describe('validate resource arguments', () => {
		const resDefAb: ResourceDefinition = {
			inputProperties: {
				a: { type: 'number' },
				b: { type: 'array', items: { type: 'string' } },
			},
			requiredInputs: ['a'],
			properties: { c: { type: 'boolean' } },
			required: ['c'],
		};

		it('should throw on resource type without definition', () => {
			const predicate = async (args: ResourceArgs) => {
				const result = init().asyncValidateResource(args);
				await expect(result).resolves.toThrow(/Failed to generate resource validator/);
				await expect(result.then((e) => (e as Error).cause)).resolves.toThrow(
					/Failed to find resource definition/
				);
			};
			return fc.assert(fc.asyncProperty(resourceArgsArb, predicate));
		});

		it('should validate on resource type without definition', () => {
			console.warn = () => {};
			const c = { failOnMissingResourceDefinition: false };
			const predicate = (args: ResourceArgs) =>
				expect(init(c).asyncValidateResource(args)).resolves.toBeUndefined();
			return fc.assert(fc.asyncProperty(resourceArgsArb, predicate));
		});

		it('should not validate on resource type without definition', () => {
			console.warn = () => {};
			const c = { failOnMissingResourceDefinition: false, defaultResourceDefinition: {} };
			const predicate = (args: ResourceArgs) =>
				expect(init(c).asyncValidateResource(args)).resolves.toThrow(/has .* property/);
			const withInputsArb = fc
				.tuple(resourceArgsArb, fc.dictionary(fc.string(), fc.anything(), { minKeys: 1 }))
				.map(([res, inputs]) => ({ ...res, inputs }));
			return fc.assert(fc.asyncProperty(withInputsArb, predicate));
		});

		it.each<DeepReadonly<[string, ResourceDefinition, unknown]>>([
			['empty', {}, {}],
			['a-resource', resDefAb, { a: 1 }],
			['a-b-resource', resDefAb, { a: 1, b: [] }],
			['a-bb-resource', resDefAb, { a: 1, b: ['c', 'd'] }],
		])('should validate resource args for %s', (_, resDef, inputs) => {
			const arb = resourceArgsArb.map((args) => ({ ...args, inputs }));
			const predicate = (args: ResourceArgs) =>
				expect(init({}, resDef).asyncValidateResource(args)).resolves.toBeUndefined();
			return fc.assert(fc.asyncProperty(arb, predicate));
		});

		it.each<DeepReadonly<[string, ResourceDefinition, unknown]>>([
			['empty', {}, ''],
			['a-resource', resDefAb, {}],
			['a-resource', resDefAb, { a: 'a' }],
			['a-b-resource', resDefAb, { a: 1, b: [5] }],
			['a-b-c-resource', resDefAb, { a: 1, b: ['c', 'd'], c: false }],
		])('should fail to validate resource args for %s', (_, resDef, inputs) => {
			const arb = resourceArgsArb.map((args) => ({ ...args, inputs }));
			const predicate = (args: ResourceArgs) =>
				expect(init({}, resDef).asyncValidateResource(args)).resolves.toThrowError();
			return fc.assert(fc.asyncProperty(arb, predicate));
		});

		const recursiveResDefArb: fc.Arbitrary<[ResourceDefinition, string]> = fc
			.tuple(resourceDefinitionArb(), fc.string())
			.map(([resDef, resType]) => [
				{
					...resDef,
					inputProperties: { [resType]: { $ref: `#/resources/${resType}` } },
					requiredInputs: [],
				},
				resType,
			]);
		type OptNumber = number | undefined;
		type CachingCase = DeepReadonly<
			[string, Partial<OracleConfig>, boolean, boolean, OptNumber, OptNumber]
		>;
		it.each<CachingCase>([
			['not cache validator', { cacheValidators: false }, true, true, 2, 2],
		])('should %s', (a, c, sameTypeName1, sameTypeName2, rootResLookups, namedTypeLookups) => {
			const predicate = async (
				resArgs: ResourceArgs,
				[resDef, resType]: [ResourceDefinition, string]
			) => {
				getResourceMock.mockReset().mockReturnValue(resDef);
				resolveTypeRefMock.mockReset().mockReturnValue(resDef);
				const oracle = new PulumiPackagesSchemaOracle({ ...conf, ...c });
				await oracle.asyncValidateResource({
					...resArgs,
					type: `${resType}${sameTypeName1 ? '' : '_'}`,
					inputs: { [resType]: {} },
				});
				await oracle.asyncValidateResource({
					...resArgs,
					type: `${resType}${sameTypeName2 ? '' : '_'}`,
					inputs: { [resType]: {} },
				});
				if (rootResLookups !== undefined)
					expect(getResourceMock).toBeCalledTimes(rootResLookups);
				if (namedTypeLookups !== undefined)
					expect(resolveTypeRefMock).toBeCalledTimes(namedTypeLookups);
			};
			return fc.assert(fc.asyncProperty(resourceArgsArb, recursiveResDefArb, predicate));
		});
	});
});
