import * as fc from 'fast-check';
import type { ResourceArgs } from '@proti/core';
import { type OracleConfig, defaultOracleConfig } from '../src/config';
import {
	anyValidator,
	arrayTypeValidator,
	builtInTypeValidator,
	constValidator,
	cycleBreakerValidator,
	enumTypeDefinitionValidator,
	mapTypeValidator,
	objectTypeDetailsValidator,
	primitiveTypeValidator,
	PulumiPackagesSchemaOracle,
	unionTypeValidator,
	unresolvableUriValidator,
	type Validator,
} from '../src/oracle';
import {
	type BuiltInTypeUri,
	type NamedTypeArgs,
	type PrimitiveType,
	type ResourceDefinition,
	type Transforms,
	builtInTypeUris,
} from '../src/pulumi';
import { resourceDefinitionArb } from './pulumi-package-metaschema/arbitraries';
import { TypeDefinition } from '../src/pulumi-package-metaschema';

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
const conf = defaultOracleConfig();
const neverValidator = (v: unknown): v is unknown => {
	throw new Error('Never valid');
};
const falseValidator = (v: unknown): v is unknown => false;

describe('built-in type validator', () => {
	const isJson = (s: string) => {
		try {
			JSON.parse(s);
			return true;
		} catch (e) {
			return false;
		}
	};
	const cases = [
		[
			'json',
			fc.json(),
			['pulumi.json#/Any', 'pulumi.json#/Archive', 'pulumi.json#/Asset', 'pulumi.json#/Json'],
		],
		[
			'string',
			fc.string().filter((s) => !isJson(s)),
			['pulumi.json#/Archive', 'pulumi.json#/Asset', 'pulumi.json#/Any'],
		],
		['any', fc.anything().filter((v) => typeof v !== 'string'), ['pulumi.json#/Any']],
	] as ReadonlyArray<readonly [string, fc.Arbitrary<unknown>, ReadonlyArray<string>]>;
	it.each(
		builtInTypeUris.flatMap((uri): [BuiltInTypeUri, string, string, fc.Arbitrary<unknown>][] =>
			cases.map(([test, arb, validTypes]) => {
				const label = `${validTypes.includes(uri) ? '' : 'not '}validate`;
				return [uri, label, test, arb];
			})
		)
	)('%s validator should %s %s', (uri, validate, _, arb) => {
		const predicate = async (val: unknown) => {
			const validator = await builtInTypeValidator(uri, '');
			if (validate.includes('not')) expect(() => validator(val)).toThrow();
			else expect(validator(val)).toBe(true);
		};
		return fc.assert(fc.asyncProperty(arb, predicate));
	});
});

describe('unresolvable URI validator', () => {
	const ts = {} as Transforms<Validator>;
	const ntArgs = {} as NamedTypeArgs<Validator>;

	it('should fail for unresolved reference', () => {
		const c = { ...conf, failOnMissingTypeReference: true };
		const predicate = async (uri: string, path: string) => {
			expect(() => unresolvableUriValidator(c, ts, ntArgs)(uri, path)).rejects.toThrow(
				/has unknown type reference/
			);
		};
		return fc.assert(fc.asyncProperty(fc.string(), fc.string(), predicate));
	});

	it('should validate for default undefined', () => {
		console.warn = () => {};
		const predicate = async (uri: string, path: string, value: any) => {
			const validator = await unresolvableUriValidator(conf, ts, ntArgs)(uri, path);
			expect(validator(value)).toBe(true);
		};
		return fc.assert(fc.asyncProperty(fc.string(), fc.string(), fc.anything(), predicate));
	});

	it.each([['resource definition', true, false, resourceDefinitionArb()]])(
		'should validate for default resource definition',
		(_, isResDef, isTypeDef, arb) => {
			console.warn = () => {};
			const tss: Transforms<Validator> = {
				arrayType: async () => anyValidator,
				builtInType: async () => anyValidator,
				cycleBreaker: () => anyValidator,
				const: async () => anyValidator,
				enumType: async () => anyValidator,
				mapType: async () => anyValidator,
				objType: async () => anyValidator,
				resourceDef: async () => anyValidator,
				primitive: async () => anyValidator,
				propDef: async () => anyValidator,
				unionType: async () => anyValidator,
				unresolvableUri: async () => anyValidator,
			};
			const predicate = async (
				uri: string,
				path: string,
				def: ResourceDefinition | TypeDefinition,
				value: any
			) => {
				const c = { ...conf, defaultTypeReferenceDefinition: def };
				const validator = await unresolvableUriValidator(c, tss, ntArgs)(uri, path);
				expect(validator(value)).toBe(true);
			};
			return fc.assert(
				fc.asyncProperty(fc.string(), fc.string(), arb, fc.anything(), predicate)
			);
		}
	);
});

describe('cycle breaker validator', () => {
	it('should throw error before validator is availablie', () => {
		const predicate = (val: unknown) =>
			expect(() => cycleBreakerValidator(new Promise(() => {}))(val)).toThrow(
				/not initialized/
			);
		fc.assert(fc.property(fc.anything(), predicate));
	});

	it('should validate after validator is available', () => {
		const predicate = async (val: unknown) => {
			const validator = cycleBreakerValidator(Promise.resolve(anyValidator));
			await Promise.resolve(); // Wait a tick to let cycle breaker init
			expect(validator(val)).toBe(true);
		};
		return fc.assert(fc.asyncProperty(fc.anything(), predicate));
	});
});

describe('array type validator', () => {
	it('should validate valid array', () => {
		const predicate = async (arr: unknown) =>
			expect((await arrayTypeValidator(anyValidator, ''))(arr)).toBe(true);
		return fc.assert(fc.asyncProperty(fc.array(fc.anything()), predicate));
	});

	it('should not validate invalid items', () => {
		const predicate = async (arr: unknown[]) =>
			expect(async () =>
				(await arrayTypeValidator(neverValidator, ''))([...arr, ''])
			).rejects.toThrow();
		return fc.assert(fc.asyncProperty(fc.array(fc.anything()), predicate));
	});

	it('should not validate non-array', () => {
		const predicate = async (value: unknown) =>
			expect(async () =>
				(await arrayTypeValidator(anyValidator, ''))(value)
			).rejects.toThrow();
		return fc.assert(fc.asyncProperty(fc.anything({ maxDepth: 0 }), predicate));
	});
});

describe('map type validator', () => {
	it('should validate valid object', () => {
		const predicate = async (obj: unknown) =>
			expect((await mapTypeValidator(anyValidator, ''))(obj)).toBe(true);
		return fc.assert(fc.asyncProperty(fc.object(), predicate));
	});

	it('should not validate invalid properties', () => {
		const predicate = async (obj: object) =>
			expect(async () =>
				(await mapTypeValidator(neverValidator, ''))({ ...obj, a: true })
			).rejects.toThrow();
		return fc.assert(fc.asyncProperty(fc.object(), predicate));
	});

	it('should not validate non-object', () => {
		const predicate = async (value: unknown) =>
			expect(async () => (await mapTypeValidator(anyValidator, ''))(value)).rejects.toThrow();
		return fc.assert(fc.asyncProperty(fc.anything({ maxDepth: 0 }), predicate));
	});
});

describe('primitive type', () => {
	const primitiveTypes: PrimitiveType['type'][] = ['boolean', 'integer', 'number', 'string'];
	const rawCases = [
		['boolean', fc.boolean(), ['boolean']],
		['integer', fc.integer(), ['integer', 'number']],
		['float', fc.float().filter((f) => !Number.isInteger(f)), ['number']],
		['string', fc.string(), ['string']],
		['undefined', fc.constant(undefined), []],
		['object', fc.object(), []],
	] as ReadonlyArray<readonly [string, fc.Arbitrary<unknown>, ReadonlyArray<string>]>;
	const cases = primitiveTypes.flatMap(
		(validatorType): [PrimitiveType['type'], string, string, fc.Arbitrary<unknown>][] =>
			rawCases.map(([valueType, arb, validTypes]) => {
				const label = `${validTypes.includes(validatorType) ? '' : 'not '}validate`;
				return [validatorType, label, valueType, arb];
			})
	);
	it.each(cases)('%s validator should %s %s', (type, validate, valueType, arb) => {
		const predicate = async (val: unknown) => {
			const validator = await primitiveTypeValidator(type, '');
			if (validate.includes('not')) expect(() => validator(val)).toThrow();
			else expect(validator(val)).toBe(true);
		};
		return fc.assert(fc.asyncProperty(arb, predicate));
	});
});

describe('union type validator', () => {
	it('should validate if at least one validator validates', () => {
		const arb = fc.array(fc.constantFrom(anyValidator, neverValidator, falseValidator));
		const predicate = async (validators: readonly Validator[], value: unknown) =>
			expect((await unionTypeValidator([...validators, anyValidator], ''))(value)).toBe(true);
		return fc.assert(fc.asyncProperty(arb, fc.anything(), predicate));
	});

	it('should not validate no validator validates', () => {
		const arb = fc.array(fc.constantFrom(neverValidator, falseValidator));
		const predicate = async (validators: readonly Validator[], value: unknown) =>
			expect(async () => (await unionTypeValidator(validators, ''))(value)).rejects.toThrow(
				/is not any of the/
			);
		return fc.assert(fc.asyncProperty(arb, fc.anything(), predicate));
	});
});

describe('const validator', () => {
	it('should validate const', () => {
		const predicate = async (constant: any) =>
			expect((await constValidator(constant, ''))(constant)).toBe(true);
		return fc.assert(fc.asyncProperty(fc.anything(), predicate));
	});

	it('should not validate non-const values', () => {
		const arb = fc.tuple(fc.anything(), fc.anything()).filter(([a, b]) => a !== b);
		const predicate = async ([constant, val]: [any, any]) =>
			expect(async () => (await constValidator(constant, ''))(val)).rejects.toThrow(/is not/);
		return fc.assert(fc.asyncProperty(arb, predicate));
	});
});

describe('object type details validator', () => {
	type Arb = [
		Readonly<Record<string, unknown>>,
		Readonly<Record<string, Validator>>,
		readonly string[]
	];
	const arb: fc.Arbitrary<Arb> = fc
		.uniqueArray(fc.string())
		.map((ss) => [
			Object.fromEntries(ss.map((s) => [s, true])),
			Object.fromEntries(ss.map((s) => [s, anyValidator])),
			[],
		]);

	it('should validate valid objects', () => {
		const predicate = async ([obj, propValidators, required]: Arb) => {
			const validator = await objectTypeDetailsValidator(propValidators, required, '');
			expect(validator(obj)).toBe(true);
		};
		return fc.assert(fc.asyncProperty(arb, predicate));
	});

	it('should not validate if value is no object', () => {
		const valArb = fc.anything({ maxDepth: 0 });
		const predicate = async ([, propValidators, required]: Arb, value: unknown) => {
			const validator = await objectTypeDetailsValidator(propValidators, required, '');
			expect(() => validator(value)).toThrowError();
		};
		return fc.assert(fc.asyncProperty(arb, valArb, predicate));
	});

	it('should not validate if required properties are missing', () => {
		const predicate = async ([obj, propValidators]: Arb) => {
			// eslint-disable-next-line no-param-reassign
			delete (obj as any).a;
			const validator = await objectTypeDetailsValidator(
				{ ...propValidators, a: anyValidator },
				['a'],
				''
			);
			expect(() => validator(obj)).toThrow(/misses required property/);
		};
		return fc.assert(fc.asyncProperty(arb, predicate));
	});

	it('should not validate if object has non-defined properties', () => {
		const predicate = async ([obj, propValidators, required]: Arb) => {
			const validators = Object.fromEntries<Validator>(
				Object.keys(propValidators)
					.slice(0, -1)
					.filter((k) => k !== 'a')
					.map((k) => [k, propValidators[k]])
			);
			const validator = await objectTypeDetailsValidator(validators, required, '');
			expect(() => validator({ ...obj, a: 'true' })).toThrow(/has unknown property/);
		};
		return fc.assert(fc.asyncProperty(arb, predicate));
	});
});

describe('enum type definition validator', () => {
	const enumValsArb = fc.uniqueArray(fc.anything({ maxDepth: 0 }), { minLength: 1 });

	it('should validate enum values', () => {
		const predicate = async (values: any[], i: number) => {
			const validator = await enumTypeDefinitionValidator(values, '');
			expect(validator(values[i % values.length])).toBe(true);
		};
		return fc.assert(fc.asyncProperty(enumValsArb, fc.nat(), predicate));
	});

	it('should not validate non-enum values', () => {
		const predicate = async (values: any[]) => {
			const validator = await enumTypeDefinitionValidator(values.slice(1), '');
			expect(() => validator(values[0])).toThrow(/is not in enum/);
		};
		return fc.assert(fc.asyncProperty(enumValsArb, predicate));
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

		it.each<readonly [string, ResourceDefinition, unknown]>([
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

		it.each<readonly [string, ResourceDefinition, unknown]>([
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
		it.each<[string, Partial<OracleConfig>, boolean, boolean, number]>([
			['cache resource validator', {}, true, true, 1],
			['cache named type validator', {}, false, false, 3],
			['use validator cached from named types for root resources', {}, false, true, 2],
		])('should %s', (a, c, sameTypeName1, sameTypeName2, resLookups) => {
			const predicate = async (
				resArgs: ResourceArgs,
				[resDef, resType]: [ResourceDefinition, string]
			) => {
				getResourceMock.mockReset().mockReturnValue(resDef);
				const oracle = new PulumiPackagesSchemaOracle({ ...conf, ...c });
				const subject = (type: string) =>
					expect(
						oracle.asyncValidateResource({
							...resArgs,
							type,
							inputs: { [resType]: {} },
						})
					).resolves.toBeUndefined();
				await subject(`${resType}${sameTypeName1 ? '' : '_'}`);
				await subject(`${resType}${sameTypeName2 ? '' : '__'}`);
				expect(getResourceMock).toBeCalledTimes(resLookups);
			};
			return fc.assert(fc.asyncProperty(resourceArgsArb, recursiveResDefArb, predicate));
		});
	});
});
