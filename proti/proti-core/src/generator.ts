import { is } from 'typia';
import { ResourceOracleArgs } from './oracle';

export type ResourceOutput = { id: string; state: Record<string, any> };

export interface Generator {
	generateResourceOutput(resource: ResourceOracleArgs): Promise<ResourceOutput>;
}

export const isGenerator = (generator: any): generator is Generator =>
	typeof generator?.generateResourceOutput === 'function' && is<Generator>(generator);
