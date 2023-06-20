/**
 * Types for Pulumi package schema based on central JSON schema description:
 * https://raw.githubusercontent.com/pulumi/pulumi/master/pkg/codegen/schema/pulumi.json
 *
 * Originally generated using json-schema-to-typescript, which supports JSON
 * schema draft-04. Then manually refined to address the lacks and
 * incompatibilities with JSON schema 2020-12. Ideally, we find a typescript
 * type generator that supports the recent JSON schema versions Pulumi uses in
 * the central package schema definition.
 */

import type { EncodedUri } from './pulumi';

/**
 * A description of the schema for a Pulumi Package
 */
export type PulumiPackageMetaschema = {
	/**
	 * The unqualified name of the package (e.g. "aws", "azure", "gcp",
	 * "kubernetes", "random")
	 */
	name: string;
	/**
	 * The human-friendly name of the package.
	 */
	displayName?: string;
	/**
	 * The version of the package. The version must be valid semver.
	 */
	version?: string;
	/**
	 * The description of the package. Descriptions are interpreted as Markdown.
	 */
	description?: string;
	/**
	 * The list of keywords that are associated with the package, if any.
	 */
	keywords?: string[];
	/**
	 * The package's homepage.
	 */
	homepage?: string;
	/**
	 * The name of the license used for the package's contents.
	 */
	license?: string;
	/**
	 * Freeform text attribution of derived work, if required.
	 */
	attribution?: string;
	/**
	 * The URL at which the package's sources can be found.
	 */
	repository?: string;
	/**
	 * The URL of the package's logo, if any.
	 */
	logoUrl?: string;
	/**
	 * The URL to use when downloading the provider plugin binary.
	 */
	pluginDownloadURL?: string;
	/**
	 * The name of the person or organization that authored and published the
	 * package.
	 */
	publisher?: string;
	/**
	 * Format metadata about this package.
	 */
	meta?: {
		/**
		 * A regex that is used by the importer to extract a module name from
		 * the module portion of a type token. Packages that use the module
		 * format "namespace1/namespace2/.../namespaceN" do not need to specify
		 * a format. The regex must define one capturing group that contains the
		 * module name, which must be formatted as
		 * "namespace1/namespace2/...namespaceN".
		 */
		moduleFormat: string;
	};
	/**
	 * The package's configuration variables.
	 */
	config?: {
		/**
		 * A map from variable name to propertySpec that describes a package's
		 * configuration variables.
		 */
		variables?: {
			[k: string]: PropertyDefinition;
		};
		/**
		 * A list of the names of the package's non-required configuration
		 * variables.
		 */
		defaults?: string[];
	};
	/**
	 * A map from type token to complexTypeSpec that describes the set of
	 * complex types (i.e. object, enum) defined by this package.
	 */
	types?: {
		[k: Token]: TypeDefinition;
	};
	provider?: ResourceDefinition;
	/**
	 * A map from type token to resourceSpec that describes the set of resources
	 * and components defined by this package.
	 */
	resources?: {
		[k: Token]: ResourceDefinition;
	};
	/**
	 * A map from token to functionSpec that describes the set of functions
	 * defined by this package.
	 */
	functions?: {
		[k: Token]: FunctionDefinition;
	};
	/**
	 * Additional language-specific data about the package.
	 */
	language?: object;
};

/**
 * Token following patter:
 * ^[a-zA-Z][-a-zA-Z0-9_]*:([^0-9][a-zA-Z0-9._/-]*)?:[^0-9][a-zA-Z0-9._/]*$
 *
 * In the regex below, the 'module' portion of the token is optional. However, a
 * missing module component creates a '::', which breaks URNs ('::' is the URN
 * delimiter). We have many test schemas that use an empty module component
 * successfully, as they never create URNs; while these are _probably_ the only
 * places that need updating, it might be possible that there are module-less
 * type tokens in the wild elsewhere and we may need to remain compatible with
 * those tokens.
 */
export type Token = string;

/**
 * A reference to a type. The particular kind of type referenced is determined
 * based on the contents of the "type" property and the presence or absence of
 * the "additionalProperties", "items", "oneOf", and "$ref" properties.
 */
export type TypeReference = PrimitiveType | ArrayType | MapType | NamedType | UnionType;

/**
 * A reference to a primitive type. A primitive type must have only the "type"
 * property set.
 */
export type PrimitiveType = {
	/**
	 * The primitive type, if any
	 */
	type: 'boolean' | 'integer' | 'number' | 'string';
	additionalProperties?: never;
	items?: never;
	oneOf?: never;
	$ref?: never;
	/**
	 * Indicates that when used as an input, this type does not accept eventual
	 * values.
	 */
	plain?: boolean;
};

/**
 * A reference to an array type. The "type" property must be set to "array" and
 * the "items" property must be present. No other properties may be present.
 */
export type ArrayType = {
	type: 'array';
	/**
	 * The element type of the array
	 */
	items: TypeReference;
	additionalProperties?: never;
	oneOf?: never;
	$ref?: never;
	/**
	 * Indicates that when used as an input, this type does not accept eventual
	 * values.
	 */
	plain?: boolean;
};

/**
 * A reference to a map type. The "type" property must be set to "object" and
 * the "additionalProperties" property may be present. No other properties may
 * be present.
 */
export type MapType = {
	type: 'object';
	/**
	 * The element type of the map. Defaults to \"string\" when omitted.
	 */
	additionalProperties?: TypeReference;
	items?: never;
	oneOf?: never;
	$ref?: never;
	/**
	 * Indicates that when used as an input, this type does not accept eventual
	 * values.
	 */
	plain?: boolean;
};

/**
 * A reference to a type in this or another document. The "$ref" property must
 * be present. The "type" property is ignored if it is present. No other
 * properties may be present.
 */
export type NamedType = {
	/**
	 * ignored; present for compatibility with existing schemas
	 */
	type?: string;
	/**
	 * The URI of the referenced type. For example, the built-in Archive, Asset,
	 * and Any types are referenced as "pulumi.json#/Archive",
	 * "pulumi.json#/Asset", and "pulumi.json#/Any", respectively. A type from
	 * this document is referenced as "#/types/pulumi:type:token". A type from
	 * another document is referenced as "path#/types/pulumi:type:token", where
	 * path is of the form: "/provider/vX.Y.Z/schema.json" or "pulumi.json" or
	 * "http[s]://example.com/provider/vX.Y.Z/schema.json" A resource from this
	 * document is referenced as "#/resources/pulumi:type:token". A resource
	 * from another document is referenced as
	 * "path#/resources/pulumi:type:token", where path is of the form:
	 * "/provider/vX.Y.Z/schema.json" or "pulumi.json" or
	 * "http[s]://example.com/provider/vX.Y.Z/schema.json"
	 */
	$ref: EncodedUri;
	additionalProperties?: never;
	items?: never;
	oneOf?: never;
	/**
	 * Indicates that when used as an input, this type does not accept eventual
	 * values.
	 */
	plain?: boolean;
};

/**
 * A reference to a union type. The "oneOf" property must be present. The union
 * may additional specify an underlying primitive type via the "type" property
 * and a discriminator via the "discriminator" property. No other properties may
 * be present.
 */
export type UnionType = {
	/**
	 * The underlying primitive type of the union, if any
	 */
	type?: 'boolean' | 'integer' | 'number' | 'string';
	/**
	 * If present, indicates that values of the type may be one of any of the
	 * listed types
	 */
	oneOf: TypeReference[];
	/**
	 * Informs the consumer of an alternative schema based on the value
	 * associated with it
	 */
	discriminator?: {
		/**
		 * PropertyName is the name of the property in the payload that will
		 * hold the discriminator value
		 */
		propertyName: string;
		/**
		 * an optional object to hold mappings between payload values and schema
		 * names or references
		 */
		mapping?: {
			[k: string]: string;
		};
		[k: string]: unknown;
	};
	additionalProperties?: never;
	items?: never;
	$ref?: never;
	/**
	 * Indicates that when used as an input, this type does not accept eventual
	 * values.
	 */
	plain?: boolean;
};

/**
 * Describes an object or resource property
 */
export type PropertyDefinition = TypeReference & {
	/**
	 * The description of the property, if any. Interpreted as Markdown.
	 */
	description?: string;
	/**
	 * The constant value for the property, if any. The type of the value must
	 * be assignable to the type of the property.
	 */
	const?: boolean | number | string;
	/**
	 * The default value for the property, if any. The type of the value must be
	 * assignable to the type of the property.
	 */
	default?: boolean | number | string;
	/**
	 * Additional information about the property's default value, if any.∑
	 */
	defaultInfo?: {
		/**
		 * A set of environment variables to probe for a default value.
		 */
		environment: string[];
		/**
		 * Additional language-specific data about the default value.
		 */
		language?: object;
	};
	/**
	 * Indicates whether the property is deprecated
	 */
	deprecationMessage?: string;
	/**
	 * Additional language-specific data about the property.
	 */
	language?: object;
	/**
	 * Specifies whether the property is secret (default false).
	 */
	secret?: boolean;
	/**
	 * Specifies whether a change to the property causes its containing resource
	 * to be replaced instead of updated (default false).
	 */
	replaceOnChanges?: boolean;
	/**
	 * Indicates that the provider will replace the resource when this property
	 * is changed.
	 */
	willReplaceOnChanges?: boolean;
	[k: string]: unknown;
};

/**
 * Describes an object or enum type.
 */
export type TypeDefinition = {
	/**
	 * The description of the type, if any. Interpreted as Markdown.
	 */
	description?: string;
	/**
	 * Additional language-specific data about the type.
	 */
	language?: object;
	/**
	 * Indicates that the implementation of the type should not be generated
	 * from the schema, and is instead provided out-of-band by the package
	 * author
	 */
	isOverlay?: boolean;
	[k: string]: unknown;
} & (ObjectTypeDefinition | EnumTypeDefinition);

export type ObjectTypeDefinition = {
	type?: 'object';
} & ObjectTypeDetails;

/**
 * Describes an object type
 */
export type ObjectTypeDetails = {
	/**
	 * A map from property name to propertySpec that describes the object's
	 * properties.
	 */
	properties?: {
		[k: string]: PropertyDefinition;
	};
	/**
	 * A list of the names of an object type's required properties. These
	 * properties must be set for inputs and will always be set for outputs.
	 */
	required?: string[];
	[k: string]: unknown;
};

/**
 * Describes an enum type
 */
export type EnumTypeDefinition = {
	/**
	 * The underlying primitive type of the enum
	 */
	type: 'boolean' | 'integer' | 'number' | 'string';
	/**
	 * The list of possible values for the enum
	 */
	enum: EnumValueDefinition[];
	[k: string]: unknown;
};

export type EnumValueDefinition = {
	/**
	 * If present, overrides the name of the enum value that would usually be
	 * derived from the value.
	 */
	name?: string;
	/**
	 * The description of the enum value, if any. Interpreted as Markdown.
	 */
	description?: string;
	/**
	 * The enum value itself
	 */
	value: boolean | number | string;
	/**
	 * Indicates whether the value is deprecated.
	 */
	deprecationMessage?: string;
	[k: string]: unknown;
};

/**
 * Describes a resource or component.
 */
export type ResourceDefinition = {
	/**
	 * The description of the resource, if any. Interpreted as Markdown.
	 */
	description?: string;
	/**
	 * A map from property name to propertySpec that describes the resource's
	 * input properties.
	 */
	inputProperties?: {
		[k: string]: PropertyDefinition;
	};
	/**
	 * A list of the names of the resource's required input properties.
	 */
	requiredInputs?: string[];
	/**
	 * An optional objectTypeSpec that describes additional inputs that mau be
	 * necessary to get an existing resource. If this is unset, only an ID is
	 * necessary.
	 */
	stateInputs?: ObjectTypeDetails;
	/**
	 * The list of aliases for the resource.
	 */
	aliases?: AliasDefinition[];
	/**
	 * Indicates whether the resource is deprecated
	 */
	deprecationMessage?: string;
	/**
	 * Indicates whether the resource is a component.
	 */
	isComponent?: boolean;
	/**
	 * A map from method name to function token that describes the resource's
	 * method set.
	 */
	methods?: { [k: string]: string };
	/**
	 * Indicates that the implementation of the resource should not be generated
	 * from the schema, and is instead provided out-of-band by the package
	 * author
	 */
	isOverlay?: boolean;
	[k: string]: unknown;
} & ObjectTypeDetails;

export type AliasDefinition = {
	/**
	 * The name portion of the alias, if any
	 */
	name?: string;
	/**
	 * The project portion of the alias, if any
	 */
	project?: string;
	/**
	 * The type portion of the alias, if any
	 */
	type?: string;
	[k: string]: unknown;
};

/**
 * Describes a function.
 */
export type FunctionDefinition = {
	/**
	 * The description of the function, if any. Interpreted as Markdown.
	 */
	description?: string;
	/**
	 * The bag of input values for the function, if any.
	 */
	inputs?: ObjectTypeDetails;
	/**
	 * A list of parameter names that determines wheth∑er the input bag should
	 * be treated as a single argument or as multiple arguments. The list
	 * corresponds to the order in which the parameters should be passed to the
	 * function.
	 */
	multiArgumentInputs?: string[];
	/**
	 * Specifies the return type of the function definition.
	 */
	outputs?: TypeReference | ObjectTypeDetails;
	/**
	 * Indicates whether the function is deprecated
	 */
	deprecationMessage?: string;
	/**
	 * Additional language-specific data about the function.
	 */
	language?: object;
	/**
	 * Indicates that the implementation of the function should not be generated
	 * from the schema, and is instead provided out-of-band by the package
	 * author
	 */
	isOverlay?: boolean;
	[k: string]: unknown;
};
