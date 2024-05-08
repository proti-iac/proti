import type { MockResourceArgs } from '@pulumi/pulumi/runtime';
import type { MockMonitor } from '@pulumi/pulumi/runtime/mocks';
import { is } from 'typia';
import { type DeepReadonly, hasMethods } from './utils';

export type ResourceArgs = DeepReadonly<MockResourceArgs & { urn: string }>;

export type TestResult = Readonly<Error> | undefined;

interface AbstractOracle<S> {
	readonly name: string;
	readonly description?: string;
	/**
	 * Create the oracle's state for a new test run. The returned new state,
	 * e.g., a mutable object, is passed to all validation calls on the oracle
	 * in the same test run.
	 * @returns New oracle test run state.
	 */
	newRunState(): S;
}
const isAbstractOracle = (v: unknown): v is AsyncResourceOracle<unknown> =>
	is<AbstractOracle<unknown>>(v) && hasMethods(v, ['newRunState']);

export interface ResourceOracle<S> extends AbstractOracle<S> {
	readonly validateResource: (resource: ResourceArgs, runState: S) => TestResult;
}
export const isResourceOracle = (v: unknown): v is ResourceOracle<unknown> =>
	isAbstractOracle(v) && hasMethods(v, ['validateResource']);

export interface AsyncResourceOracle<S> extends AbstractOracle<S> {
	readonly asyncValidateResource: (resource: ResourceArgs, runState: S) => Promise<TestResult>;
}
export const isAsyncResourceOracle = (v: unknown): v is AsyncResourceOracle<unknown> =>
	isAbstractOracle(v) && hasMethods(v, ['asyncValidateResource']);

export type DeploymentOracleArgs = DeepReadonly<MockMonitor['resources']>;

export interface DeploymentOracle<S> extends AbstractOracle<S> {
	readonly validateDeployment: (resources: DeploymentOracleArgs, runState: S) => TestResult;
}
export const isDeploymentOracle = (v: unknown): v is DeploymentOracle<unknown> =>
	isAbstractOracle(v) && hasMethods(v, ['validateDeployment']);

export interface AsyncDeploymentOracle<S> extends AbstractOracle<S> {
	readonly asyncValidateDeployment: (
		resources: DeploymentOracleArgs,
		runState: S
	) => Promise<TestResult>;
}
export const isAsyncDeploymentOracle = (v: unknown): v is AsyncDeploymentOracle<unknown> =>
	isAbstractOracle(v) && hasMethods(v, ['asyncValidateDeployment']);

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
