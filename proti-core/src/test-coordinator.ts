import type { Arbitrary } from 'fast-check';
import { is } from 'typia';
import type { TestCoordinatorConfig } from './config';
import type { Generator } from './generator';
import {
	type AsyncDeploymentOracle,
	type AsyncResourceOracle,
	type DeploymentOracle,
	type DeploymentOracleArgs,
	isAsyncDeploymentOracle,
	isAsyncResourceOracle,
	isDeploymentOracle,
	isResourceOracle,
	type ResourceOracle,
	type ResourceArgs,
	type Oracle,
	type OracleMetadata,
	type TestResult,
	type AbstractOracle,
} from './oracle';
import {
	getPluginInitFn,
	getPluginShutdownFn,
	type PluginArgs,
	type PluginShutdownFn,
} from './plugin';
import { createAppendOnlyArray, type DeepReadonly } from './utils';
import type { CheckResult } from './result';

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
		public readonly generatorArbitrary: Arbitrary<Generator>,
		public readonly oracles: DeepReadonly<Oracles>,
		public readonly pluginShutdownFns: readonly PluginShutdownFn[]
	) {}

	public static async create(
		config: TestCoordinatorConfig,
		pluginArgs: PluginArgs
	): Promise<TestCoordinator> {
		const generatorPlugin: any = await import(config.arbitrary);
		const oraclePlugins = await Promise.all(
			config.oracles.map(async (name) => [name, await import(name)] as [string, any])
		);
		const plugins = [generatorPlugin, ...oraclePlugins.map((o) => o[1])];
		// Initialize all plugins
		await Promise.all(
			plugins.map(getPluginInitFn).map((fn) => (fn ? fn(pluginArgs) : undefined))
		);

		return new TestCoordinator(
			this.initGeneratorArbitrary(config.arbitrary, generatorPlugin),
			this.initOracles(oraclePlugins),
			plugins.map(getPluginShutdownFn).filter((fn): fn is PluginShutdownFn => !!fn)
		);
	}

	private static initGeneratorArbitrary(name: string, plugin: any): Arbitrary<Generator> {
		const ArbitraryConstructor = plugin.default;
		const generatorArbitrary = new ArbitraryConstructor();
		if (!is<Arbitrary<Generator>>(generatorArbitrary))
			throw new Error(`Invalid test generator arbitrary ${name}`);
		return generatorArbitrary;
	}

	private static initOracles(oraclePlugins: readonly [string, any][]): Oracles {
		const oracles: Oracles = {
			resource: [],
			asyncResource: [],
			deployment: [],
			asyncDeployment: [],
		};
		oraclePlugins.forEach(([name, plugin]) => {
			const OracleConstructor = plugin.default;
			const oracle = new OracleConstructor();
			if (isResourceOracle(oracle)) oracles.resource.push(oracle);
			if (isAsyncResourceOracle(oracle)) oracles.asyncResource.push(oracle);
			if (isDeploymentOracle(oracle)) oracles.deployment.push(oracle);
			if (isAsyncDeploymentOracle(oracle)) oracles.asyncDeployment.push(oracle);
			if (!is<Oracle<unknown>>(oracle))
				throw new Error(`Configured oracle has invalid interface: ${name}`);
		});
		return oracles;
	}

	public newRunCoordinator(generator: Generator): TestRunCoordinator {
		if (!this.generatorArbitrary) throw new Error('Test generator not initialized');
		return new TestRunCoordinator(generator, this.oracles);
	}

	public async shutdown(result: CheckResult): Promise<void> {
		await Promise.all(this.pluginShutdownFns.map((fn) => fn(result)));
	}
}
