import { is, stringify } from 'typia';
import type * as fc from 'fast-check';
import type { ResourceArgs } from './oracle';
import { createAppendOnlyArray, type DeepReadonly } from './utils';

export type ResourceOutput = DeepReadonly<{ id: string; state: Record<string, any> }>;

export interface Generator {
	/**
	 * Called on every resource definition to generate its simulated configuration.
	 * @param resource Resource information.
	 * @returns Generated resource configuration.
	 */
	generateResourceOutput(resource: ResourceArgs): Promise<ResourceOutput>;

	/**
	 * Called on every occurrence of an ad-hoc generator specification to
	 * generate a specified value.
	 * @param specId Identifier of the ad-hoc specification.
	 * @param arbitrary Arbitrary of the specification's with clause.
	 * @returns Value generated based on the ad-hoc specification.
	 */
	generateValue<T>(specId: string, arbitrary: fc.Arbitrary<T>): T;
}

export type Generated = ResourceOutput | DeepReadonly<{ id: string; value: any }>;
export const generatorTraceToString = (trace: readonly Generated[]) => {
	const numLength = trace.length.toString().length;
	return trace
		.flatMap((generated, i) => [
			`${i.toString().padStart(numLength)}: ${generated.id}`,
			...(is<ResourceOutput>(generated)
				? Object.entries(generated.state).map(
						([k, v]: [string, unknown]) =>
							`${' '.repeat(numLength + 2)}- ${k}: ${stringify(v)}`
				  )
				: [`${' '.repeat(numLength + 2)}- ${stringify(generated.value)}`]),
		])
		.join('\n');
};
export abstract class TraceGenerator implements Generator {
	/**
	 * Trace of generated value in chronological order.
	 */
	public readonly trace: DeepReadonly<Generated[]>;

	/**
	 * Appends a generated value to the trace. Should be called in every
	 * invocation of {@link generateResourceOutput} and  {@link generateValue}.
	 * @param Value to append to the trace.
	 */
	protected readonly appendTrace: (output: Generated) => void;

	constructor(
		public readonly generatorId: string,
		protected readonly mrng: fc.Random,
		protected readonly biasFactor: number | undefined
	) {
		[this.trace, this.appendTrace] = createAppendOnlyArray<Generated>();
	}

	public abstract generateResourceOutput(resource: ResourceArgs): Promise<ResourceOutput>;

	public abstract generateValue<T>(specId: string, arbitrary: fc.Arbitrary<T>): T;

	public toString(): string {
		const trace = generatorTraceToString(this.trace);
		return `Trace of generator ${this.generatorId}:\n${trace}`;
	}
}

export const isGenerator = (generator: any): generator is Generator =>
	typeof generator?.generateResourceOutput === 'function' &&
	typeof generator?.generateValue === 'function';
