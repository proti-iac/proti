import * as fc from 'fast-check';
import type {
	AliasDefinition,
	ArrayType,
	EnumTypeDefinition,
	EnumValueDefinition,
	MapType,
	NamedType,
	ObjectTypeDetails,
	PrimitiveType,
	PropertyDefinition,
	ResourceDefinition,
	TypeDefinition,
	TypeReference,
	UnionType,
} from '../../src/pulumi';

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

export const objectTypeDetailsArb = (): fc.Arbitrary<ObjectTypeDetails> => {
	const maxProps = 100;
	return fc
		.tuple(
			fc.record(
				{ properties: fc.constant(true), required: fc.constant(true) },
				{ requiredKeys: [] }
			),
			fc.dictionary(fc.string(), propertyDefinitionArb(), { maxKeys: maxProps }),
			fc.uniqueArray(fc.nat(maxProps))
		)
		.map(([objectTypeDetailsFrame, properties, requiredPropertyIds]) => {
			let [props, required]: [{} | undefined, string[] | undefined] = [undefined, undefined];
			if (objectTypeDetailsFrame.properties !== undefined) {
				props = properties;
				if (objectTypeDetailsFrame.required !== undefined)
					required = Object.keys(properties).filter((_, i) =>
						requiredPropertyIds.includes(i)
					);
			}
			return { properties: props, required };
		});
};

export const enumValueDefinitionArb = (): fc.Arbitrary<EnumValueDefinition> =>
	fc.record(
		{
			name: fc.string(),
			description: fc.string(),
			value: fc.oneof(fc.boolean(), numberArb(), fc.string()),
			deprecationMessage: fc.string(),
		},
		{ requiredKeys: ['value'] }
	);

export const enumTypeDefinitionArb = (): fc.Arbitrary<EnumTypeDefinition> =>
	fc.record({
		type: fc.constantFrom('boolean', 'integer', 'number', 'string'),
		enum: fc.array(enumValueDefinitionArb(), { minLength: 1 }),
	});

export const typeDefinitionArb = (): fc.Arbitrary<TypeDefinition> => {
	const typeDefArb = fc.record(
		{
			description: fc.string(),
			language: fc.object(),
			isOverlay: fc.boolean(),
		},
		{ requiredKeys: [] }
	);
	return fc
		.tuple(fc.oneof(objectTypeDetailsArb(), enumTypeDefinitionArb()), typeDefArb)
		.map(([augDef, typeDef]) => ({
			...typeDef,
			...augDef,
		}));
};

export const aliasDefinitionArb = (): fc.Arbitrary<AliasDefinition> =>
	fc.record({ name: fc.string(), project: fc.string(), type: fc.string() }, { requiredKeys: [] });

export const resourceDefinitionArb = (): fc.Arbitrary<ResourceDefinition> => {
	const resDefArb: fc.Arbitrary<ResourceDefinition> = fc.record(
		{
			description: fc.string(),
			stateInputs: objectTypeDetailsArb(),
			aliases: fc.array(aliasDefinitionArb()),
			isComponent: fc.boolean(),
			methods: fc.dictionary(fc.string(), fc.string()),
			isOverlay: fc.boolean(),
		},
		{ requiredKeys: [] }
	);
	return fc
		.tuple(objectTypeDetailsArb(), objectTypeDetailsArb(), resDefArb)
		.map(([objectTypeDetails, inputProperties, resourceDefinition]) => ({
			...resourceDefinition,
			...objectTypeDetails,
			inputProperties: inputProperties.properties,
			requiredInputs: inputProperties.required,
		}));
};
