import {
	DeploymentTest,
	isDeploymentTest,
	isResourceTest,
	isTest,
	ResourceTest,
} from '../src/tests';

const empty = {};
const resourceTest = new (class extends ResourceTest {
	testName = 'resource test';

	description = undefined;

	// eslint-disable-next-line class-methods-use-this
	validateResource = () => {};
})();
const deploymentTest = new (class extends DeploymentTest {
	testName = 'resource test';

	description = undefined;

	// eslint-disable-next-line class-methods-use-this
	validateDeployment = () => {};
})();

describe('resource test type guard', () => {
	it.each([
		['deny empty', empty, false],
		['confirm resource test', resourceTest, true],
		['deny deployment test', deploymentTest, false],
	])('should %s', (_, obj, result) => expect(isResourceTest(obj)).toBe(result));
});

describe('deployment test type guard', () => {
	it.each([
		['deny empty', empty, false],
		['deny resource test', resourceTest, false],
		['confirm deployment test', deploymentTest, true],
	])('should %s', (_, obj, result) => expect(isDeploymentTest(obj)).toBe(result));
});

describe('test type guard', () => {
	it.each([
		['deny empty', empty, false],
		['confirm resource test', resourceTest, true],
		['confirm deployment test', deploymentTest, true],
	])('should %s', (_, obj, result) => expect(isTest(obj)).toBe(result));
});
