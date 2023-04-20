import { TestCoordinatorConfig } from './config';
import { isOutputGenerator, OutputGenerator, ResourceOutput } from './output-generator';
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
		private readonly outputGenerator: OutputGenerator,
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
		return this.outputGenerator.generateResourceOutput(this.runId, resource);
	}
}

export class TestCoordinator {
	public oracles: OracleClasses = [];

	public outputGenerator?: OutputGenerator;

	public readonly isReady: Promise<void>;

	constructor(private readonly config: TestCoordinatorConfig, seed: number) {
		this.isReady = Promise.all([this.loadOracles(), this.loadOutputGenerator(seed)]).then(
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

	private async loadOutputGenerator(seed: number): Promise<void> {
		this.outputGenerator = await import(this.config.outputGenerator).then(
			// eslint-disable-next-line new-cap
			(outputGeneratorModule) => new outputGeneratorModule.default(seed)
		);
		if (!isOutputGenerator(this.outputGenerator))
			throw new Error(`Invalid output generator ${this.config.outputGenerator}`);
	}

	public newRunCoordinator(runId: number): TestRunCoordinator {
		if (!this.outputGenerator) throw new Error('Output generator not initialized');
		return new TestRunCoordinator(
			runId,
			this.oracles,
			this.outputGenerator,
			this.config.failFast
		);
	}
}
