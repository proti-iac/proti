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
import { PropertyDefinition, TypeReference } from './pulumi-package-metaschema';

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

export const typeReferenceToArbitrary = (
	typeSchema: DeepReadonly<TypeReference>
): fc.Arbitrary<unknown> => {
	// NamedType
	if (typeSchema.$ref !== undefined)
		throw new Error(
			`Support for named types not implemented! Found reference to ${typeSchema.$ref}`
		);
	// UnionType
	if (typeSchema.oneOf !== undefined)
		return fc.oneof(...typeSchema.oneOf.map(typeReferenceToArbitrary));

	switch (typeSchema.type) {
		case 'array': // ArrayType
			return fc.array(typeReferenceToArbitrary(typeSchema.items));
		case 'object': // MapType
			return fc.dictionary(
				fc.string(),
				typeSchema.additionalProperties === undefined
					? fc.string()
					: typeReferenceToArbitrary(typeSchema.additionalProperties)
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
			throw new Error();
	}
};

export const propertyDefinitionToArbitrary = (
	propSchema: DeepReadonly<PropertyDefinition>
): fc.Arbitrary<unknown> => {
	if (propSchema.const !== undefined) return fc.constant(propSchema.const);
	const propTypeArbitrary: fc.Arbitrary<unknown> = typeReferenceToArbitrary(propSchema);
	if (propSchema.default !== undefined)
		return fc.oneof(fc.constant(propSchema.default), propTypeArbitrary);
	return propTypeArbitrary;
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
		const schema = await this.registry.getSchema(resourceType);
		if (schema === undefined)
			if (this.conf.failOnMissingTypes)
				throw new Error(`Failed to get schema for resource type ${resourceType}`);
			else return this.conf.defaultState;

		return {};
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
