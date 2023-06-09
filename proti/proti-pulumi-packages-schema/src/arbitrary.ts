import * as fc from 'fast-check';
import {
	createReadonlyAppendArray,
	DeepReadonly,
	Generator,
	ResourceArgs,
	ResourceOutput,
	TestModuleInitFn,
} from '@proti/core';
import { is, stringify } from 'typia';
import { initModule } from './utils';
import { SchemaRegistry } from './schema-registry';
import { ArbitraryConfig, config } from './config';
import { ObjectTypeDetails, PropertyDefinition, TypeReference } from './pulumi-package-metaschema';

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

export const typeReferenceToArbitrary = async (
	definition: DeepReadonly<TypeReference>,
	errContext: string = '*unspecified*'
): Promise<fc.Arbitrary<unknown>> => {
	// NamedType
	if (definition.$ref !== undefined)
		throw new Error(
			`Support for named types not implemented! Found reference to ${definition.$ref} in ${errContext}`
		);
	// UnionType
	if (definition.oneOf !== undefined) {
		const typeArbs = definition.oneOf.map(
			(oneOfSchema: DeepReadonly<TypeReference>, i: number) =>
				typeReferenceToArbitrary(oneOfSchema, `${errContext}$oneOf:${i}`)
		);
		return fc.oneof(...(await Promise.all(typeArbs)));
	}

	const { type } = definition;
	switch (type) {
		case 'array': // ArrayType
			return fc.array(
				await typeReferenceToArbitrary(definition.items, `${errContext}$items`)
			);
		case 'object': // MapType
			return fc.dictionary(
				fc.string(),
				definition.additionalProperties === undefined
					? fc.string()
					: await typeReferenceToArbitrary(
							definition.additionalProperties,
							`${errContext}$additionalProperties`
					  )
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
			throw new Error(`Found not implemented schema type "${type}" in ${errContext}`);
	}
};

export const propertyDefinitionToArbitrary = async (
	definition: DeepReadonly<PropertyDefinition>,
	errContext: string = '*unspecified*'
): Promise<fc.Arbitrary<unknown>> => {
	if (definition.const !== undefined) return fc.constant(definition.const);
	const propTypeArbitrary = await typeReferenceToArbitrary(definition, errContext);
	if (definition.default !== undefined)
		return fc.oneof(fc.constant(definition.default), propTypeArbitrary);
	return propTypeArbitrary;
};

export const objectTypeDetailsToArbitrary = async (
	definition: DeepReadonly<ObjectTypeDetails>,
	errContext: string = '*unspecified*'
): Promise<fc.Arbitrary<Readonly<{ [_: string]: unknown }>>> => {
	const props = Object.keys(definition.properties || {});
	const propArbs = props.map(async (prop): Promise<[string, fc.Arbitrary<unknown>]> => {
		const propSchema = definition.properties![prop];
		const propErrMsgContext = `${errContext}$property:${prop}`;
		return [prop, await propertyDefinitionToArbitrary(propSchema, propErrMsgContext)];
	});
	const requiredKeys = [...(definition.required || [])];
	requiredKeys
		.filter((requiredProp) => !props.includes(requiredProp))
		.forEach((requiredProp) => {
			const errMsg = `Property "${requiredProp}" required but not defined in ${errContext}`;
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
		[this.trace, this.appendTrace] = createReadonlyAppendArray<ResourceOutput>();
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
		const resourceArb = await objectTypeDetailsToArbitrary(resDef, errContext);
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
