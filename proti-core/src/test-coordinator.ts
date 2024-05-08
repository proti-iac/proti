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
	type TestResult,
} from './oracle';
import {
	type GeneratorPlugin,
	isGeneratorPlugin,
	isOraclePlugin,
	isPluginWithInitFn,
	isPluginWithShutdownFn,
	type Plugin,
	type PluginArgs,
	type PluginInitFn,
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
	oracle: Oracle<unknown>;
	deployment?: DeploymentOracleArgs;
	resource?: ResourceArgs;
	error: Error;
}>;

type OracleWithState<O extends Oracle<S>, S = unknown> = readonly [O, S];
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
		const toOracleWithState = <O extends Oracle<S>, S>(oracle: O): OracleWithState<O, S> => [
			oracle,
			oracle.newRunState(),
		];
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
		oracle: Oracle<unknown>,
		asyncResult: Promise<TestResult>,
		resource?: ResourceArgs,
		deployment?: DeploymentOracleArgs
	): void {
		this.appendPendingTest(asyncResult);
		asyncResult.then((result) => this.handleResult(oracle, result, resource, deployment));
	}

	private handleResult(
		oracle: Oracle<unknown>,
		result: TestResult,
		resource?: ResourceArgs,
		deployment?: DeploymentOracleArgs
	): void {
		if (result !== undefined) {
			this.appendFail({
				oracle,
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
	private readonly plugins: readonly Plugin[];

	public readonly pluginInitFns: readonly PluginInitFn[];

	public readonly pluginShutdownFns: readonly PluginShutdownFn[];

	private constructor(
		private readonly pluginArgs: PluginArgs,
		public readonly generatorPlugin: GeneratorPlugin,
		public readonly oraclePlugins: DeepReadonly<Oracles>
	) {
		const plugins: Plugin[] = [this.generatorPlugin];
		Object.values(this.oraclePlugins).forEach((os) =>
			plugins.push(...os.filter((o) => !plugins.includes(o)))
		);
		this.plugins = plugins;
		this.pluginInitFns = this.plugins.filter(isPluginWithInitFn).map((p) => p.init);
		this.pluginShutdownFns = this.plugins.filter(isPluginWithShutdownFn).map((p) => p.shutdown);
	}

	public static async create(
		config: TestCoordinatorConfig,
		pluginArgs: PluginArgs
	): Promise<TestCoordinator> {
		return new TestCoordinator(
			pluginArgs,
			await this.loadGeneratorPlugin(config.generator),
			await this.loadOraclePlugins(config.oracles)
		);
	}

	private static async loadGeneratorPlugin(module: string): Promise<GeneratorPlugin> {
		const GeneratorPluginConstructor = (await import(module)).default;
		const generatorPlugin = new GeneratorPluginConstructor();
		if (!isGeneratorPlugin(generatorPlugin))
			throw new Error(`Invalid test generator plugin ${module}`);
		return generatorPlugin;
	}

	private static async loadOraclePlugins(modules: readonly string[]): Promise<Oracles> {
		const oraclePlugins: Oracles = {
			resource: [],
			asyncResource: [],
			deployment: [],
			asyncDeployment: [],
		};
		await Promise.all(
			modules.map(async (module) => {
				const OraclePluginConstructor = (await import(module)).default;
				const oracle = new OraclePluginConstructor();
				if (isResourceOracle(oracle)) oraclePlugins.resource.push(oracle);
				if (isAsyncResourceOracle(oracle)) oraclePlugins.asyncResource.push(oracle);
				if (isDeploymentOracle(oracle)) oraclePlugins.deployment.push(oracle);
				if (isAsyncDeploymentOracle(oracle)) oraclePlugins.asyncDeployment.push(oracle);
				if (!isOraclePlugin(oracle))
					throw new Error(`Configured oracle has invalid interface: ${module}`);
			})
		);
		return oraclePlugins;
	}

	public newRunCoordinator(generator: Generator): TestRunCoordinator {
		if (!this.generatorPlugin) throw new Error('Test generator not initialized');
		return new TestRunCoordinator(generator, this.oraclePlugins);
	}

	public async init(): Promise<void> {
		await Promise.all(this.pluginInitFns.map((fn) => fn(this.pluginArgs)));
	}

	public async shutdown(result: CheckResult): Promise<void> {
		await Promise.all(this.pluginShutdownFns.map((fn) => fn(result)));
	}
}
