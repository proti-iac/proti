import { is } from 'typia';
import type { ResourceArgs } from './oracle';
import type { DeepReadonly } from './utils';

export type ResourceOutput = DeepReadonly<{ id: string; state: Record<string, any> }>;

export interface Generator {
	generateResourceOutput(resource: ResourceArgs): Promise<ResourceOutput>;
}

export const isGenerator = (generator: any): generator is Generator =>
	typeof generator?.generateResourceOutput === 'function' && is<Generator>(generator);
