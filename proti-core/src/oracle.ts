import type { MockResourceArgs } from '@pulumi/pulumi/runtime';
import type { MockMonitor } from '@pulumi/pulumi/runtime/mocks';
import { is } from 'typia';
import type { DeepReadonly } from './utils';

export type ResourceArgs = DeepReadonly<MockResourceArgs & { urn: string }>;

export type TestResult = Readonly<Error> | undefined;

export type OracleMetadata = Readonly<{
	name: string;
	description?: string;
}>;

export interface AbstractOracle<S> extends OracleMetadata {
	/**
	 * Create the oracle's state for a new test run. The returned new state,
	 * e.g., a mutable object, is passed to all validation calls on the oracle
	 * in the same test run.
	 * @returns New oracle test run state.
	 */
	readonly newRunState: () => S;
}
const isAbstractOracle = (val: any): val is AsyncResourceOracle<unknown> =>
	typeof val?.newRunState === 'function' && is<OracleMetadata>(val);

export interface ResourceOracle<S> extends AbstractOracle<S> {
	readonly validateResource: (resource: ResourceArgs, runState: S) => TestResult;
}
export const isResourceOracle = (val: any): val is ResourceOracle<unknown> =>
	typeof val?.validateResource === 'function' && isAbstractOracle(val);

export interface AsyncResourceOracle<S> extends AbstractOracle<S> {
	readonly asyncValidateResource: (resource: ResourceArgs, runState: S) => Promise<TestResult>;
}
export const isAsyncResourceOracle = (val: any): val is AsyncResourceOracle<unknown> =>
	typeof val?.asyncValidateResource === 'function' && isAbstractOracle(val);

export type DeploymentOracleArgs = DeepReadonly<MockMonitor['resources']>;

export interface DeploymentOracle<S> extends AbstractOracle<S> {
	readonly validateDeployment: (resources: DeploymentOracleArgs, runState: S) => TestResult;
}
export const isDeploymentOracle = (val: any): val is DeploymentOracle<unknown> =>
	typeof val?.validateDeployment === 'function' && isAbstractOracle(val);

export interface AsyncDeploymentOracle<S> extends AbstractOracle<S> {
	readonly asyncValidateDeployment: (
		resources: DeploymentOracleArgs,
		runState: S
	) => Promise<TestResult>;
}
export const isAsyncDeploymentOracle = (val: any): val is AsyncDeploymentOracle<unknown> =>
	typeof val?.asyncValidateDeployment === 'function' && isAbstractOracle(val);

export type Oracle<S> =
	| AsyncDeploymentOracle<S>
	| AsyncResourceOracle<S>
	| DeploymentOracle<S>
	| ResourceOracle<S>;

export const isOracle = (val: unknown): val is Oracle<unknown> =>
	isAsyncDeploymentOracle(val) ||
	isAsyncResourceOracle(val) ||
	isDeploymentOracle(val) ||
	isResourceOracle(val);
