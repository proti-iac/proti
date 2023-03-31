import { ResourceTestArgs } from './tests';

export type ResourceOutput = { id: string; state: Record<string, any> };

export abstract class OutputGenerator {
	public constructor(protected readonly seed: number) {}

	public abstract generateResourceOutput(
		runId: number,
		resource: ResourceTestArgs
	): ResourceOutput;
}

export const isOutputGenerator = (outputGenerator: any): outputGenerator is OutputGenerator =>
	typeof outputGenerator?.generateResourceOutput === 'function';
