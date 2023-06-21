import * as fc from 'fast-check';
import {
	isAsyncResourceOracle,
	isAsyncDeploymentOracle,
	isResourceOracle,
	isDeploymentOracle,
	isOracle,
} from '../src/oracle';

describe('type guards', () => {
	const oracleArb = fc.record(
		{
			name: fc.string(),
			description: fc.string(),
			validateResource: fc.constant(() => {}),
			asyncValidateResource: fc.constant(() => {}),
			validateDeployment: fc.constant(() => {}),
			asyncValidateDeployment: fc.constant(() => {}),
			newRunState: fc.constant(() => {}),
		},
		{ requiredKeys: ['name', 'newRunState'] }
	);

	it.each([
		['resource oracle', isResourceOracle, 'validateResource'],
		['async resource oracle', isAsyncResourceOracle, 'asyncValidateResource'],
		['deployment oracle', isDeploymentOracle, 'validateDeployment'],
		['async deployment oracle', isAsyncDeploymentOracle, 'asyncValidateDeployment'],
	])('should identify %s', (_, typeGuard, prop) => {
		fc.assert(
			fc.property(oracleArb, (oracle) => {
				expect(typeGuard(oracle)).toBe(prop in oracle);
			})
		);
	});

	it('should identify oracle', () => {
		fc.assert(
			fc.property(oracleArb, (oracle) => {
				expect(isOracle(oracle)).toBe(
					'validateResource' in oracle ||
						'asyncValidateResource' in oracle ||
						'validateDeployment' in oracle ||
						'asyncValidateDeployment' in oracle
				);
			})
		);
	});

	it('should not identify oracle', () => {
		expect(isOracle({ testName: 'a' })).toBe(false);
	});
});
