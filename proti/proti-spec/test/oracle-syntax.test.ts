import * as fc from 'fast-check';
import * as ps from '../src/oracle-syntax';

describe('oracle syntax', () => {
	it('should pass through values', () => {
		const pred = (value: any) => {
			const validator = jest.fn();
			expect(ps.expect(value).to(validator)).toBe(value);
			expect(validator).toBeCalledTimes(0);
		};
		fc.assert(fc.property(fc.anything(), pred));
	});
});
