import * as fc from 'fast-check';
import { Arbitrary } from 'fast-check';
import { Generator, ResourceOutput } from '../generator';
import { ResourceOracleArgs } from '../oracle';

export class EmptyStateGenerator implements Generator {
	// eslint-disable-next-line class-methods-use-this
	async generateResourceOutput(resource: ResourceOracleArgs): Promise<ResourceOutput> {
		return {
			id: resource.urn,
			state: {},
		};
	}
}

export class EmptyStateGeneratorArbitrary extends Arbitrary<Generator> {
	private readonly arb = fc.constant<Generator>(new EmptyStateGenerator());

	generate(mrng: fc.Random, biasFactor: number | undefined): fc.Value<Generator> {
		return this.arb.generate(mrng, biasFactor);
	}

	canShrinkWithoutContext(value: unknown): value is Generator {
		return this.arb.canShrinkWithoutContext(value);
	}

	shrink(value: Generator, context: unknown): fc.Stream<fc.Value<Generator>> {
		return this.arb.shrink(value, context);
	}
}

export default EmptyStateGeneratorArbitrary;
