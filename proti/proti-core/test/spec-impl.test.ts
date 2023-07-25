import * as fc from 'fast-check';
import { createSpecImpl } from '../src/spec-impl';
import { Generator } from '../src/generator';

describe('ad-hoc oracle specification implementation', () => {
	const specImpl = createSpecImpl(jest.mocked<Generator>({} as Generator));
	it('should work', () => {
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

describe('ad-hoc generator specification implementation', () => {
	const generateValue = jest.fn();
	const specImpl = createSpecImpl(
		jest.mocked<Generator>({ generateValue } as unknown as Generator)
	);
	it('should work', () => {
		const predicate = (value: any, genValue: any) => {
			generateValue.mockReset();
			generateValue.mockReturnValue(genValue);
			const arb = fc.constant(genValue);
			expect(specImpl.generate(value).with(arb)).toBe(genValue);
			const idMatch = expect.stringMatching(/^ad-hoc-oracle::.*spec-impl.test.ts:\d+:\d+$/);
			expect(generateValue).toBeCalledWith(idMatch, arb);
		};
		fc.assert(fc.property(fc.anything(), fc.anything(), predicate));
	});
});
