import * as fc from 'fast-check';
import * as ps from '../src/index';

describe('oracle syntax', () => {
	it('should pass through values', () => {
		const pred = (value: any) => {
			const validator = jest.fn();
			expect(ps.expect(value).to(validator)).toBe(value);
			expect(validator).toBeCalledTimes(0);
		};
		fc.assert(fc.property(fc.anything(), pred));
	});

	it('should type correctly', () => {
		// @ts-expect-error
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		ps.expect(true).to((v: false) => false);
		// @ts-expect-error
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		ps.expect(true).to((v: true) => false);
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		ps.expect(true).to((v: boolean) => false);
		// @ts-expect-error
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		ps.expect<true>(true).to((v: false) => false);
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		ps.expect<true>(true).to((v: true) => false);
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		ps.expect<true>(true).to((v: boolean) => false);
		// @ts-expect-error
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		ps.expect<boolean>(true).to((v: false) => false);
		// @ts-expect-error
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		ps.expect<boolean>(true).to((v: true) => false);
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		ps.expect<boolean>(true).to((v: boolean) => false);
	});
});
