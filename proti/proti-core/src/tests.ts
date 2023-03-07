import type { MockResourceArgs } from '@pulumi/pulumi/runtime';
import type { MockMonitor } from '@pulumi/pulumi/runtime/mocks';

export interface Test {
	readonly testName: string;
	readonly description?: string;
}
export const isTest = (test: any): test is Test => typeof test?.testName === 'string';

export type ResourceTestArgs = MockResourceArgs & { urn: string };

export interface ResourceTest extends Test {
	readonly validateResource: (resource: ResourceTestArgs) => Error | void;
}
export const isResourceTest = (test: any): test is ResourceTest =>
	typeof test?.validateResource === 'function' && isTest(test);

export interface AsyncResourceTest extends Test {
	readonly asyncValidateResource: (resource: ResourceTestArgs) => Promise<Error | void>;
}
export const isAsyncResourceTest = (test: any): test is AsyncResourceTest =>
	typeof test?.asyncValidateResource === 'function' && isTest(test);

export type DeploymentTestArgs = MockMonitor['resources'];

export interface DeploymentTest extends Test {
	readonly validateDeployment: (resources: DeploymentTestArgs) => Error | void;
}
export const isDeploymentTest = (test: any): test is DeploymentTest =>
	typeof test?.validateDeployment === 'function' && isTest(test);

export interface AsyncDeploymentTest extends Test {
	readonly asyncValidateDeployment: (resources: DeploymentTestArgs) => Promise<Error | void>;
}
export const isAsyncDeploymentTest = (test: any): test is AsyncDeploymentTest =>
	typeof test?.asyncValidateDeployment === 'function' && isTest(test);
