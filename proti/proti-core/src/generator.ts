import { is } from 'typia';
import { ResourceOracleArgs } from './oracle';

export type ResourceOutput = { id: string; state: Record<string, any> };

export abstract class Generator {
	public constructor(protected readonly seed: number) {}

	public abstract generateResourceOutput(
		runId: number,
		resource: ResourceOracleArgs
	): ResourceOutput;
}

export const isGenerator = (generator: any): generator is Generator =>
	typeof generator?.generateResourceOutput === 'function' && is<Generator>(generator);
