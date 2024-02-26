import * as fc from 'fast-check';
import type { Arbitrary } from 'fast-check';
import { assertEquals, is } from 'typia';
import type { PluginsConfig, TestCoordinatorConfig } from './config';
import type { Generator } from './generator';
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
	AbstractOracle,
} from './oracle';
import { createAppendOnlyArray, DeepReadonly } from './utils';

type Oracles = {
	resource: ResourceOracle<unknown>[];
	asyncResource: AsyncResourceOracle<unknown>[];
	deployment: DeploymentOracle<unknown>[];
	asyncDeployment: AsyncDeploymentOracle<unknown>[];
};

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

type OracleWithState<O extends AbstractOracle<S>, S = unknown> = readonly [O, S];
type UnpackArray<T> = T extends (infer U)[] ? U : never;

export class TestRunCoordinator {
	private readonly oracles: DeepReadonly<{
		[K in keyof Oracles]: readonly OracleWithState<UnpackArray<Oracles[K]>>[];
	}>;

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

	constructor(
		public readonly generator: Generator,
		oracles: DeepReadonly<Oracles>
	) {
		[this.fails, this.appendFail] = createAppendOnlyArray<Fail>();
		[this.pendingTests, this.appendPendingTest] = createAppendOnlyArray<Promise<TestResult>>();
		const toOracleWithState = <O extends AbstractOracle<S>, S>(
			oracle: O
		): OracleWithState<O, S> => [oracle, oracle.newRunState()];
		this.oracles = {
			resource: oracles.resource.map(toOracleWithState),
			asyncResource: oracles.asyncResource.map(toOracleWithState),
			deployment: oracles.deployment.map(toOracleWithState),
			asyncDeployment: oracles.asyncDeployment.map(toOracleWithState),
		};
		this.isDone = new Promise((resolve) => {
			this.complete = () => {
				this.done = true;
				resolve();
			};
		});
	}

	private handleAsyncResult(
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
		this.oracles.asyncResource.forEach(([oracle, state]) => {
			if (this.done) return;
			this.handleAsyncResult(oracle, oracle.asyncValidateResource(resource, state), resource);
		});
		this.oracles.resource.forEach(([oracle, state]) => {
			if (this.done) return;
			this.handleResult(oracle, oracle.validateResource(resource, state), resource);
		});
	}

	public validateDeployment(deployment: DeploymentOracleArgs): void {
		if (this.done) return;

		this.oracles.asyncDeployment.forEach(([oracle, state]) => {
			if (this.done) return;
			const result = oracle.asyncValidateDeployment(deployment, state);
			this.handleAsyncResult(oracle, result, undefined, deployment);
		});
		this.oracles.deployment.forEach(([oracle, state]) => {
			if (this.done) return;
			const result = oracle.validateDeployment(deployment, state);
			this.handleResult(oracle, result, undefined, deployment);
		});

		Promise.all(this.pendingTests).then(() => this.complete());
	}
}

export class TestCoordinator {
	private constructor(
		public readonly arbitrary: fc.Arbitrary<Generator>,
		public readonly oracles: DeepReadonly<Oracles>
	) {}

	public static async create(
		config: TestCoordinatorConfig,
		testModuleConfig: TestModuleConfig
	): Promise<TestCoordinator> {
		return new TestCoordinator(
			await this.loadArbitrary(config, testModuleConfig),
			await this.loadOracles(config, testModuleConfig)
		);
	}

	private static async initTestModule(
		module: any,
		testModuleConfig: TestModuleConfig
	): Promise<void> {
		if (typeof module.init === 'function')
			await assertEquals<TestModuleInitFn>(module.init)(testModuleConfig);
	}

	public static async loadOracles(
		config: TestCoordinatorConfig,
		testModuleConfig: TestModuleConfig
	): Promise<Oracles> {
		const oracles: Oracles = {
			resource: [],
			asyncResource: [],
			deployment: [],
			asyncDeployment: [],
		};
		await Promise.all(
			config.oracles.map(async (moduleName) => {
				const oracleModule = await import(moduleName);
				await this.initTestModule(oracleModule, testModuleConfig);
				const OracleConstructor = oracleModule.default;
				const oracle = new OracleConstructor();

				if (isResourceOracle(oracle)) oracles.resource.push(oracle);
				if (isAsyncResourceOracle(oracle)) oracles.asyncResource.push(oracle);
				if (isDeploymentOracle(oracle)) oracles.deployment.push(oracle);
				if (isAsyncDeploymentOracle(oracle)) oracles.asyncDeployment.push(oracle);
				if (!is<Oracle<unknown>>(oracle))
					throw new Error(`Configured oracle has invalid interface: ${moduleName}`);
			})
		);
		return oracles;
	}

	public static async loadArbitrary(
		config: TestCoordinatorConfig,
		testModuleConfig: TestModuleConfig
	): Promise<Arbitrary<Generator>> {
		const generatorArbitraryModule = await import(config.arbitrary);
		await this.initTestModule(generatorArbitraryModule, testModuleConfig);
		const ArbitraryConstructor = generatorArbitraryModule.default;
		const arbitrary = new ArbitraryConstructor();
		if (!is<fc.Arbitrary<Generator>>(arbitrary))
			throw new Error(`Invalid test generator arbitrary ${config.arbitrary}`);
		return arbitrary;
	}

	public newRunCoordinator(generator: Generator): TestRunCoordinator {
		if (!this.arbitrary) throw new Error('Test generator not initialized');
		return new TestRunCoordinator(generator, this.oracles);
	}
}
