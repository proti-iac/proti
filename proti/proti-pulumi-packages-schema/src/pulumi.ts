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
export type Origin = string;

/** Pulumi unified resource name. May be URL encoded. */
export type EncodedUrn = Token;
/** URI that may be URL encoded. */
export type EncodedUri = string;

/** Pulumi unified resource name. */
export type Urn = Token;
/** Decoded URI. */
export type Uri = string;
export type ResourceUri = `${Origin}#/resources/${Urn}`;
export type TypeUri = `${Origin}#/types/${Urn}`;

/**
 * Decoded full URI of built-in type (e.g., `pulumi.json#/Any`) or URI without
 * origin, i.e., without everything before the first `#` character, if a `#`
 * character is included (e.g., `#/resources/abc` or `abc`).
 */
export type NormalizedUri = BuiltInTypeUri | Uri;
export type NormalizedResourceUri = `#/resources/${Urn}`;
export type NormalizedTypeUri = `#/types/${Urn}`;

export const builtInTypeUris: readonly BuiltInTypeUri[] = [
	'pulumi.json#/Archive',
	'pulumi.json#/Asset',
	'pulumi.json#/Any',
	'pulumi.json#/Json',
];

export const decodeUri = (uri: EncodedUri): Uri => {
	try {
		return decodeURIComponent(uri);
	} catch (e) {
		return uri;
	}
};
export const normalizeUri = (uri: Uri): NormalizedUri =>
	(builtInTypeUris as readonly string[]).includes(uri)
		? uri
		: uri.slice(Math.max(0, uri.indexOf('#')));

type TransformDef<D> = <T>(
	resDef: D,
	transforms: Transforms<T>,
	ntArgs: NamedTypeArgs<T>,
	path: string
) => Promise<T>;
let transfResDef: TransformDef<ResourceDefinition>;
let transfTypeDef: TransformDef<TypeDefinition>;
let transfTypeRef: TransformDef<TypeReference>;

export type BuiltInTypeTransform<T> = (type: BuiltInTypeUri, path: string) => Promise<T>;
export type UnresolvableUriTransform<T> = (type: NormalizedUri, path: string) => Promise<T>;
export type CycleBreakerTransform<T> = (circle: Promise<T>) => T;
export type NamedTypeArgs<T> = Readonly<{
	registry: SchemaRegistry;
	/**
	 * Must be enabled to transform cyclic schemas. Otherwise tranforming a
	 * cyclic schema results in an endless recursion.
	 */
	caching: boolean;
	cache: ReadonlyMap<NormalizedUri, Promise<T>>;
	appendCache: (normalizedUri: NormalizedUri, t: Promise<T>) => void;
	/**
	 * Tracking URIs of parent elements is necessary to prevent potential
	 * deadlocks during transformations of cyclic schemas. We avoid deadlocks by
	 * inserting a 'cycle breaker' for cache lookups of parent URIs (i.e.,
	 * recursive lookups).
	 */
	parentUris: readonly NormalizedUri[];
}>;
export const transformNamedType = async <T>(
	namedType: NamedType,
	transforms: Transforms<T>,
	args: NamedTypeArgs<T>,
	path: string
): Promise<T> => {
	const normUri = normalizeUri(decodeUri(namedType.$ref));
	const generateT = async (): Promise<T> => {
		if (is<BuiltInTypeUri>(normUri))
			return transforms.builtInType(normUri, `${path}$builtIn:${normUri}`);
		const newParents = [...args.parentUris, normUri];
		if (is<NormalizedResourceUri>(normUri)) {
			const resUrn: Urn = normUri.replace(/^#\/resources\//, '');
			const resDef = await args.registry.getResource(resUrn);
			const p = `${path}$resDef:${resUrn}`;
			if (resDef !== undefined)
				return transfResDef(resDef, transforms, { ...args, parentUris: newParents }, p);
		}
		if (is<NormalizedTypeUri>(normUri)) {
			const typeUrn: Urn = normUri.replace(/^#\/types\//, '');
			const typeDef = await args.registry.getType(typeUrn);
			const p = `${path}$typeDef:${typeUrn}`;
			if (typeDef !== undefined)
				return transfTypeDef(typeDef, transforms, { ...args, parentUris: newParents }, p);
		}
		return transforms.unresolvableUri(normUri, `${path}$unresolvable`);
	};

	if (args.caching) {
		const cachedT = args.cache.get(normUri);
		if (cachedT !== undefined) {
			if (args.parentUris.includes(normUri)) return transforms.cycleBreaker(cachedT);
			return cachedT;
		}
	}
	const newT = generateT();
	if (args.caching) args.appendCache(normUri, newT);
	return newT;
};

export type UnionTypeTransform<T> = (oneOf: readonly T[], path: string) => Promise<T>;
export const transformUnionType: TransformDef<UnionType> = async <T>(
	unionType: UnionType,
	transforms: Transforms<T>,
	ntArgs: NamedTypeArgs<T>,
	path: string
): Promise<T> => {
	const oneOf = unionType.oneOf.map((type: TypeReference, i: number) =>
		transfTypeRef(type, transforms, ntArgs, `${path}$oneOf:${i}`)
	);
	return transforms.unionType(await Promise.all(oneOf), `${path}`);
};

export type ArrayTypeTransform<T> = (items: T, path: string) => Promise<T>;
export const transformArrayType: TransformDef<ArrayType> = async <T>(
	arrayType: ArrayType,
	transforms: Transforms<T>,
	ntArgs: NamedTypeArgs<T>,
	path: string
): Promise<T> => {
	const items = await transfTypeRef(arrayType.items, transforms, ntArgs, `${path}$items`);
	return transforms.arrayType(items, `${path}`);
};

export type MapTypeTransform<T> = (properties: T, path: string) => Promise<T>;
export const transformMapType: TransformDef<MapType> = async <T>(
	mapType: MapType,
	transforms: Transforms<T>,
	ntArgs: NamedTypeArgs<T>,
	path: string
): Promise<T> => {
	const propsTypeRef: TypeReference = mapType.additionalProperties || { type: 'string' };
	const p = `${path}$additionalProperties`;
	const props = await transfTypeRef(propsTypeRef, transforms, ntArgs, p);
	return transforms.mapType(props, `${path}`);
};

export type PrimitiveTypeTransform<T> = (type: PrimitiveType['type'], path: string) => Promise<T>;
transfTypeRef = async <T>(
	typeRef: TypeReference,
	transforms: Transforms<T>,
	ntArgs: NamedTypeArgs<T>,
	path: string
): Promise<T> => {
	if (typeRef.$ref !== undefined)
		return transformNamedType(typeRef, transforms, ntArgs, `${path}$namedType`);
	if (typeRef.oneOf !== undefined)
		return transformUnionType(typeRef, transforms, ntArgs, `${path}$unionType`);
	switch (typeRef.type) {
		case 'array':
			return transformArrayType(typeRef, transforms, ntArgs, `${path}$arrayType`);
		case 'object':
			return transformMapType(typeRef, transforms, ntArgs, `${path}$mapType`);
		default:
			return transforms.primitive(typeRef.type, `${path}$primitive:${typeRef.type}`);
	}
};
export const transformTypeReference = transfTypeRef;

export type PropertyDefinitionTransform<T> = (
	typeRef: T,
	defaultT: T | undefined,
	path: string
) => Promise<T>;
export type ConstTransform<T> = (constant: boolean | number | string, path: string) => Promise<T>;
export type SecretTransform<T> = (propDef: T, path: string) => Promise<T>;
export const transformPropertyDefinition: TransformDef<PropertyDefinition> = async <T>(
	propDef: PropertyDefinition,
	transforms: Transforms<T>,
	ntArgs: NamedTypeArgs<T>,
	path: string
): Promise<T> => {
	if (propDef.secret === true) {
		const unsec = { ...propDef, secret: false };
		const unsecretPropDef = await transformPropertyDefinition(unsec, transforms, ntArgs, path);
		return transforms.secret(unsecretPropDef, `${path}$secret`);
	}
	if (propDef.const !== undefined) return transforms.const(propDef.const, `${path}$const`);
	const defaultT =
		propDef.default === undefined
			? undefined
			: await transforms.const(propDef.default, `${path}$default`);
	const typeRef = await transformTypeReference(propDef, transforms, ntArgs, path);
	return transforms.propDef(typeRef, defaultT, path);
};

export type ObjectTypeDetailsTransform<T> = (
	properties: Readonly<Record<string, T>>,
	required: readonly string[],
	path: string
) => Promise<T>;
export const transformObjectTypeDetails: TransformDef<ObjectTypeDetails> = async <T>(
	objType: ObjectTypeDetails,
	transforms: Transforms<T>,
	ntArgs: NamedTypeArgs<T>,
	path: string
): Promise<T> => {
	const properties = await asyncMapValues(objType.properties || {}, (propDef, prop) =>
		transformPropertyDefinition(propDef, transforms, ntArgs, `${path}$prop:${prop}`)
	);
	return transforms.objType(properties, objType.required || [], path);
};

export type EnumTypeDefinitionTransform<T> = (
	values: EnumValueDefinition['value'][],
	path: string
) => Promise<T>;
transfTypeDef = async <T>(
	typeDef: TypeDefinition,
	transforms: Transforms<T>,
	ntArgs: NamedTypeArgs<T>,
	path: string
): Promise<T> => {
	if (is<EnumTypeDefinition>(typeDef)) {
		const values = typeDef.enum.map(({ value }) => value);
		return transforms.enumType(values, `${path}$enum`);
	}
	return transformObjectTypeDetails(typeDef, transforms, ntArgs, `${path}$object`);
};
export const transformTypeDefinition = transfTypeDef;
export const setTransfTypeDefMock = (mock: any = transformTypeDefinition) => {
	transfTypeDef = mock;
};

export type ResourceDefinitionTransform<T> = (
	inputProperties: Readonly<Record<string, T>>,
	requiredInputs: readonly string[],
	properties: Readonly<Record<string, T>>,
	required: readonly string[],
	path: string
) => Promise<T>;
transfResDef = async <T>(
	resDef: ResourceDefinition,
	transforms: Transforms<T>,
	ntArgs: NamedTypeArgs<T>,
	path: string
): Promise<T> => {
	const inputProperties = await asyncMapValues(resDef.inputProperties || {}, (propDef, prop) =>
		transformPropertyDefinition(propDef, transforms, ntArgs, `${path}$inputProp:${prop}`)
	);
	const properties = await asyncMapValues(resDef.properties || {}, (propDef, prop) =>
		transformPropertyDefinition(propDef, transforms, ntArgs, `${path}$prop:${prop}`)
	);
	return transforms.resourceDef(
		inputProperties,
		resDef.requiredInputs || [],
		properties,
		resDef.required || [],
		path
	);
};
export const transformResourceDefinition = transfResDef;
export const setTransfResDefMock = (mock: any = transformResourceDefinition) => {
	transfResDef = mock;
};

export type MutableTransforms<T> = {
	builtInType: BuiltInTypeTransform<T>;
	unresolvableUri: UnresolvableUriTransform<T>;
	cycleBreaker: CycleBreakerTransform<T>;
	arrayType: ArrayTypeTransform<T>;
	mapType: MapTypeTransform<T>;
	primitive: PrimitiveTypeTransform<T>;
	unionType: UnionTypeTransform<T>;
	resourceDef: ResourceDefinitionTransform<T>;
	propDef: PropertyDefinitionTransform<T>;
	const: ConstTransform<T>;
	secret: SecretTransform<T>;
	objType: ObjectTypeDetailsTransform<T>;
	enumType: EnumTypeDefinitionTransform<T>;
};
export type Transforms<T> = Readonly<MutableTransforms<T>>;
