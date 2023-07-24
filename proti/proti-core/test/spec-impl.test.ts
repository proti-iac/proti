import * as fc from 'fast-check';
import { specImpl } from '../src/spec-impl';

describe('ad-hoc spec implementation', () => {
	it('expect to', () => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const predicate = async (value: any, sync: boolean, result: boolean, reject: boolean) => {
			const pred = jest.fn();
			pred.mockReturnValue(
				sync ? true : Promise.resolve(true)
				// eslint-disable-next-line no-nested-ternary
				// sync ? result : reject ? Promise.reject(result) : Promise.resolve(result)
			);
			expect(specImpl.expect(value).to(pred)).toBe(value);
			expect(pred).toBeCalledTimes(1);
			await new Promise(setImmediate);
			// @TODO test error cases, i.e., reject and result == false
		};
		return fc.assert(
			fc.asyncProperty(fc.anything(), fc.boolean(), fc.boolean(), fc.boolean(), predicate)
		);
	});
});
