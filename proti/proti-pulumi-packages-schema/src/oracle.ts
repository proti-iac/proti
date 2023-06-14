import {
	type AsyncResourceOracle,
	type JsType,
	type ResourceArgs,
	type TestModuleInitFn,
	type TestResult,
	type Types,
	typeOf,
	type DeepReadonly,
	createAppendOnlyArray,
} from '@proti/core';
import { is } from 'typia';
import { initModule } from './utils';
import { SchemaRegistry } from './schema-registry';
import type {
	ArrayType,
	EnumTypeDefinition,
	MapType,
	NamedType,
	ObjectTypeDetails,
	PrimitiveType,
	TypeReference,
	UnionType,
} from './pulumi-package-metaschema';
import { OracleConfig, config } from './config';

/**
 * Validators are type guards to get support from the type system. For better
 * error messages they should throw on validation errors with a detailed message
 * instead of return false.
 */
type Validator<T = unknown, R extends T = T> = (value: T) => value is R;
type TypeRefToValidator = (
	typeRef: DeepReadonly<TypeReference>,
	registry: SchemaRegistry,
	conf: OracleConfig,
	objectTypeToValidator: ObjTypeToValidator,
	path: string
) => Promise<Validator>;
type PreConfTypeRefToValidator = (
	typeRef: DeepReadonly<TypeReference>,
	path: string
) => ReturnType<TypeRefToValidator>;
type ObjTypeToValidator = (
	objTypeDetails: DeepReadonly<ObjectTypeDetails>,
	registry: SchemaRegistry,
	conf: OracleConfig,
	path: string
) => Promise<Validator<unknown, Readonly<Record<string, unknown>>>>;

type Object = Readonly<Record<string, unknown>>;
type JsTypeObject<T extends Types> = T extends 'object' ? Object : JsType<T>;

const jsTypeValidator =
	<T extends Types>(type: T, path: string): Validator<unknown, JsTypeObject<T>> =>
	(value): value is JsTypeObject<T> => {
		const valueType = typeOf(value);
		if (valueType !== type) throw Error(`${path} is not of type ${type}`);
		return true;
	};

export const enumTypeDefToValidator = (
	enumType: DeepReadonly<EnumTypeDefinition>,
	path: string
): Validator => {
	const values = enumType.enum.map((e) => e.value);
	return (value: any): value is unknown => {
		if (!values.includes(value))
			throw new Error(`${path} value ${value} is not part of enum ${JSON.stringify(values)}`);
		return true;
	};
};

const namedTypeToValidator = async (
	namedType: DeepReadonly<NamedType>,
	registry: SchemaRegistry,
	conf: OracleConfig,
	objectTypeToValidator: ObjTypeToValidator,
	path: string
): Promise<Validator> => {
	const jsonValidator = (value: string): value is string => {
		try {
			JSON.parse(value);
		} catch (e) {
			throw new Error(`${path} is not a parsable JSON string`);
		}
		return true;
	};
	const isString = jsTypeValidator('string', path);
	const any = (value: unknown): value is any => true;

	// Type references have the format `[origin]#[type]`. `[origin]` is
	// `pulumi.json` for built-in Pulumi types. For non built-in types we
	// rely on the schema registry to find a type definition.

	// Built-in Pulumi types
	switch (namedType.$ref) {
		case 'pulumi.json#/Archive':
			return isString;
		case 'pulumi.json#/Asset':
			return isString;
		case 'pulumi.json#/Any':
			return any;
		case 'pulumi.json#/Json':
			return (value: unknown): value is string => isString(value) && jsonValidator(value);
		default:
	}

	const definition = await registry.resolveTypeRef(namedType.$ref);
	if (definition === undefined) {
		const errMsg = `${path} has unknown type reference to ${namedType.$ref}`;
		if (conf.failOnMissingTypeReference) throw new Error(errMsg);
		console.warn(`${errMsg}. Treating it as "pulumi.json#/Any"`);
		return any;
	}
	return is<EnumTypeDefinition>(definition)
		? enumTypeDefToValidator(definition, `${path}$ref#enum:${namedType.$ref}`)
		: objectTypeToValidator(definition, registry, conf, `${path}$ref#obj:${namedType.$ref}`);
};

const unionTypeToValidator = async (
	unionType: DeepReadonly<UnionType>,
	preConfiguredTypeRefToValidator: PreConfTypeRefToValidator,
	path: string
): Promise<Validator> => {
	type ErrValidator = (value: unknown, addError: (e: string) => void) => boolean;
	const typeRefToErrVal = async (oneOfTypeRef: DeepReadonly<TypeReference>, i: number) => {
		const validator = await preConfiguredTypeRefToValidator(oneOfTypeRef, `${path}$oneOf:${i}`);
		return (value: unknown, addError: (e: string) => void): boolean => {
			try {
				const isValid = validator(value);
				if (!isValid) addError(`${path}$oneOf:${i} invalid`);
				return isValid;
			} catch (e: unknown) {
				addError((e as any)?.message);
				return false;
			}
		};
	};
	const validators: ReadonlyArray<ErrValidator> = await Promise.all(
		unionType.oneOf.map(typeRefToErrVal)
	);
	return (value: unknown): value is unknown => {
		const [errors, appendError] = createAppendOnlyArray<string>();
		if (validators.some((validator) => validator(value, appendError))) return true;
		throw new Error(`${path} is not any of the valid type. Errors: ${errors.join('. ')}`);
	};
};

const arrayTypeToValidator = async (
	arrayType: DeepReadonly<ArrayType>,
	preConfiguredTypeRefToValidator: PreConfTypeRefToValidator,
	path: string
): Promise<Validator<unknown, readonly unknown[]>> => {
	const isArray = jsTypeValidator('array', path);
	const itemValidator = await preConfiguredTypeRefToValidator(arrayType.items, `${path}$items`);
	const allItemValid = (value: readonly unknown[]): value is readonly unknown[] =>
		value.every(itemValidator);
	return (value: unknown): value is readonly unknown[] => isArray(value) && allItemValid(value);
};

const mapTypeToValidator = async (
	arrayType: DeepReadonly<MapType>,
	preConfiguredTypeRefToValidator: PreConfTypeRefToValidator,
	path: string
): Promise<Validator> => {
	const isObject = jsTypeValidator('object', path);
	const propValidators =
		arrayType.additionalProperties === undefined
			? jsTypeValidator('string', `${path}$additionalProperties`)
			: await preConfiguredTypeRefToValidator(
					arrayType.additionalProperties,
					`${path}$additionalProperties`
			  );
	const allpropsValid = (value: Object): value is Object =>
		Object.values(value).every(propValidators);
	return (value: unknown): value is Object => isObject(value) && allpropsValid(value);
};

const primitiveTypeToValidator = (
	primitiveType: DeepReadonly<PrimitiveType>,
	path: string
): Validator => {
	switch (primitiveType.type) {
		case 'boolean':
			return jsTypeValidator('boolean', path);
		case 'integer':
			return (value: unknown): value is number | bigint => {
				if (!Number.isInteger(value)) throw new Error(`${path} is not an integer`);
				return true;
			};
		case 'number':
			return (value: unknown): value is number | bigint => {
				if (typeof value !== 'number' && typeof value !== 'bigint')
					throw new Error(`${path} is not a number`);
				return true;
			};
		case 'string':
			return jsTypeValidator('string', path);
		default:
			throw new Error(`${path} has not implemented primitive type "${primitiveType.type}"`);
	}
};

export const typeRefToValidator: TypeRefToValidator = (typeRef, registry, conf, objTypTV, path) => {
	const preConfiguredTypeRefToValidator: PreConfTypeRefToValidator = (typeRefL, pathL) =>
		typeRefToValidator(typeRefL, registry, conf, objTypTV, pathL);
	if (typeRef.$ref !== undefined)
		return namedTypeToValidator(typeRef, registry, conf, objTypTV, path);
	if (typeRef.oneOf !== undefined)
		return unionTypeToValidator(typeRef, preConfiguredTypeRefToValidator, path);
	switch (typeRef.type) {
		case 'array':
			return arrayTypeToValidator(typeRef, preConfiguredTypeRefToValidator, path);
		case 'object':
			return mapTypeToValidator(typeRef, preConfiguredTypeRefToValidator, path);
		default:
			return Promise.resolve(primitiveTypeToValidator(typeRef, path));
	}
};

export const objTypeToValidator: ObjTypeToValidator = async (
	objTypeDetails,
	registry,
	conf,
	path
) => {
	const isObject = jsTypeValidator('object', path);
	const hasRequiredProps = (value: Object): value is Object =>
		(objTypeDetails.required || []).every((property: string) => {
			if (value[property] === undefined)
				throw new Error(`${path} misses required object property ${property}`);
			return true;
		});
	const asyncPropValidators = Object.entries(objTypeDetails.properties || {}).map(
		async ([property, propDef]): Promise<[string, Validator]> => {
			const pathL = `${path}$prop:${property}`;
			return [
				property,
				await typeRefToValidator(propDef, registry, conf, objTypeToValidator, pathL),
			];
		}
	);
	const propValidators = new Map(await Promise.all(asyncPropValidators));
	const allPropsValid = (
		value: Readonly<Record<string, unknown>>
	): value is Readonly<Record<string, unknown>> =>
		Object.keys(value).every((property) => {
			const validator = propValidators.get(property);
			if (validator === undefined)
				throw new Error(`${path} has unknown property ${property}`);
			return validator(value[property]);
		});
	return (value): value is ObjectTypeDetails =>
		isObject(value) && hasRequiredProps(value) && allPropsValid(value);
};

export class PulumiPackagesSchemaOracle implements AsyncResourceOracle {
	name = 'Pulumi Packages Schema Types';

	description =
		'Checks that each resource configuration satisfies the type defined in the Pulumi package schema.';

	private readonly registry: SchemaRegistry = SchemaRegistry.getInstance();

	constructor(private readonly conf: OracleConfig = config().oracle) {}

	private async generateValidator(resourceType: string): Promise<Validator> {
		let resDef = await this.registry.getResource(resourceType);
		if (resDef === undefined) {
			const errMsg = `Failed to find resource definition of ${resourceType}`;
			if (this.conf.failOnMissingResourceDefinition) throw new Error(errMsg);
			console.warn(`${errMsg}. Using default resource definition`);
			resDef = this.conf.defaultResourceDefinition;
			if (resDef === undefined) return (value: unknown): value is unknown => true;
		}
		const objType = {
			properties: resDef.inputProperties,
			required: resDef.requiredInputs,
		};
		return objTypeToValidator(objType, this.registry, this.conf, resourceType);
	}

	public async asyncValidateResource(resource: ResourceArgs): Promise<TestResult> {
		try {
			const validator = await this.generateValidator(resource.type).catch((cause) => {
				throw new Error('Failed to generate resource validator', { cause });
			});
			if (!validator(resource.inputs)) throw new Error('Invalid resource configuration');
			return undefined;
		} catch (e) {
			return is<Error>(e) ? e : new Error('Failed to validate resource config', { cause: e });
		}
	}
}

export default PulumiPackagesSchemaOracle;

export const init: TestModuleInitFn = initModule;
