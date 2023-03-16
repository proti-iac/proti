import { TestCoordinatorConfig } from './config';
import {
	AsyncDeploymentTest,
	AsyncResourceTest,
	DeploymentTest,
	DeploymentTestArgs,
	isAsyncDeploymentTest,
	isAsyncResourceTest,
	isDeploymentTest,
	isResourceTest,
	ResourceTest,
	ResourceTestArgs,
	Test,
	TestResult,
} from './tests';

type TestClasses = {
	Ctor: { new (): Test };
	resourceTest: boolean;
	asyncResourceTest: boolean;
	deploymentTest: boolean;
	aysncDeploymentTest: boolean;
	delayedInstantiation: boolean;
}[];

export class TestRunCoordinator {
	private readonly resourceTests: ResourceTest[] = [];

	private readonly asyncResourceTests: AsyncResourceTest[] = [];

	private readonly deploymentTests: DeploymentTest[] = [];

	private readonly asyncDeploymentTests: AsyncDeploymentTest[] = [];

	private readonly delayedInstantiation: TestClasses = [];

	public readonly errors: Error[] = [];

	private readonly pendingTests: Promise<Error | void>[] = [];

	// eslint-disable-next-line class-methods-use-this
	private complete: () => void = () => {
		throw new Error('Test run coordinator completed before completing initialization');
	};

	public readonly isDone: Promise<void>;

	constructor(testClasses: TestClasses, private readonly failFast: boolean) {
		const directInstantiation = testClasses.filter((tc) => {
			if (tc.delayedInstantiation) this.delayedInstantiation.push(tc);
			return !tc.delayedInstantiation;
		});
		this.initTests(directInstantiation);
		this.isDone = new Promise((resolve) => {
			this.complete = resolve;
		});
	}

	private initTests(testClasses: TestClasses): void {
		testClasses.forEach((tc) => {
			const test = new tc.Ctor();
			if (tc.resourceTest) this.resourceTests.push(test as ResourceTest);
			if (tc.asyncResourceTest) this.asyncResourceTests.push(test as AsyncResourceTest);
			if (tc.deploymentTest) this.deploymentTests.push(test as DeploymentTest);
			if (tc.aysncDeploymentTest) this.asyncDeploymentTests.push(test as AsyncDeploymentTest);
		});
	}

	private handleAsyncResolut(result: Promise<TestResult>): void {
		this.pendingTests.push(result);
		result.then(this.handleResult);
	}

	private handleResult(result: TestResult): void {
		if (result instanceof Error) {
			this.errors.push(result);
			if (this.failFast) {
				this.complete();
				throw result;
			}
		}
	}

	public validateResource(resource: ResourceTestArgs): void {
		this.asyncResourceTests.forEach((asyncTest) =>
			this.handleAsyncResolut(asyncTest.asyncValidateResource(resource))
		);
		this.resourceTests.forEach((test) => this.handleResult(test.validateResource(resource)));
	}

	public validateDeployment(resources: DeploymentTestArgs): void {
		this.initTests(this.delayedInstantiation);

		this.asyncDeploymentTests.forEach((asyncTest) =>
			this.handleAsyncResolut(asyncTest.asyncValidateDeployment(resources))
		);
		this.deploymentTests.forEach((test) =>
			this.handleResult(test.validateDeployment(resources))
		);

		Promise.all(this.pendingTests).then(() => this.complete());
	}
}

export class TestCoordinator {
	public readonly testClasses: TestClasses = [];

	public readonly isReady: Promise<void>;

	constructor(private readonly config: TestCoordinatorConfig) {
		this.isReady = this.loadTestClasses();
	}

	private async loadTestClasses(): Promise<void> {
		const tests = this.config.tests.map((moduleName) =>
			import(moduleName).then((testModule) => {
				const TestClass = testModule.default;
				const test = new TestClass();
				const [asyncDeplTest, asyncResTest, deplTest, resTest] = [
					isAsyncDeploymentTest(test),
					isAsyncResourceTest(test),
					isDeploymentTest(test),
					isResourceTest(test),
				];
				if (!asyncResTest && !asyncDeplTest && !deplTest && !resTest)
					throw new Error(`Configured test has invalid interface: ${moduleName}`);
				this.testClasses.push({
					Ctor: TestClass,
					resourceTest: resTest,
					asyncResourceTest: asyncResTest,
					deploymentTest: deplTest,
					aysncDeploymentTest: asyncDeplTest,
					delayedInstantiation: !resTest && !asyncResTest,
				});
			})
		);
		return Promise.all(tests).then(() => {});
	}

	public newRunCoordinator(): TestRunCoordinator {
		return new TestRunCoordinator(this.testClasses, this.config.failFast);
	}
}
