import * as fc from 'fast-check';
import {
	isAsyncResourceTest,
	isAsyncDeploymentTest,
	isResourceTest,
	isDeploymentTest,
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
});
