import type { MockResourceArgs } from '@pulumi/pulumi/runtime';
import type { MockMonitor } from '@pulumi/pulumi/runtime/mocks';

interface TestCaseMetadata {
	readonly testName: string;
	readonly description?: string;
}

export type ResourceTestArgs = MockResourceArgs & { urn: string };
export abstract class ResourceTest implements TestCaseMetadata {
	abstract readonly testName: string;

	abstract readonly description?: string;

	abstract readonly validateResource: (resource: ResourceTestArgs) => Error | void;
}
export const isResourceTest = (test: any): test is ResourceTest =>
	typeof test?.testName === 'string' && typeof test?.validateResource === 'function';

export type DeploymentTestArgs = MockMonitor['resources'];
export abstract class DeploymentTest implements TestCaseMetadata {
	abstract readonly testName: string;

	abstract readonly description?: string;

	abstract readonly validateDeployment: (resources: DeploymentTestArgs) => Error | void;
}
export const isDeploymentTest = (test: any): test is DeploymentTest =>
	typeof test?.testName === 'string' && typeof test?.validateDeployment === 'function';

export type Test = ResourceTest | DeploymentTest;
export const isTest = (test: any): test is Test => isResourceTest(test) || isDeploymentTest(test);
