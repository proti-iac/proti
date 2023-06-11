import * as fc from 'fast-check';
import type { DeepReadonly } from '@proti/core';
import { objectTypeToValidator, typeRefToValidator } from '../src/oracle';
import {
	arrayTypeArb,
	mapTypeArb,
	namedTypeArb,
	objectTypeDetailsArb,
	primitiveTypeArb,
	typeReferenceArb,
	unionTypeArb,
} from './pulumi-package-metaschema/arbitraries';
import type {
	ArrayType,
	MapType,
	NamedType,
	ObjectTypeDetails,
	PrimitiveType,
	TypeReference,
	UnionType,
} from '../src/pulumi-package-metaschema';

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

describe('type reference validator', () => {
	const typeRefPredicate =
		(valid: boolean) => (typeDef: DeepReadonly<TypeReference>, value: unknown) => {
			const validator = typeRefToValidator(typeDef, '');
			if (valid) expect(validator(value)).toBe(true);
			else expect(() => validator(value)).toThrowError();
		};

	describe('named type', () => {
		it('should fail', () => {
			const namedArb = namedTypeArb();
			const predicate = (mapType: DeepReadonly<NamedType>) =>
				expect(() => typeRefToValidator(mapType, '')).toThrowError();
			fc.assert(fc.property(namedArb, predicate));
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
			fc.assert(fc.property(unionArb, valueArb, typeRefPredicate(true)));
		});

		it('should not validate non-string-or-boolean values', () => {
			const valueArb = fc
				.anything()
				.filter((v) => typeof v !== 'string' && typeof v !== 'boolean');
			fc.assert(fc.property(unionArb, valueArb, typeRefPredicate(false)));
		});
	});

	describe('array type', () => {
		const stringArrayArb = arrayTypeArb(typeReferenceArb()).map(
			(arrType): DeepReadonly<ArrayType> => ({ ...arrType, items: { type: 'string' } })
		);

		it('should validate string arrays', () => {
			fc.assert(fc.property(stringArrayArb, fc.array(fc.string()), typeRefPredicate(true)));
		});

		it('should not validate non-string-array values', () => {
			const valArb = fc
				.anything()
				.filter((v) => !Array.isArray(v) || v.some((i) => typeof i !== 'string'));
			fc.assert(fc.property(stringArrayArb, valArb, typeRefPredicate(false)));
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
			fc.assert(fc.property(numberMapArb, valArb, typeRefPredicate(true)));
		});

		it('should validate default type map types', () => {
			const valArb = fc.dictionary(fc.string(), fc.string());
			fc.assert(fc.property(stringMapArb, valArb, typeRefPredicate(true)));
		});

		it('should not validate non-string-string-map values', () => {
			const valArb = fc
				.anything()
				.filter(
					(v) =>
						typeof v !== 'object' ||
						Object.values(v || {}).some((i) => typeof i !== 'string')
				);
			fc.assert(fc.property(stringMapArb, valArb, typeRefPredicate(false)));
		});
	});

	describe('primitive type', () => {
		const primitiveTypes: PrimitiveType['type'][] = ['boolean', 'integer', 'number', 'string'];
		const cases: ReadonlyArray<
			readonly [string, fc.Arbitrary<unknown>, ReadonlyArray<string>]
		> = [
			['boolean', fc.boolean(), ['boolean']],
			['integer', fc.integer(), ['integer', 'number']],
			['float', fc.float().filter((f) => !Number.isInteger(f)), ['number']],
			['string', fc.string(), ['string']],
			['undefined', fc.constant(undefined), []],
			['object', fc.object(), []],
		];
		it.each(
			primitiveTypes.flatMap((validatorType) =>
				cases.map(
					([valueType, arb, validTypes]): readonly [
						PrimitiveType['type'],
						string,
						string,
						fc.Arbitrary<unknown>
					] => [
						validatorType,
						`${validTypes.includes(validatorType) ? '' : 'not '}validate`,
						valueType,
						arb,
					]
				)
			)
		)('%s validator should %s %s', (type, validate, valueType, arb) => {
			const typeArb = primitiveTypeArb().map(
				(primType): DeepReadonly<PrimitiveType> => ({ ...primType, type })
			);
			fc.assert(fc.property(typeArb, arb, typeRefPredicate(validate === 'validate')));
		});
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
		const predicate = ([obj, objType]: [unknown, DeepReadonly<ObjectTypeDetails>]) =>
			expect(objectTypeToValidator(objType, '')(obj)).toBe(true);
		fc.assert(fc.property(arbs, predicate));
	});

	it('should not validate if value is no object', () => {
		const objTypeArb = objectTypeDetailsArb();
		const valArb = fc
			.anything()
			.filter((v) => typeof v !== 'object' || Array.isArray(v) || v === null);
		const predicate = (objType: DeepReadonly<ObjectTypeDetails>, value: unknown) =>
			expect(() => objectTypeToValidator(objType, '')(value)).toThrowError();
		fc.assert(fc.property(objTypeArb, valArb, predicate));
	});

	it('should not validate if required properties are missing', () => {
		const predicate = ([obj, objType]: [any, DeepReadonly<ObjectTypeDetails>]) => {
			const type: DeepReadonly<ObjectTypeDetails> = {
				...objType,
				required: ['a'],
			};
			// eslint-disable-next-line no-param-reassign
			obj.a = undefined;
			expect(() => objectTypeToValidator(type, '')(obj)).toThrowError();
		};
		fc.assert(fc.property(arbs, predicate));
	});

	it('should not validate if object has non-defined properties', () => {
		const predicate = ([obj, objType]: [any, DeepReadonly<ObjectTypeDetails>]) => {
			const type: DeepReadonly<ObjectTypeDetails> = {
				...objType,
				properties: Object.fromEntries(
					Object.keys(objType.properties || {})
						.slice(-1)
						.map((k) => [k, objType[k]])
				) as Record<string, TypeReference>,
			};
			if (Object.keys(objType.properties || {}).length === 0)
				// eslint-disable-next-line no-param-reassign
				obj.a = 'true';
			expect(() => objectTypeToValidator(type, '')(obj)).toThrowError();
		};
		fc.assert(fc.property(arbs, predicate));
	});
});
