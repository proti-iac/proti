import * as fc from 'fast-check';
import { Arbitrary } from 'fast-check';
import { is } from 'typia';
import { Generator, ResourceOutput, TraceGenerator } from '../generator';
import type { ResourceArgs } from '../oracle';
import { GeneratorPlugin } from '../plugin';

class EmptyStateGenerator extends TraceGenerator {
	// eslint-disable-next-line class-methods-use-this
	async generateResourceOutput(resource: ResourceArgs): Promise<ResourceOutput> {
		const resourceOutput = { id: resource.urn, state: {} };
		this.appendTrace(resourceOutput);
		return resourceOutput;
	}

	public generateValue<T>(specId: string, arbitrary: fc.Arbitrary<T>): T {
		const { value } = arbitrary.generate(this.mrng, this.biasFactor);
		this.appendTrace({ id: specId, value });
		return value;
	}
}

export class EmptyStateGeneratorPlugin extends Arbitrary<Generator> implements GeneratorPlugin {
	private static generatorIdCounter: number = 0;

	// eslint-disable-next-line class-methods-use-this
	generate(mrng: fc.Random, biasFactor: number | undefined): fc.Value<Generator> {
		const generatorId = `empty-state-generator-${EmptyStateGeneratorPlugin.generatorIdCounter++}`;
		return new fc.Value(new EmptyStateGenerator(generatorId, mrng, biasFactor), {});
	}

	// eslint-disable-next-line class-methods-use-this
	canShrinkWithoutContext(value: unknown): value is Generator {
		return is<EmptyStateGenerator>(value);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars, class-methods-use-this
	shrink(value: Generator, context: unknown): fc.Stream<fc.Value<Generator>> {
		return fc.Stream.nil();
	}
}

export default EmptyStateGeneratorPlugin;
