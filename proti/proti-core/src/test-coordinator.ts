import * as fc from 'fast-check';
import type { Arbitrary } from 'fast-check';
import { assertEquals, is } from 'typia';
import type { PluginsConfig, TestCoordinatorConfig } from './config';
import type { Generator, ResourceOutput } from './generator';
import type { ModuleLoader } from './module-loader';
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
	ResourceArgs,
	Oracle,
	OracleMetadata,
	TestResult,
} from './oracle';
import { createAppendOnlyArray, DeepReadonly } from './utils';

type OracleClass = DeepReadonly<{
	Ctor: { new (): Oracle };
	isResourceOracle: boolean;
	isAsyncResourceOracle: boolean;
	isDeploymentOracle: boolean;
	isAsyncDeploymentOracle: boolean;
	delayedInstantiation: boolean;
}>;
type OracleClasses = ReadonlyArray<OracleClass>;

type Fail = DeepReadonly<{
	oracle: OracleMetadata;
	deployment?: DeploymentOracleArgs;
	resource?: ResourceArgs;
	error: Error;
}>;

export type TestModuleConfig = Readonly<{
	readonly testPath: string;
	readonly cacheDir: string;
	readonly moduleLoader: ModuleLoader;
	readonly pluginsConfig: PluginsConfig;
}>;
export type TestModuleInitFn = (config: TestModuleConfig) => Promise<void>;

export class TestRunCoordinator {
	private readonly oracles: DeepReadonly<{
		resource: ResourceOracle[];
		asyncResource: AsyncResourceOracle[];
		deployment: DeploymentOracle[];
		asyncDeployment: AsyncDeploymentOracle[];
	}>;

	private readonly delayedInstantiation: OracleClasses;

	public readonly fails: ReadonlyArray<Fail>;

	private readonly appendFail: (fail: Fail) => void;

	private readonly pendingTests: ReadonlyArray<Promise<TestResult>>;

	private readonly appendPendingTest: (pendingTest: Promise<TestResult>) => void;

	// eslint-disable-next-line class-methods-use-this
	private complete: () => void = () => {
		throw new Error('Test run coordinator completed before completing initialization');
	};

	private done: boolean = false;

	public readonly isDone: Promise<void>;

	constructor(private readonly generator: Generator, oracleClasses: OracleClasses) {
		[this.fails, this.appendFail] = createAppendOnlyArray<Fail>();
		[this.pendingTests, this.appendPendingTest] = createAppendOnlyArray<Promise<TestResult>>();
		const delayedInstantiation: OracleClass[] = [];
		const directInstantiation = oracleClasses.filter((oracleClass) => {
			if (oracleClass.delayedInstantiation) delayedInstantiation.push(oracleClass);
			return !oracleClass.delayedInstantiation;
		});
		this.delayedInstantiation = delayedInstantiation;
		this.oracles = this.initOracles(directInstantiation);
		this.isDone = new Promise((resolve) => {
			this.complete = () => {
				this.done = true;
				resolve();
			};
		});
	}

	private initOracles(testClasses: OracleClasses): typeof this.oracles {
		const oracles = {
			resource: [] as ResourceOracle[],
			asyncResource: [] as AsyncResourceOracle[],
			deployment: [] as DeploymentOracle[],
			asyncDeployment: [] as AsyncDeploymentOracle[],
		};
		testClasses.forEach((oracle) => {
			const test = new oracle.Ctor();
			if (oracle.isResourceOracle) oracles.resource.push(test as ResourceOracle);
			if (oracle.isAsyncResourceOracle)
				oracles.asyncResource.push(test as AsyncResourceOracle);
			if (oracle.isDeploymentOracle) oracles.deployment.push(test as DeploymentOracle);
			if (oracle.isAsyncDeploymentOracle)
				oracles.asyncDeployment.push(test as AsyncDeploymentOracle);
		});
		return oracles;
	}

	private handleAsyncResolut(
		test: OracleMetadata,
		asyncResult: Promise<TestResult>,
		resource?: ResourceArgs,
		deployment?: DeploymentOracleArgs
	): void {
		this.appendPendingTest(asyncResult);
		asyncResult.then((result) => this.handleResult(test, result, resource, deployment));
	}

	private handleResult(
		test: OracleMetadata,
		result: TestResult,
		resource?: ResourceArgs,
		deployment?: DeploymentOracleArgs
	): void {
		if (result !== undefined) {
			this.appendFail({
				oracle: test,
				resource,
				deployment,
				error: result,
			});
			this.complete();
		}
	}

	public validateResource(resource: ResourceArgs): void {
		if (this.done) return;
		this.oracles.asyncResource.forEach((oracle) => {
			if (this.done) return;
			this.handleAsyncResolut(oracle, oracle.asyncValidateResource(resource), resource);
		});
		this.oracles.resource.forEach((oracle) => {
			if (this.done) return;
			this.handleResult(oracle, oracle.validateResource(resource), resource);
		});
	}

	public validateDeployment(deployment: DeploymentOracleArgs): void {
		if (this.done) return;
		this.initOracles(this.delayedInstantiation);

		this.oracles.asyncDeployment.forEach((oracle) => {
			if (this.done) return;
			this.handleAsyncResolut(
				oracle,
				oracle.asyncValidateDeployment(deployment),
				undefined,
				deployment
			);
		});
		this.oracles.deployment.forEach((oracle) => {
			if (this.done) return;
			this.handleResult(oracle, oracle.validateDeployment(deployment), undefined, deployment);
		});

		Promise.all(this.pendingTests).then(() => this.complete());
	}

	public generateResourceOutput(resource: ResourceArgs): Promise<ResourceOutput> {
		return this.generator.generateResourceOutput(resource);
	}
}

export class TestCoordinator {
	public readonly oracles: Promise<OracleClasses>;

	public readonly arbitrary: Promise<fc.Arbitrary<Generator>>;

	constructor(
		private readonly config: TestCoordinatorConfig,
		private readonly testModuleConfig: TestModuleConfig
	) {
		this.oracles = this.loadOracles();
		this.arbitrary = this.loadArbitrary();
	}

	private async initTestModule(module: any): Promise<void> {
		if (typeof module.init === 'function')
			await assertEquals<TestModuleInitFn>(module.init)(this.testModuleConfig);
	}

	private loadOracles(): Promise<OracleClasses> {
		const oracleClasses = this.config.oracles.map(async (moduleName) => {
			const oracleModule = await import(moduleName);
			await this.initTestModule(oracleModule);
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
				delayedInstantiation: !isOracle.isResourceOracle && !isOracle.isAsyncResourceOracle,
			};
		});
		return Promise.all(oracleClasses);
	}

	private async loadArbitrary(): Promise<Arbitrary<Generator>> {
		const generatorArbitraryModule = await import(this.config.arbitrary);
		if (!is<fc.Arbitrary<Generator>>(this.arbitrary))
			throw new Error(`Invalid test generator arbitrary ${this.config.arbitrary}`);
		await this.initTestModule(generatorArbitraryModule);
		const ArbitraryConstructor = generatorArbitraryModule.default;
		return new ArbitraryConstructor();
	}

	public async newRunCoordinator(generator: Generator): Promise<TestRunCoordinator> {
		if (!this.arbitrary) throw new Error('Test generator not initialized');
		return new TestRunCoordinator(generator, await this.oracles);
	}
}
