import { TestCoordinatorConfig } from './config';
import { isTest, Test } from './tests';

export class TestCoordinator {
	public readonly testClasses: { new (): Test }[] = [];

	public readonly isReady: Promise<void>;

	constructor(private readonly config: TestCoordinatorConfig) {
		this.isReady = this.loadTestClasses();
	}

	private async loadTestClasses(): Promise<void> {
		const tests = this.config.tests.map((moduleName) =>
			import(moduleName).then((testModule) => {
				const TestClass = testModule.default;
				if (!isTest(new TestClass()))
					throw new Error(`Configured test has invalid interface: ${moduleName}`);
				this.testClasses.push(TestClass);
			})
		);
		return Promise.all(tests).then(() => {});
	}
}
