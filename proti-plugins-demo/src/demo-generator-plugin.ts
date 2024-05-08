import * as fc from 'fast-check';
import { is } from 'typia';
import {
	type Generator,
	type GeneratorPlugin,
	type PluginInitFn,
	type PluginShutdownFn,
	type PluginWithInitFn,
	type PluginWithShutdownFn,
	type ResourceArgs,
	type ResourceOutput,
	TraceGenerator,
} from '@proti-iac/core';
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
 * Simple generator plugin ({@link GeneratorPlugin}) providing {@link DemoGenerator} instances.
 */
export class DemoGeneratorPlugin
	extends fc.Arbitrary<Generator>
	implements GeneratorPlugin, PluginWithInitFn, PluginWithShutdownFn
{
	private static generatorIdCounter: number = 0;

	private static conf = config();

	// eslint-disable-next-line class-methods-use-this
	generate(mrng: fc.Random, biasFactor: number | undefined): fc.Value<Generator> {
		// Access plugin configuration value
		const id = DemoGeneratorPlugin.conf.demoId;
		const generatorId = `demo-generator-${id}-${DemoGeneratorPlugin.generatorIdCounter++}`;
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

	/**
	 * Optional initialization method called after the generator plugin is
	 * loaded. Enforced through optional implementation of
	 * {@link PluginWithInitFn}.
	 */
	// eslint-disable-next-line class-methods-use-this
	readonly init: PluginInitFn = async () => {};

	/**
	 * Optional shutdown method called after the ProTI check terminated.
	 * Enforced through optional implementation of {@link PluginWithShutdownFn}.
	 */
	// eslint-disable-next-line class-methods-use-this
	readonly shutdown: PluginShutdownFn = async () => {};
}
export default DemoGeneratorPlugin;
