import type { MockResourceArgs } from '@pulumi/pulumi/runtime';
import type { MockMonitor } from '@pulumi/pulumi/runtime/mocks';

export type TestResult = Error | undefined;

export interface TestMetadata {
	readonly testName: string;
	readonly description?: string;
}
const isTestMetadata = (test: any): test is TestMetadata => typeof test?.testName === 'string';

export type ResourceTestArgs = MockResourceArgs & { urn: string };

export interface ResourceTest extends TestMetadata {
	readonly validateResource: (resource: ResourceTestArgs) => TestResult;
}
export const isResourceTest = (test: any): test is ResourceTest =>
	typeof test?.validateResource === 'function' && isTestMetadata(test);

export interface AsyncResourceTest extends TestMetadata {
	readonly asyncValidateResource: (resource: ResourceTestArgs) => Promise<TestResult>;
}
export const isAsyncResourceTest = (test: any): test is AsyncResourceTest =>
	typeof test?.asyncValidateResource === 'function' && isTestMetadata(test);

export type DeploymentTestArgs = MockMonitor['resources'];

export interface DeploymentTest extends TestMetadata {
	readonly validateDeployment: (resources: DeploymentTestArgs) => TestResult;
}
export const isDeploymentTest = (test: any): test is DeploymentTest =>
	typeof test?.validateDeployment === 'function' && isTestMetadata(test);

export interface AsyncDeploymentTest extends TestMetadata {
	readonly asyncValidateDeployment: (resources: DeploymentTestArgs) => Promise<TestResult>;
}
export const isAsyncDeploymentTest = (test: any): test is AsyncDeploymentTest =>
	typeof test?.asyncValidateDeployment === 'function' && isTestMetadata(test);

export type Test = AsyncDeploymentTest | AsyncResourceTest | DeploymentTest | ResourceTest;
export const isTest = (test: any): test is Test =>
	isAsyncDeploymentTest(test) ||
	isAsyncResourceTest(test) ||
	isDeploymentTest(test) ||
	isResourceTest(test);
