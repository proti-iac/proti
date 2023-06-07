import * as fc from 'fast-check';
import {
	ArrayType,
	MapType,
	NamedType,
	PrimitiveType,
	PropertyDefinition,
	TypeReference,
	UnionType,
} from '../../src/pulumi-package-metaschema';

export const numberArb = (): fc.Arbitrary<number> =>
	fc.oneof(fc.integer(), fc.float(), fc.double());

export const primitiveTypeArb = (): fc.Arbitrary<PrimitiveType> =>
	fc.record(
		{
			type: fc.constantFrom('boolean', 'integer', 'number', 'string'),
			plain: fc.boolean(),
		},
		{ requiredKeys: ['type'] }
	);

export const arrayTypeArb = (
	typeReferenceArb: fc.Arbitrary<TypeReference>
): fc.Arbitrary<ArrayType> =>
	fc.record(
		{
			type: fc.constant('array'),
			items: typeReferenceArb,
			plain: fc.boolean(),
		},
		{ requiredKeys: ['type', 'items'] }
	);

export const mapTypeArb = (typeReferenceArb: fc.Arbitrary<TypeReference>): fc.Arbitrary<MapType> =>
	fc.record(
		{
			type: fc.constant('object'),
			additionalProperties: typeReferenceArb,
			plain: fc.boolean(),
		},
		{ requiredKeys: ['type'] }
	);

export const namedTypeArb = (): fc.Arbitrary<NamedType> =>
	fc.record(
		{
			type: fc.string(),
			$ref: fc.string(),
			plain: fc.boolean(),
		},
		{ requiredKeys: ['$ref'] }
	);

export const unionTypeArb = (
	typeReferenceArb: fc.Arbitrary<TypeReference>
): fc.Arbitrary<UnionType> =>
	fc.record(
		{
			type: fc.constantFrom('boolean', 'integer', 'number', 'string'),
			oneOf: fc.array(typeReferenceArb, { minLength: 1 }),
			discriminator: fc.record(
				{ propertyName: fc.string(), mapping: fc.dictionary(fc.string(), fc.string()) },
				{ requiredKeys: ['propertyName'] }
			),
			plain: fc.boolean(),
		},
		{ requiredKeys: ['oneOf'] }
	);

export const typeReferenceArb = (): fc.Arbitrary<TypeReference> =>
	fc.letrec<{ typeReference: TypeReference }>((tie) => ({
		typeReference: fc.oneof(
			primitiveTypeArb(),
			arrayTypeArb(tie('typeReference')),
			mapTypeArb(tie('typeReference')),
			// namedTypeArb(),
			unionTypeArb(tie('typeReference'))
		),
	})).typeReference;

export const propertyDefinitionArb = (): fc.Arbitrary<PropertyDefinition> => {
	const propDefArb = fc.record(
		{
			description: fc.string(),
			const: fc.oneof(fc.boolean(), numberArb(), fc.string()),
			default: fc.oneof(fc.boolean(), numberArb(), fc.string()),
			defaultInfo: fc.record(
				{ environment: fc.array(fc.string()), language: fc.object() },
				{ requiredKeys: ['environment'] }
			),
			deprecationMessage: fc.string(),
			language: fc.object(),
			secret: fc.boolean(),
			replaceOnChanges: fc.boolean(),
			willReplaceOnChanges: fc.boolean(),
		},
		{ requiredKeys: [] }
	);
	return fc.tuple(typeReferenceArb(), propDefArb).map(([typeReference, propertyDefinition]) => ({
		...typeReference,
		...propertyDefinition,
	}));
};
