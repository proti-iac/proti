import { TestCoordinatorConfig } from './config';
import { isGenerator, Generator, ResourceOutput } from './generator';
import {
	AsyncDeploymentOracle,
	AsyncResourceOracle,
	DeploymentOracle,
	DeploymentOracleArgs,
	isAsyncDeploymentOracle,
	isAsyncResourceOracle,
	isDeploymentOracle,
	isResourceOracle,
	ResourceOracle,
	ResourceOracleArgs,
	Oracle,
	OracleMetadata,
	TestResult,
} from './oracle';

type OracleClass = {
	Ctor: { new (): Oracle };
	isResourceOracle: boolean;
	isAsyncResourceOracle: boolean;
	isDeploymentOracle: boolean;
	isAsyncDeploymentOracle: boolean;
	delayedInstantiation: boolean;
};
type OracleClasses = OracleClass[];

type Fail = {
	oracle: OracleMetadata;
	deployment?: DeploymentOracleArgs;
	resource?: ResourceOracleArgs;
	error: Error;
};

export class TestRunCoordinator {
	private readonly resourceOracles: ResourceOracle[] = [];

	private readonly asyncResourceOracles: AsyncResourceOracle[] = [];

	private readonly deploymentOracles: DeploymentOracle[] = [];

	private readonly asyncDeploymentOracles: AsyncDeploymentOracle[] = [];

	private readonly delayedInstantiation: OracleClasses = [];

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
		oracleClasses: OracleClasses,
		private readonly generator: Generator,
		private readonly failFast: boolean
	) {
		const directInstantiation = oracleClasses.filter((oracleClass) => {
			if (oracleClass.delayedInstantiation) this.delayedInstantiation.push(oracleClass);
			return !oracleClass.delayedInstantiation;
		});
		this.initTests(directInstantiation);
		this.isDone = new Promise((resolve) => {
			this.complete = () => {
				this.done = true;
				resolve();
			};
		});
	}

	private initTests(testClasses: OracleClasses): void {
		testClasses.forEach((oracle) => {
			const test = new oracle.Ctor();
			if (oracle.isResourceOracle) this.resourceOracles.push(test as ResourceOracle);
			if (oracle.isAsyncResourceOracle)
				this.asyncResourceOracles.push(test as AsyncResourceOracle);
			if (oracle.isDeploymentOracle) this.deploymentOracles.push(test as DeploymentOracle);
			if (oracle.isAsyncDeploymentOracle)
				this.asyncDeploymentOracles.push(test as AsyncDeploymentOracle);
		});
	}

	private handleAsyncResolut(
		test: OracleMetadata,
		asyncResult: Promise<TestResult>,
		resource?: ResourceOracleArgs,
		deployment?: DeploymentOracleArgs
	): void {
		this.pendingTests.push(asyncResult);
		asyncResult.then((result) => this.handleResult(test, result, resource, deployment));
	}

	private handleResult(
		test: OracleMetadata,
		result: TestResult,
		resource?: ResourceOracleArgs,
		deployment?: DeploymentOracleArgs
	): void {
		if (result !== undefined) {
			this.fails.push({
				oracle: test,
				resource,
				deployment,
				error: result,
			});
			if (this.failFast) {
				this.complete();
			}
		}
	}

	public validateResource(resource: ResourceOracleArgs): void {
		if (this.done) return;
		this.asyncResourceOracles.forEach((oracle) => {
			if (this.done) return;
			this.handleAsyncResolut(oracle, oracle.asyncValidateResource(resource), resource);
		});
		this.resourceOracles.forEach((oracle) => {
			if (this.done) return;
			this.handleResult(oracle, oracle.validateResource(resource), resource);
		});
	}

	public validateDeployment(deployment: DeploymentOracleArgs): void {
		if (this.done) return;
		this.initTests(this.delayedInstantiation);

		this.asyncDeploymentOracles.forEach((oracle) => {
			if (this.done) return;
			this.handleAsyncResolut(
				oracle,
				oracle.asyncValidateDeployment(deployment),
				undefined,
				deployment
			);
		});
		this.deploymentOracles.forEach((oracle) => {
			if (this.done) return;
			this.handleResult(oracle, oracle.validateDeployment(deployment), undefined, deployment);
		});

		Promise.all(this.pendingTests).then(() => this.complete());
	}

	public generateResourceOutput(resource: ResourceOracleArgs): ResourceOutput {
		return this.generator.generateResourceOutput(this.runId, resource);
	}
}

export class TestCoordinator {
	public oracles: OracleClasses = [];

	public generator?: Generator;

	public readonly isReady: Promise<void>;

	constructor(private readonly config: TestCoordinatorConfig, seed: number) {
		this.isReady = Promise.all([this.loadOracles(), this.loadGenerator(seed)]).then(
			() => undefined
		);
	}

	private async loadOracles(): Promise<void> {
		this.oracles = await Promise.all(
			this.config.oracles.map((moduleName) =>
				import(moduleName).then((oracleModule): OracleClass => {
					const OracleConstructor = oracleModule.default;
					const oracle = new OracleConstructor();
					const isOracle = {
						isAsyncDeploymentOracle: isAsyncDeploymentOracle(oracle),
						isAsyncResourceOracle: isAsyncResourceOracle(oracle),
						isDeploymentOracle: isDeploymentOracle(oracle),
						isResourceOracle: isResourceOracle(oracle),
					};
					if (Object.values(isOracle).every((b) => b === false))
						throw new Error(`Configured oracle has invalid interface: ${moduleName}`);
					return {
						Ctor: OracleConstructor,
						...isOracle,
						delayedInstantiation:
							!isOracle.isResourceOracle && !isOracle.isAsyncResourceOracle,
					};
				})
			)
		);
	}

	private async loadGenerator(seed: number): Promise<void> {
		this.generator = await import(this.config.generator).then(
			// eslint-disable-next-line new-cap
			(generatorModule) => new generatorModule.default(seed)
		);
		if (!isGenerator(this.generator))
			throw new Error(`Invalid test generator ${this.config.generator}`);
	}

	public newRunCoordinator(runId: number): TestRunCoordinator {
		if (!this.generator) throw new Error('Test generator not initialized');
		return new TestRunCoordinator(runId, this.oracles, this.generator, this.config.failFast);
	}
}
