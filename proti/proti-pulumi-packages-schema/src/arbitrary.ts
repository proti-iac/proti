import * as fc from 'fast-check';
import {
	createAppendOnlyArray,
	type DeepReadonly,
	Generator,
	type ResourceArgs,
	type ResourceOutput,
	type TestModuleInitFn,
} from '@proti/core';
import { is, stringify } from 'typia';
import { initModule } from './utils';
import { SchemaRegistry } from './schema-registry';
import { type ArbitraryConfig, config } from './config';
import type {
	EnumTypeDefinition,
	NamedType,
	ObjectTypeDetails,
	PropertyDefinition,
	TypeReference,
	UnionType,
} from './pulumi-package-metaschema';

type ObjectTypeToArb = (
	definition: DeepReadonly<ObjectTypeDetails>,
	registry: SchemaRegistry,
	conf: ArbitraryConfig,
	errContext: string
) => Promise<fc.Arbitrary<Readonly<Record<string, unknown>>>>;

type TypeRefToArb = (
	typeRefDef: DeepReadonly<TypeReference>,
	registry: SchemaRegistry,
	conf: ArbitraryConfig,
	objTypeArb: ObjectTypeToArb,
	path: string
) => Promise<fc.Arbitrary<unknown>>;

export const resourceOutputTraceToString = (trace: ReadonlyArray<ResourceOutput>): string => {
	const numLength = trace.length.toString().length;
	return trace
		.flatMap(({ id, state }, i) => [
			`${i.toString().padStart(numLength)}: ${id}`,
			...Object.entries(state).map(
				([k, v]: [string, unknown]) => `${' '.repeat(numLength + 2)}- ${k}: ${stringify(v)}`
			),
		])
		.join('\n');
};

export const enumTypeDefToArb = (
	definition: DeepReadonly<EnumTypeDefinition>,
	path: string = '*unspecified*'
): fc.Arbitrary<unknown> => {
	if (definition.enum.length <= 0) throw Error(`Enum type definition has no values in ${path}`);
	return fc.constantFrom(...definition.enum.map((e) => e.value));
};

const namedTypeToArb = async (
	namedType: DeepReadonly<NamedType>,
	registry: SchemaRegistry,
	conf: ArbitraryConfig,
	objTypeArb: ObjectTypeToArb,
	path: string = '*unspecified*'
): Promise<fc.Arbitrary<unknown>> => {
	// Type references have the format `[origin]#[type]`. `[origin]` is
	// `pulumi.json` for built-in Pulumi types. For non built-in types we
	// rely on the schema registry to find a type definition.

	// Built-in Pulumi types
	switch (namedType.$ref) {
		case 'pulumi.json#/Archive':
			return fc.string();
		case 'pulumi.json#/Asset':
			return fc.string();
		case 'pulumi.json#/Any':
			return fc.anything();
		case 'pulumi.json#/Json':
			return fc.json();
		default:
	}
	let definition = await registry.resolveTypeRef(namedType.$ref);
	if (definition === undefined) {
		const errMsg = `Failed to find type definition for ${namedType.$ref} in ${path}`;
		if (conf.failOnMissingTypeReference) throw new Error(errMsg);
		console.warn(`${errMsg}. Returning default type reference definition`);
		definition = conf.defaultTypeReferenceDefinition;
		if (definition === undefined) return fc.constant(undefined);
	}
	const objErrContext = () => `${path}$ref#obj:${namedType.$ref}`;
	return is<EnumTypeDefinition>(definition)
		? enumTypeDefToArb(definition, `${path}$ref#enum:${namedType.$ref}`)
		: objTypeArb(definition, registry, conf, objErrContext());
};

const unionTypeToArb = async (
	unionType: DeepReadonly<UnionType>,
	registry: SchemaRegistry,
	conf: ArbitraryConfig,
	objTypeArb: ObjectTypeToArb,
	typeRefToArb: TypeRefToArb,
	path: string = '*unspecified*'
): Promise<fc.Arbitrary<unknown>> => {
	const typeArbs = unionType.oneOf.map((oneOfSchema: DeepReadonly<TypeReference>, i: number) => {
		const oneOfPath = `${path}$oneOf:${i}`;
		return typeRefToArb(oneOfSchema, registry, conf, objTypeArb, oneOfPath);
	});
	return fc.oneof(...(await Promise.all(typeArbs)));
};

export const typeRefToArb: TypeRefToArb = async (
	typeRefDef,
	registry,
	conf,
	objectTypeToArb,
	path = '*unspecified*'
) => {
	if (typeRefDef.$ref !== undefined)
		return namedTypeToArb(typeRefDef, registry, conf, objectTypeToArb, path);
	if (typeRefDef.oneOf !== undefined)
		return unionTypeToArb(typeRefDef, registry, conf, objectTypeToArb, typeRefToArb, path);

	const { type } = typeRefDef;
	const typeRefArb = (typeRef: DeepReadonly<TypeReference>, err: string) =>
		typeRefToArb(typeRef, registry, conf, objectTypeToArb, `${path}${err}`);
	switch (type) {
		case 'array': // ArrayType
			return fc.array(await typeRefArb(typeRefDef.items, `items`));
		case 'object': // MapType
			return fc.dictionary(
				fc.string(),
				typeRefDef.additionalProperties === undefined
					? fc.string()
					: await typeRefArb(typeRefDef.additionalProperties, `additionalProperties`)
			);
		case 'boolean': // PrimitiveType
			return fc.boolean();
		case 'integer': // PrimitiveType
			return fc.integer();
		case 'number': // PrimitiveType
			return fc.oneof(fc.integer(), fc.float(), fc.double());
		case 'string': // PrimitiveType
			return fc.string();
		default:
			throw new Error(`Found not implemented schema type "${type}" in ${path}`);
	}
};

export const propertyDefToArb = async (
	definition: DeepReadonly<PropertyDefinition>,
	registry: SchemaRegistry,
	conf: ArbitraryConfig,
	objTypeArb: ObjectTypeToArb,
	path: string = '*unspecified*'
): Promise<fc.Arbitrary<unknown>> => {
	if (definition.const !== undefined) return fc.constant(definition.const);
	const propTypeArb = await typeRefToArb(definition, registry, conf, objTypeArb, path);
	if (definition.default !== undefined)
		return fc.oneof(fc.constant(definition.default), propTypeArb);
	return propTypeArb;
};

export const objectTypeToArb: ObjectTypeToArb = async (
	definition,
	registry,
	conf,
	path = '*unspecified*'
) => {
	const props = Object.keys(definition.properties || {});
	const propArbs = props.map(async (prop): Promise<[string, fc.Arbitrary<unknown>]> => {
		const propSchema = definition.properties![prop];
		const propErrMsgContext = `${path}$property:${prop}`;
		return [
			prop,
			await propertyDefToArb(propSchema, registry, conf, objectTypeToArb, propErrMsgContext),
		];
	});
	const requiredKeys = [...(definition.required || [])];
	requiredKeys
		.filter((requiredProp) => !props.includes(requiredProp))
		.forEach((requiredProp) => {
			const errMsg = `Property "${requiredProp}" required but not defined in ${path}`;
			throw new Error(errMsg);
		});
	return fc.record(Object.fromEntries(await Promise.all(propArbs)), { requiredKeys });
};

export class PulumiPackagesSchemaGenerator implements Generator {
	private static generatorIdCounter: number = 0;

	private readonly generatorId: number;

	public readonly trace: DeepReadonly<ResourceOutput[]>;

	private readonly appendTrace: (output: ResourceOutput) => void;

	constructor(
		private readonly conf: ArbitraryConfig,
		private readonly registry: SchemaRegistry,
		private readonly mrng: fc.Random,
		private readonly biasFactor: number | undefined
	) {
		this.generatorId = PulumiPackagesSchemaGenerator.generatorIdCounter++;
		[this.trace, this.appendTrace] = createAppendOnlyArray<ResourceOutput>();
	}

	private async generateResourceState(resourceType: string): Promise<ResourceOutput['state']> {
		const resDef = await this.registry.getResource(resourceType);
		const errContext = `resourceDefinition:${resourceType}`;
		if (resDef === undefined) {
			const errMsg = `Failed to find resource definition of ${errContext}`;
			if (this.conf.failOnMissingResourceDefinition) throw new Error(errMsg);
			console.warn(`${errMsg}. Returning default resource state`);
			return this.conf.defaultResourceState;
		}
		const resourceArb = await objectTypeToArb(resDef, this.registry, this.conf, errContext);
		return resourceArb.generate(this.mrng, this.biasFactor).value;
	}

	async generateResourceOutput(resource: ResourceArgs): Promise<ResourceOutput> {
		const output: ResourceOutput = {
			id: resource.urn,
			state: await this.generateResourceState(resource.type),
		};
		this.appendTrace(output);
		return output;
	}

	public toString(): string {
		const trace = resourceOutputTraceToString(this.trace);
		return `Generator ${this.generatorId} resource output trace:\n${trace}`;
	}
}

export type PulumiPackagesSchemaArbitraryContext = {};

export class PulumiPackagesSchemaArbitrary extends fc.Arbitrary<Generator> {
	private readonly registry: SchemaRegistry = SchemaRegistry.getInstance();

	constructor(private readonly conf: ArbitraryConfig = config().arbitrary) {
		super();
	}

	generate(mrng: fc.Random, biasFactor: number | undefined): fc.Value<Generator> {
		const generator = new PulumiPackagesSchemaGenerator(
			this.conf,
			this.registry,
			mrng,
			biasFactor
		);
		const context: PulumiPackagesSchemaArbitraryContext = {};
		return new fc.Value(generator, context);
	}

	// eslint-disable-next-line class-methods-use-this
	canShrinkWithoutContext(value: unknown): value is Generator {
		return is<PulumiPackagesSchemaGenerator>(value);
	}

	// eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars
	shrink(value: Generator, context: unknown): fc.Stream<fc.Value<Generator>> {
		return fc.Stream.nil();
	}
}

export default PulumiPackagesSchemaArbitrary;
export const init: TestModuleInitFn = initModule;
