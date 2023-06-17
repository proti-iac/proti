import { type DeepReadonly, asyncMapValues } from '@proti/core';
import { runPulumiCmd } from '@pulumi/pulumi/automation';
import { is } from 'typia';
import type {
	AliasDefinition as PulumiAliasDefinition,
	ArrayType as PulumiArrayType,
	EnumTypeDefinition as PulumiEnumTypeDefinition,
	EnumValueDefinition as PulumiEnumValueDefinition,
	MapType as PulumiMapType,
	NamedType as PulumiNamedType,
	ObjectTypeDetails as PulumiObjectTypeDetails,
	PropertyDefinition as PulumiPropertyDefinition,
	PrimitiveType as PulumiPrimitveTyp,
	PulumiPackageMetaschema,
	ResourceDefinition as PulumiResourceDefinition,
	Token as PulumiToken,
	TypeDefinition as PulumiTypeDefinition,
	TypeReference as PulumiTypeReference,
	UnionType as PulumiUnionType,
} from './pulumi-package-metaschema';
import type { SchemaRegistry } from './schema-registry';

// Pulumi hides the runPulumiCmd export using @internal. To use it here, we provide the type declaration manually.
declare module '@pulumi/pulumi/automation' {
	class CommandResult {
		stdout: string;

		stderr: string;

		code: number;

		err?: Error;

		toString: () => string;
	}
	// eslint-disable-next-line @typescript-eslint/no-shadow
	const runPulumiCmd: (
		args: string[],
		cwd: string,
		additionalEnv: { [key: string]: string },
		onOutput?: (data: string) => void
	) => Promise<CommandResult>;
}
export const runPulumi = runPulumiCmd;

export type AliasDefinition = DeepReadonly<PulumiAliasDefinition>;
export type ArrayType = DeepReadonly<PulumiArrayType>;
export type EnumTypeDefinition = DeepReadonly<PulumiEnumTypeDefinition>;
export type EnumValueDefinition = DeepReadonly<PulumiEnumValueDefinition>;
export type MapType = DeepReadonly<PulumiMapType>;
export type NamedType = DeepReadonly<PulumiNamedType>;
export type ObjectTypeDetails = DeepReadonly<PulumiObjectTypeDetails>;
export type PkgSchema = DeepReadonly<PulumiPackageMetaschema>;
export type PrimitiveType = DeepReadonly<PulumiPrimitveTyp>;
export type PropertyDefinition = DeepReadonly<PulumiPropertyDefinition>;
export type ResourceDefinition = DeepReadonly<PulumiResourceDefinition>;
export type Token = DeepReadonly<PulumiToken>;
export type TypeDefinition = DeepReadonly<PulumiTypeDefinition>;
export type TypeReference = DeepReadonly<PulumiTypeReference>;
export type UnionType = DeepReadonly<PulumiUnionType>;

export type BuiltInTypeUri = `pulumi.json#/${'Any' | 'Archive' | 'Asset' | 'Json'}`;
export type Urn = Token;
export type Origin = string;
export type Uri = string;
export type NormalizedResourceUri = `#/resources/${Urn}`;
export type ResourceUri = `${Origin}${NormalizedResourceUri}`;
export type NormalizedTypeUri = `#/types/${Urn}`;
export type TypeUri = `${Origin}${NormalizedTypeUri}`;
export type RefUri = BuiltInTypeUri | ResourceUri | TypeUri;
export type NormalizedRefUri = BuiltInTypeUri | NormalizedResourceUri | NormalizedTypeUri;

export type BuiltInTypeTransform<T> = (type: BuiltInTypeUri, path: string) => T;
export type UnresolvableUriTransform<T> = (type: Uri, path: string) => T;
export type NamedTypeTransforms<T> = Readonly<{
	builtInType: BuiltInTypeTransform<T>;
	unresolvableUri: UnresolvableUriTransform<T>;
}>;
export const transformNamedType = async <T>(
	namedType: NamedType,
	transforms: NamedTypeTransforms<T>,
	transformResDef: (resDef: ResourceDefinition, path: string) => Promise<T>,
	transformTypeDef: (typeDef: TypeDefinition, path: string) => Promise<T>,
	registry: SchemaRegistry,
	path: string
): Promise<T> => {
	const uri = namedType.$ref;
	if (is<BuiltInTypeUri>(uri)) return transforms.builtInType(uri, `${path}$builtIn:${uri}`);
	if (is<ResourceUri>(uri)) {
		const resUrn: Urn = uri.replace(/^.*?#\/resources\//, '');
		const resDef = await registry.getResource(resUrn);
		if (resDef !== undefined) return transformResDef(resDef, `${path}$resDef:${resUrn}`);
	}
	if (is<TypeUri>(uri)) {
		const typeUrn: Urn = uri.replace(/^.*?#\/types\//, '');
		const typeDef = await registry.getType(typeUrn);
		if (typeDef !== undefined) return transformTypeDef(typeDef, `${path}$typeDef:${typeUrn}`);
	}
	return transforms.unresolvableUri(uri, `${path}$unresolvable`);
};

export type UnionTypeTransform<T> = (oneOf: T[], path: string) => T;
export type UnionTypeTransforms<T> = Readonly<{ unionType: UnionTypeTransform<T> }>;
export const transformUnionType = async <T>(
	unionType: UnionType,
	transforms: UnionTypeTransforms<T>,
	transfTypeRef: (typeRef: TypeReference, path: string) => Promise<T>,
	path: string
): Promise<T> => {
	const oneOf = unionType.oneOf.map((type: TypeReference, i: number) =>
		transfTypeRef(type, `${path}$oneOf:${i}`)
	);
	return transforms.unionType(await Promise.all(oneOf), `${path}`);
};

export type ArrayTypeTransform<T> = (items: T, path: string) => T;
export type ArrayTypeTransforms<T> = Readonly<{ arrayType: ArrayTypeTransform<T> }>;
export const transformArrayType = async <T>(
	arrayType: ArrayType,
	transforms: ArrayTypeTransforms<T>,
	transfTypeRef: (typeRef: TypeReference, path: string) => Promise<T>,
	path: string
): Promise<T> => {
	const items = await transfTypeRef(arrayType.items, `${path}$items`);
	return transforms.arrayType(items, `${path}`);
};

export type MapTypeTransform<T> = (properties: T, path: string) => T;
export type MapTypeTransformers<T> = Readonly<{ mapType: MapTypeTransform<T> }>;
export const transformMapType = async <T>(
	mapType: MapType,
	transforms: MapTypeTransformers<T>,
	transfTypeRef: (typeRef: TypeReference, path: string) => Promise<T>,
	path: string
): Promise<T> => {
	const propsTypeRef: TypeReference = mapType.additionalProperties || { type: 'string' };
	const props = await transfTypeRef(propsTypeRef, `${path}$additionalProperties`);
	return transforms.mapType(props, `${path}`);
};

export type PrimitiveTypeTransform<T> = (type: PrimitiveType['type'], path: string) => T;
export type TypeReferenceTransforms<T> = UnionTypeTransforms<T> &
	ArrayTypeTransforms<T> &
	MapTypeTransformers<T> &
	Readonly<{ primitive: PrimitiveTypeTransform<T> }>;
export const transformTypeReference = async <T>(
	typeRef: TypeReference,
	transforms: TypeReferenceTransforms<T>,
	transfNamedType: (namedType: NamedType, path: string) => Promise<T>,
	path: string
): Promise<T> => {
	const recursion = (typeRefL: TypeReference, pathL: string): Promise<T> =>
		transformTypeReference(typeRefL, transforms, transfNamedType, pathL);
	if (typeRef.$ref !== undefined) return transfNamedType(typeRef, `${path}$namedType`);
	if (typeRef.oneOf !== undefined)
		return transformUnionType(typeRef, transforms, recursion, `${path}$unionType`);
	switch (typeRef.type) {
		case 'array':
			return transformArrayType(typeRef, transforms, recursion, `${path}$arrayType`);
		case 'object':
			return transformMapType(typeRef, transforms, recursion, `${path}$mapType`);
		default:
			return transforms.primitive(typeRef.type, `${path}$primitive:${typeRef.type}`);
	}
};

export type PropertyDefinitionTransform<T> = (
	typeRef: T,
	defaultT: T | undefined,
	path: string
) => T;
export type ConstTransform<T> = (constant: boolean | number | string, path: string) => T;
export type PropertyDefinitionTransforms<T> = Readonly<{
	propDef: PropertyDefinitionTransform<T>;
	const: ConstTransform<T>;
}>;
export const transformPropertyDefinition = async <T>(
	propDef: PropertyDefinition,
	transforms: PropertyDefinitionTransforms<T>,
	transfTypeRef: (typeRef: TypeReference, path: string) => Promise<T>,
	path: string
): Promise<T> => {
	if (propDef.const !== undefined) return transforms.const(propDef.const, `${path}$const`);
	const defaultT =
		propDef.default === undefined
			? undefined
			: transforms.const(propDef.default, `${path}$default`);
	return transforms.propDef(await transfTypeRef(propDef, path), defaultT, path);
};

export type ObjectTypeDetailsTransform<T> = (
	properties: Readonly<Record<string, T>>,
	required: readonly string[],
	path: string
) => T;
export type ObjectTypeDetailsTransforms<T> = Readonly<{ objType: ObjectTypeDetailsTransform<T> }>;
export const transformObjectTypeDetails = async <T>(
	objType: ObjectTypeDetails,
	transforms: ObjectTypeDetailsTransforms<T>,
	transfPropDef: (propDef: PropertyDefinition, path: string) => Promise<T>,
	path: string
): Promise<T> => {
	const properties = await asyncMapValues(objType.properties || {}, (propDef, prop) =>
		transfPropDef(propDef, `${path}$prop:${prop}`)
	);
	return transforms.objType(properties, objType.required || [], path);
};

export type ResourceDefinitionTransform<T> = (
	inputProperties: Readonly<Record<string, T>>,
	requiredInputs: readonly string[],
	properties: Readonly<Record<string, T>>,
	required: readonly string[],
	path: string
) => T;
export type ResourceDefinitionTransforms<T> = Readonly<{
	resourceDef: ResourceDefinitionTransform<T>;
}>;
export const transformResourceDefinition = async <T>(
	resDef: ResourceDefinition,
	transforms: ResourceDefinitionTransforms<T>,
	transfPropDef: (propDef: PropertyDefinition, path: string) => Promise<T>,
	path: string
): Promise<T> => {
	const inputProperties = await asyncMapValues(resDef.inputProperties || {}, (propDef, prop) =>
		transfPropDef(propDef, `${path}$inputProp:${prop}`)
	);
	const properties = await asyncMapValues(resDef.properties || {}, (propDef, prop) =>
		transfPropDef(propDef, `${path}$prop:${prop}`)
	);
	return transforms.resourceDef(
		inputProperties,
		resDef.requiredInputs || [],
		properties,
		resDef.required || [],
		path
	);
};
