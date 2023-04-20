import { ResourceOracleArgs } from './oracle';

export type ResourceOutput = { id: string; state: Record<string, any> };

export abstract class OutputGenerator {
	public constructor(protected readonly seed: number) {}

	public abstract generateResourceOutput(
		runId: number,
		resource: ResourceOracleArgs
	): ResourceOutput;
}

export const isOutputGenerator = (outputGenerator: any): outputGenerator is OutputGenerator =>
	typeof outputGenerator?.generateResourceOutput === 'function';
