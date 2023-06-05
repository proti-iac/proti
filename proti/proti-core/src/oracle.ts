import type { MockResourceArgs } from '@pulumi/pulumi/runtime';
import type { MockMonitor } from '@pulumi/pulumi/runtime/mocks';
import { createIs } from 'typia';
import type { DeepReadonly } from './utils';

export type ResourceArgs = DeepReadonly<MockResourceArgs & { urn: string }>;

export type TestResult = Readonly<Error> | undefined;

export type OracleMetadata = Readonly<{
	name: string;
	description?: string;
}>;
const isOracleMetadata: (val: unknown) => val is OracleMetadata = createIs<OracleMetadata>();

export interface ResourceOracle extends OracleMetadata {
	readonly validateResource: (resource: ResourceArgs) => TestResult;
}
export const isResourceOracle = (val: any): val is ResourceOracle =>
	typeof val?.validateResource === 'function' && isOracleMetadata(val);

export interface AsyncResourceOracle extends OracleMetadata {
	readonly asyncValidateResource: (resource: ResourceArgs) => Promise<TestResult>;
}
export const isAsyncResourceOracle = (val: any): val is AsyncResourceOracle =>
	typeof val?.asyncValidateResource === 'function' && isOracleMetadata(val);

export type DeploymentOracleArgs = DeepReadonly<MockMonitor['resources']>;

export interface DeploymentOracle extends OracleMetadata {
	readonly validateDeployment: (resources: DeploymentOracleArgs) => TestResult;
}
export const isDeploymentOracle = (val: any): val is DeploymentOracle =>
	typeof val?.validateDeployment === 'function' && isOracleMetadata(val);

export interface AsyncDeploymentOracle extends OracleMetadata {
	readonly asyncValidateDeployment: (resources: DeploymentOracleArgs) => Promise<TestResult>;
}
export const isAsyncDeploymentOracle = (val: any): val is AsyncDeploymentOracle =>
	typeof val?.asyncValidateDeployment === 'function' && isOracleMetadata(val);

export type Oracle =
	| AsyncDeploymentOracle
	| AsyncResourceOracle
	| DeploymentOracle
	| ResourceOracle;
export const isOracle = (val: unknown): val is Oracle =>
	isAsyncDeploymentOracle(val) ||
	isAsyncResourceOracle(val) ||
	isDeploymentOracle(val) ||
	isResourceOracle(val);
