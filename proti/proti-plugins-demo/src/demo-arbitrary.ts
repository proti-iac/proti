import * as fc from 'fast-check';
import { Arbitrary } from 'fast-check';
import { is } from 'typia';
import {
	Generator,
	ResourceArgs,
	ResourceOutput,
	TestModuleInitFn,
	TraceGenerator,
} from '@proti/core';
import { config } from './config';

/**
 * Simple {@link TraceGenerator} returning empty states and random values.
 */
export class DemoGenerator extends TraceGenerator {
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

/**
 * Simple generator arbitrary ({@link Arbitrary<Generator>}) providing {@link DemoGenerator} instances.
 */
export class DemoGeneratorArbitrary extends Arbitrary<Generator> {
	private static generatorIdCounter: number = 0;

	private static conf = config();

	// eslint-disable-next-line class-methods-use-this
	generate(mrng: fc.Random, biasFactor: number | undefined): fc.Value<Generator> {
		// Access plugin configuration value
		const id = DemoGeneratorArbitrary.conf.demoId;
		const generatorId = `demo-generator-${id}-${DemoGeneratorArbitrary.generatorIdCounter++}`;
		return new fc.Value(new DemoGenerator(generatorId, mrng, biasFactor), {});
	}

	// eslint-disable-next-line class-methods-use-this
	canShrinkWithoutContext(value: unknown): value is Generator {
		return is<DemoGenerator>(value);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars, class-methods-use-this
	shrink(value: Generator, context: unknown): fc.Stream<fc.Value<Generator>> {
		return fc.Stream.nil();
	}
}

export default DemoGeneratorArbitrary;

/**
 * Initialization method called when the generator is loaded.
 */
export const init: TestModuleInitFn = async () => {};
