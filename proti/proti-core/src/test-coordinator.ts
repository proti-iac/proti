import * as fc from 'fast-check';
import { Arbitrary } from 'fast-check';
import { assertEquals, is } from 'typia';
import { PluginsConfig, TestCoordinatorConfig } from './config';
import { Generator, ResourceOutput } from './generator';
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

export type TestModuleInitFn = (pluginsConfig: PluginsConfig, cacheDir: string) => Promise<void>;

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

	constructor(private readonly generator: Generator, oracleClasses: OracleClasses) {
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
			this.complete();
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
		return this.generator.generateResourceOutput(resource);
	}
}

export class TestCoordinator {
	public readonly oracles: Promise<OracleClasses>;

	public readonly arbitrary: Promise<fc.Arbitrary<Generator>>;

	constructor(
		private readonly config: TestCoordinatorConfig,
		private readonly pluginsConfig: PluginsConfig,
		private readonly cacheDir: string
	) {
		this.oracles = this.loadOracles();
		this.arbitrary = this.loadArbitrary();
	}

	private async loadOracles(): Promise<OracleClasses> {
		return Promise.all(
			this.config.oracles.map((moduleName) =>
				import(moduleName).then(async (oracleModule): Promise<OracleClass> => {
					// If the module exports an `init` function, call it initilize it.
					if (typeof oracleModule.init === 'function')
						await assertEquals<TestModuleInitFn>(oracleModule.init)(
							this.pluginsConfig,
							this.cacheDir
						);
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

	private async loadArbitrary(): Promise<Arbitrary<Generator>> {
		return import(this.config.arbitrary).then(async (generatorArbitraryModule) => {
			if (!is<fc.Arbitrary<Generator>>(this.arbitrary))
				throw new Error(`Invalid test generator arbitrary ${this.config.arbitrary}`);
			// If the module exports an `init` function, call it initilize it.
			if (typeof generatorArbitraryModule.init === 'function')
				await assertEquals<TestModuleInitFn>(generatorArbitraryModule.init)(
					this.pluginsConfig,
					this.cacheDir
				);
			return generatorArbitraryModule.default;
		});
	}

	public async newRunCoordinator(generator: Generator): Promise<TestRunCoordinator> {
		if (!this.arbitrary) throw new Error('Test generator not initialized');
		return new TestRunCoordinator(generator, await this.oracles);
	}
}
