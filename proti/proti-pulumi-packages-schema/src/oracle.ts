import {
	type AsyncResourceOracle,
	type JsType,
	type ResourceArgs,
	type TestModuleInitFn,
	type TestResult,
	type Types,
	typeOf,
	type DeepReadonly,
	createReadonlyAppendArray,
} from '@proti/core';
import { is } from 'typia';
import { initModule } from './utils';
import { SchemaRegistry } from './schema-registry';
import type {
	ArrayType,
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
type Validator<T, R extends T> = (value: T) => value is R;
type TypeRefToValidator = (
	typeRef: DeepReadonly<TypeReference>,
	path: string
) => Validator<unknown, unknown>;

type Object = Readonly<Record<string, unknown>>;
type JsTypeObject<T extends Types> = T extends 'object' ? Object : JsType<T>;

const jsTypeValidator =
	<T extends Types>(type: T, path: string): Validator<unknown, JsTypeObject<T>> =>
	(value): value is JsTypeObject<T> => {
		const valueType = typeOf(value);
		if (valueType !== type) throw Error(`${path} is not of type ${type}`);
		return true;
	};

const namedTypeToValidator = (
	namedType: DeepReadonly<NamedType>,
	path: string
): Validator<unknown, unknown> => {
	throw new Error(`${path} has not implemented named type ${namedType.$ref}`);
};

const unionTypeToValidator = (
	unionType: DeepReadonly<UnionType>,
	typeReferenceToValidator: TypeRefToValidator,
	path: string
): Validator<unknown, unknown> => {
	const validators: ((value: unknown, addError: (e: string) => void) => boolean)[] =
		unionType.oneOf.map((oneOfTypeRef: DeepReadonly<TypeReference>, i: number) => {
			const validator = typeReferenceToValidator(oneOfTypeRef, `${path}$oneOf:${i}`);
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
		});
	return (value: unknown): value is unknown => {
		const [errors, appendError] = createReadonlyAppendArray<string>();
		if (validators.some((validator) => validator(value, appendError))) return true;
		throw new Error(`${path} is not any of the valid type. Errors: ${errors.join('. ')}`);
	};
};

const arrayTypeToValidator = (
	arrayType: DeepReadonly<ArrayType>,
	typeReferenceToValidator: TypeRefToValidator,
	path: string
): Validator<unknown, readonly unknown[]> => {
	const isArray = jsTypeValidator('array', path);
	const itemValidator = typeReferenceToValidator(arrayType.items, `${path}$items`);
	const allItemValid = (value: readonly unknown[]): value is readonly unknown[] =>
		value.every(itemValidator);
	return (value: unknown): value is readonly unknown[] => isArray(value) && allItemValid(value);
};

const mapTypeToValidator = (
	arrayType: DeepReadonly<MapType>,
	typeReferenceToValidator: TypeRefToValidator,
	path: string
): Validator<unknown, unknown> => {
	const isObject = jsTypeValidator('object', path);
	const propsValidator =
		arrayType.additionalProperties === undefined
			? jsTypeValidator('string', `${path}$additionalProperties`)
			: typeReferenceToValidator(
					arrayType.additionalProperties,
					`${path}$additionalProperties`
			  );
	const allpropsValid = (value: Object): value is Object =>
		Object.values(value).every(propsValidator);
	return (value: unknown): value is Object => isObject(value) && allpropsValid(value);
};

const primitiveTypeToValidator = (
	primitiveType: DeepReadonly<PrimitiveType>,
	path: string
): Validator<unknown, unknown> => {
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

export const typeRefToValidator: TypeRefToValidator = (typeRef, path) => {
	if (typeRef.$ref !== undefined) return namedTypeToValidator(typeRef, path);
	if (typeRef.oneOf !== undefined) return unionTypeToValidator(typeRef, typeRefToValidator, path);
	switch (typeRef.type) {
		case 'array':
			return arrayTypeToValidator(typeRef, typeRefToValidator, path);
		case 'object':
			return mapTypeToValidator(typeRef, typeRefToValidator, path);
		default:
			return primitiveTypeToValidator(typeRef, path);
	}
};

export const objectTypeToValidator = (
	objTypeDetails: DeepReadonly<ObjectTypeDetails>,
	path: string
): Validator<unknown, Readonly<Record<string, unknown>>> => {
	const isObject = jsTypeValidator('object', path);
	const hasRequiredProps = (value: Object): value is Object =>
		(objTypeDetails.required || []).every((property: string) => {
			if (value[property] === undefined)
				throw new Error(`${path} misses required object property ${property}`);
			return true;
		});
	const propValidators: ReadonlyMap<string, Validator<unknown, unknown>> = new Map(
		Object.entries(objTypeDetails.properties || {}).map(([property, propDef]) => [
			property,
			typeRefToValidator(propDef, `${path}$prop:${property}`),
		])
	);
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

	asyncValidateResource = async (resource: ResourceArgs): Promise<TestResult> => {
		const resDef = await this.registry.getResource(resource.type);
		if (resDef === undefined) {
			const errMsg = `Failed to find resource definition of ${resource.type}`;
			if (this.conf.failOnMissingResourceDefinition) return new Error(errMsg);
			console.warn(`${errMsg}. Returning default resource state`);
			return undefined;
		}
		try {
			const objTypeDetails = {
				properties: resDef.inputProperties,
				required: resDef.requiredInputs,
			};
			objectTypeToValidator(objTypeDetails, resource.urn)(resource.inputs);
			return undefined;
		} catch (e) {
			const errMsg = `Resource configuration invalid: ${resource.urn}`;
			return is<Error>(e) ? e : new Error(errMsg, { cause: e });
		}
	};
}

export default PulumiPackagesSchemaOracle;

export const init: TestModuleInitFn = initModule;
