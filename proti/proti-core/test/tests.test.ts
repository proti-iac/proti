import * as fc from 'fast-check';
import {
	isAsyncResourceTest,
	isAsyncDeploymentTest,
	isResourceTest,
	isDeploymentTest,
	isTest,
} from '../src/tests';

describe('type guards', () => {
	const testArb = fc.record(
		{
			testName: fc.string(),
			description: fc.string(),
			validateResource: fc.constant(() => {}),
			asyncValidateResource: fc.constant(() => {}),
			validateDeployment: fc.constant(() => {}),
			asyncValidateDeployment: fc.constant(() => {}),
		},
		{ requiredKeys: ['testName'] }
	);

	it.each([
		['resource test', isResourceTest, 'validateResource'],
		['async resource test', isAsyncResourceTest, 'asyncValidateResource'],
		['deployment test', isDeploymentTest, 'validateDeployment'],
		['async deployment test', isAsyncDeploymentTest, 'asyncValidateDeployment'],
	])('should identify %s', (_, testTypeGuard, prop) => {
		fc.assert(
			fc.property(testArb, (test) => {
				expect(testTypeGuard(test)).toBe(prop in test);
			})
		);
	});

	it('should identify test', () => {
		fc.assert(
			fc.property(testArb, (test) => {
				expect(isTest(test)).toBe(
					'validateResource' in test ||
						'asyncValidateResource' in test ||
						'validateDeployment' in test ||
						'asyncValidateDeployment' in test
				);
			})
		);
	});

	it('should not identify test', () => {
		expect(isTest({ testName: 'a' })).toBe(false);
	});
});
