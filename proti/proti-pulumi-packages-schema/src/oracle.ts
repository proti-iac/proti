import {
	type AsyncResourceOracle,
	type JsType,
	type ResourceArgs,
	type TestModuleInitFn,
	type TestResult,
	type Types,
	typeOf,
	createAppendOnlyArray,
	createAppendOnlyMap,
} from '@proti/core';
import { asset } from '@pulumi/pulumi';
import { is, stringify } from 'typia';
import { initModule } from './utils';
import { SchemaRegistry } from './schema-registry';
import { OracleConfig, config } from './config';
import {
	type ArrayTypeTransform,
	type BuiltInTypeTransform,
	type ConstTransform,
	type CycleBreakerTransform,
	type EnumTypeDefinitionTransform,
	type MapTypeTransform,
	type MutableTransforms,
	type NamedTypeArgs,
	type NormalizedUri,
	type ObjectTypeDetails,
	type ObjectTypeDetailsTransform,
	type PrimitiveTypeTransform,
	type PropertyDefinitionTransform,
	type ResourceDefinition,
	type ResourceDefinitionTransform,
	type SecretTransform,
	type Transforms,
	type UnionTypeTransform,
	type UnresolvableUriTransform,
	transformResourceDefinition,
	transformTypeDefinition,
} from './pulumi';

/**
 * Validators are type guards to get support from the type system. For better
 * error messages they should throw on validation errors with a detailed message
 * instead of return false.
 */
export type Validator<T = unknown, R extends T = T> = (value: T) => value is R;
/**
 * Caching validators under their normalized Pulumi type reference URI,
 */
export type ValidatorCache = ReadonlyMap<NormalizedUri, Promise<Validator>>;

type Object = Readonly<Record<string, unknown>>;
type JsTypeObject<T extends Types> = T extends 'object' ? Object : JsType<T>;

export const anyValidator = (value: unknown): value is unknown => true;

const jsTypeValidator =
	<T extends Types>(type: T, path: string): Validator<unknown, JsTypeObject<T>> =>
	(value): value is JsTypeObject<T> => {
		const valueType = typeOf(value);
		if (valueType !== type)
			throw Error(`${path} is not of type '${type}' but '${valueType}': ${stringify(value)}`);
		return true;
	};

const jsonValidator =
	(path: string) =>
	(value: string): value is string => {
		try {
			JSON.parse(value);
		} catch (e) {
			throw new Error(`${path} is not a parsable JSON string: ${stringify(value)}`);
		}
		return true;
	};

export const builtInTypeValidator: BuiltInTypeTransform<Validator> = async (type, path) => {
	if (type === 'pulumi.json#/Archive')
		return (value: unknown): value is asset.Archive => {
			if (
				asset.Archive.isInstance(value) &&
				Object.keys(value).some((key) => ['assets', 'path', 'uri'].includes(key))
			)
				return true;
			throw new Error(`${path} is not a Pulumi Archive: ${stringify(value)}`);
		};
	if (type === 'pulumi.json#/Asset')
		return (value: unknown): value is asset.Asset => {
			if (
				asset.Asset.isInstance(value) &&
				Object.keys(value).some((key) => ['path', 'text', 'uri'].includes(key))
			)
				return true;
			throw new Error(`${path} is not a Pulumi Asset: ${stringify(value)}`);
		};
	if (type === 'pulumi.json#/Any') return anyValidator;
	if (type === 'pulumi.json#/Json')
		return (value: unknown): value is string =>
			jsTypeValidator('string', path)(value) && jsonValidator(path)(value);
	throw new Error(`${path} has unknown built-in type ${type}`);
};

export const unresolvableUriValidator =
	(
		conf: OracleConfig,
		transforms: Transforms<Validator>,
		ntArgs: NamedTypeArgs<Validator>
	): UnresolvableUriTransform<Validator> =>
	async (uri, path) => {
		const errMsg = `${path} has unknown type reference to ${uri}`;
		if (conf.failOnMissingTypeReference) throw new Error(errMsg);
		console.warn(`${errMsg}. Using default type reference definition"`);
		const definition = conf.defaultTypeReferenceDefinition;
		if (definition === undefined) return anyValidator;
		if (is<ResourceDefinition>(definition))
			return transformResourceDefinition(definition, transforms, ntArgs, path);
		return transformTypeDefinition(definition, transforms, ntArgs, path);
	};

export const cycleBreakerValidator: CycleBreakerTransform<Validator> = (asyncVal) => {
	let validator: Validator | undefined;
	asyncVal.then((val) => {
		validator = val;
	});
	return (value: unknown): value is unknown => {
		if (!validator) throw new Error('Cycle breaker validator not initialized yet');
		return validator(value);
	};
};

export const arrayTypeValidator: ArrayTypeTransform<Validator> = async (itemsValidator, path) => {
	const isArray = jsTypeValidator('array', path);
	const hasSequentialIntKeys = (v: any): v is object =>
		typeof v === 'object' && Object.keys(v).every((key, index) => Number(key) === index);
	return (value: unknown): value is readonly unknown[] => {
		// Workaround because Pulumi provides input state arrays like [a, b]
		// often (always?) as {0: a, 1: b}
		const val: unknown =
			!Array.isArray(value) && hasSequentialIntKeys(value) ? Object.values(value) : value;
		return isArray(val) && val.every(itemsValidator);
	};
};

export const mapTypeValidator: MapTypeTransform<Validator> = async (propertiesValidator, path) => {
	const isObject = jsTypeValidator('object', path);
	return (value: unknown): value is Object =>
		isObject(value) && Object.values(value).every(propertiesValidator);
};

export const primitiveTypeValidator: PrimitiveTypeTransform<Validator> = async (type, path) => {
	if (type === 'boolean') return jsTypeValidator('boolean', path);
	if (type === 'integer')
		return (value: unknown): value is number | bigint => {
			if (!Number.isInteger(value)) throw new Error(`${path} is not an integer`);
			return true;
		};
	if (type === 'number')
		return (value: unknown): value is number | bigint => {
			if (typeof value !== 'number' && typeof value !== 'bigint')
				throw new Error(`${path} is not a number`);
			return true;
		};
	if (type === 'string') return jsTypeValidator('string', path);
	throw new Error(`${path} has unknown primitive type ${type}`);
};

export const unionTypeValidator: UnionTypeTransform<Validator> = async (oneOfValidators, path) => {
	const test = (
		value: unknown,
		validator: (value: unknown) => boolean,
		addError: (errMsg: string) => void,
		i: number
	): boolean => {
		try {
			const isValid = validator(value);
			if (!isValid) addError(`${path}$oneOf:${i} invalid`);
			return isValid;
		} catch (e: unknown) {
			addError((e as any)?.message);
			return false;
		}
	};
	return (value: unknown): value is unknown => {
		const [errors, appendError] = createAppendOnlyArray<string>();
		if (oneOfValidators.some((validator, i) => test(value, validator, appendError, i)))
			return true;
		throw new Error(`${path} is not any of the valid types. Errors: ${errors.join('. ')}`);
	};
};

export const propertyDefinitionValidator: PropertyDefinitionTransform<Validator> = async (
	typeRefValidator
) => typeRefValidator;

export const constValidator: ConstTransform<Validator> =
	async (constant, path) =>
	(value: unknown): value is unknown => {
		if (value === constant || (Number.isNaN(value) && Number.isNaN(constant))) return true;
		throw new Error(`${path} is not ${JSON.stringify(constant)}`);
	};

export const secretValidator: SecretTransform<Validator> =
	async (propDefValidator, path) =>
	(value: unknown): value is unknown => {
		/**
		 * Pulumi secrets are outputs with a flag. In the resource monitor they look like:
		 * {"4dabf18193072939515e22adb298388d": "1b47061264138c4ac30d75fd1eb44270",
		 * "value": VALUE }
		 */
		if (
			typeof value === 'object' &&
			(value as any)['4dabf18193072939515e22adb298388d'] ===
				'1b47061264138c4ac30d75fd1eb44270' &&
			propDefValidator((value as any).value)
		)
			return true;
		throw new Error(`${path} is not a secret: ${stringify(value)}`);
	};

export const objectTypeDetailsValidator: ObjectTypeDetailsTransform<Validator> = async (
	propertyValidators,
	required,
	path
) => {
	const isObjectValidator = jsTypeValidator('object', path);
	const hasPropsValidator = (value: Object): value is Object =>
		required.every((property: string) => {
			if (value[property] === undefined)
				throw new Error(`${path} misses required property ${property}`);
			return true;
		});
	const properties = Object.keys(propertyValidators);
	const allPropsValid = (
		value: Readonly<Record<string, unknown>>
	): value is Readonly<Record<string, unknown>> =>
		Object.keys(value).every((property) => {
			if (!properties.includes(property))
				throw new Error(`${path} has unknown property ${property}`);
			const validator = propertyValidators[property];
			return validator(value[property]);
		});
	return (value: unknown): value is ObjectTypeDetails =>
		isObjectValidator(value) && hasPropsValidator(value) && allPropsValid(value);
};

export const resourceDefinitionValidator: ResourceDefinitionTransform<Validator> = (
	inputPropertyValidators,
	requiredInputs,
	propertyValidators,
	required,
	path
) => objectTypeDetailsValidator(inputPropertyValidators, requiredInputs, path);

export const enumTypeDefinitionValidator: EnumTypeDefinitionTransform<Validator> =
	async (values, path) =>
	(value: any): value is unknown => {
		if (!values.includes(value))
			throw new Error(`${path} value ${value} is not in enum ${JSON.stringify(values)}`);
		return true;
	};

export class PulumiPackagesSchemaOracle implements AsyncResourceOracle<undefined> {
	name = 'Pulumi Packages Schema Types';

	description =
		'Checks that each resource configuration satisfies the type defined in the Pulumi package schema.';

	private readonly registry: SchemaRegistry = SchemaRegistry.getInstance();

	/**
	 * Caching validators under their Pulumi type reference, assuming definition
	 * in the same document. E.g., the validator of a resource type is cached as
	 * `#/resources/[resource type token]`. Also includes type references with
	 * other formats as they are but strips everything before the first #
	 * character, if a # character is included.
	 */
	private readonly validatorCache: ValidatorCache;

	/**
	 * Add entry to validator cache.
	 * @param type Pulumi type reference, assuming definition in the same
	 * document. E.g., the validator of a resource type is cached as
	 * `#/resources/[resource type token]`.
	 * @param validator Promise resolving with the validator to cache.
	 * @throws If cache already contains a validator for the type.
	 */
	private readonly appendValidatorCache: (type: string, validator: Promise<Validator>) => void;

	constructor(private readonly conf: OracleConfig = config().oracle) {
		[this.validatorCache, this.appendValidatorCache] = createAppendOnlyMap();
	}

	// eslint-disable-next-line class-methods-use-this
	newRunState = () => undefined;

	private async generateValidator(resourceType: string): Promise<Validator> {
		let resDef = await this.registry.getResource(resourceType);
		if (resDef === undefined) {
			const errMsg = `Failed to find resource definition of ${resourceType}`;
			if (this.conf.failOnMissingResourceDefinition) throw new Error(errMsg);
			console.warn(`${errMsg}. Using default resource definition`);
			resDef = this.conf.defaultResourceDefinition;
			if (resDef === undefined) return anyValidator;
		}
		const ntArgs: NamedTypeArgs<Validator> = {
			caching: this.conf.cacheValidators,
			cache: this.validatorCache,
			appendCache: this.appendValidatorCache,
			parentUris: [`#/resources/${resourceType}`],
			registry: this.registry,
		};
		const mutTransforms: Partial<MutableTransforms<Validator>> = {
			builtInType: builtInTypeValidator,
			cycleBreaker: cycleBreakerValidator,
			arrayType: arrayTypeValidator,
			mapType: mapTypeValidator,
			primitive: primitiveTypeValidator,
			unionType: unionTypeValidator,
			resourceDef: resourceDefinitionValidator,
			propDef: propertyDefinitionValidator,
			const: constValidator,
			secret: secretValidator,
			objType: objectTypeDetailsValidator,
			enumType: enumTypeDefinitionValidator,
		};
		const transforms = mutTransforms as Transforms<Validator>;
		mutTransforms.unresolvableUri = unresolvableUriValidator(this.conf, transforms, ntArgs);
		return transformResourceDefinition(resDef, transforms, ntArgs, resourceType);
	}

	private async getValidator(resourceType: string): Promise<Validator> {
		const cachedValidator = this.validatorCache.get(`#/resources/${resourceType}`);
		if (cachedValidator) return cachedValidator;
		const newValidator = this.generateValidator(resourceType).catch((cause) => {
			throw new Error('Failed to generate resource validator', { cause });
		});
		if (this.conf.cacheValidators)
			this.appendValidatorCache(`#/resources/${resourceType}`, newValidator);
		return newValidator;
	}

	public async asyncValidateResource(resource: ResourceArgs): Promise<TestResult> {
		try {
			const validator = await this.getValidator(resource.type);
			if (!validator(resource.inputs)) throw new Error('Invalid resource configuration');
			return undefined;
		} catch (e) {
			return is<Error>(e) ? e : new Error('Failed to validate resource config', { cause: e });
		}
	}
}

export default PulumiPackagesSchemaOracle;

export const init: TestModuleInitFn = initModule;
