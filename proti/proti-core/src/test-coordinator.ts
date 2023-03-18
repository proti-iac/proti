import { TestCoordinatorConfig } from './config';
import { isOutputGenerator, OutputGenerator, ResourceOutput } from './output-generator';
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
	TestMetadata,
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

type Fail = {
	test: TestMetadata;
	deployment?: DeploymentTestArgs;
	resource?: ResourceTestArgs;
	error: Error;
};

export class TestRunCoordinator {
	private readonly resourceTests: ResourceTest[] = [];

	private readonly asyncResourceTests: AsyncResourceTest[] = [];

	private readonly deploymentTests: DeploymentTest[] = [];

	private readonly asyncDeploymentTests: AsyncDeploymentTest[] = [];

	private readonly delayedInstantiation: TestClasses = [];

	public readonly fails: Fail[] = [];

	private readonly pendingTests: Promise<TestResult>[] = [];

	// eslint-disable-next-line class-methods-use-this
	private complete: () => void = () => {
		throw new Error('Test run coordinator completed before completing initialization');
	};

	private done: boolean = false;

	public readonly isDone: Promise<void>;

	constructor(
		private readonly runId: number,
		testClasses: TestClasses,
		private readonly outputGenerator: OutputGenerator,
		private readonly failFast: boolean
	) {
		const directInstantiation = testClasses.filter((tc) => {
			if (tc.delayedInstantiation) this.delayedInstantiation.push(tc);
			return !tc.delayedInstantiation;
		});
		this.initTests(directInstantiation);
		this.isDone = new Promise((resolve) => {
			this.complete = () => {
				this.done = true;
				resolve();
			};
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

	private handleAsyncResolut(
		test: TestMetadata,
		asyncResult: Promise<TestResult>,
		resource?: ResourceTestArgs,
		deployment?: DeploymentTestArgs
	): void {
		this.pendingTests.push(asyncResult);
		asyncResult.then((result) => this.handleResult(test, result, resource, deployment));
	}

	private handleResult(
		test: TestMetadata,
		result: TestResult,
		resource?: ResourceTestArgs,
		deployment?: DeploymentTestArgs
	): void {
		if (result !== undefined) {
			this.fails.push({
				test,
				resource,
				deployment,
				error: result,
			});
			if (this.failFast) {
				this.complete();
			}
		}
	}

	public validateResource(resource: ResourceTestArgs): void {
		if (this.done) return;
		this.asyncResourceTests.forEach((asyncTest) => {
			if (this.done) return;
			this.handleAsyncResolut(asyncTest, asyncTest.asyncValidateResource(resource), resource);
		});
		this.resourceTests.forEach((test) => {
			if (this.done) return;
			this.handleResult(test, test.validateResource(resource), resource);
		});
	}

	public validateDeployment(deployment: DeploymentTestArgs): void {
		if (this.done) return;
		this.initTests(this.delayedInstantiation);

		this.asyncDeploymentTests.forEach((asyncTest) => {
			if (this.done) return;
			this.handleAsyncResolut(
				asyncTest,
				asyncTest.asyncValidateDeployment(deployment),
				undefined,
				deployment
			);
		});
		this.deploymentTests.forEach((test) => {
			if (this.done) return;
			this.handleResult(test, test.validateDeployment(deployment), undefined, deployment);
		});

		Promise.all(this.pendingTests).then(() => this.complete());
	}

	public generateResourceOutput(resource: ResourceTestArgs): ResourceOutput {
		return this.outputGenerator.generateResourceOutput(this.runId, resource);
	}
}

export class TestCoordinator {
	public testClasses: TestClasses = [];

	public outputGenerator?: OutputGenerator;

	public readonly isReady: Promise<void>;

	constructor(private readonly config: TestCoordinatorConfig) {
		this.isReady = Promise.all([this.loadTestClasses(), this.loadOutputGenerator()]).then(
			() => undefined
		);
	}

	private async loadTestClasses(): Promise<void> {
		this.testClasses = await Promise.all(
			this.config.tests.map((moduleName) =>
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
					return {
						Ctor: TestClass,
						resourceTest: resTest,
						asyncResourceTest: asyncResTest,
						deploymentTest: deplTest,
						aysncDeploymentTest: asyncDeplTest,
						delayedInstantiation: !resTest && !asyncResTest,
					};
				})
			)
		);
	}

	private async loadOutputGenerator(): Promise<void> {
		this.outputGenerator = await import(this.config.outputGenerator).then(
			// eslint-disable-next-line new-cap
			(outputGeneratorModule) => new outputGeneratorModule.default()
		);
		if (!isOutputGenerator(this.outputGenerator))
			throw new Error(`Invalid output generator ${this.config.outputGenerator}`);
	}

	public newRunCoordinator(runId: number): TestRunCoordinator {
		if (!this.outputGenerator) throw new Error('Output generator not initialized');
		return new TestRunCoordinator(
			runId,
			this.testClasses,
			this.outputGenerator,
			this.config.failFast
		);
	}
}
