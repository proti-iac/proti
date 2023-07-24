import * as fc from 'fast-check';
import { gen } from '../src/generator-syntax';

describe('generator syntax', () => {
	it('should pass through values', () => {
		const pred = (value: any) => {
			const neverCall = jest.fn();
			const arb: fc.Arbitrary<any> = {
				canShrinkWithoutContext: (v): v is any => {
					throw neverCall();
				},
				chain: neverCall,
				filter: neverCall,
				generate: neverCall,
				map: neverCall,
				noBias: neverCall,
				noShrink: neverCall,
				shrink: neverCall,
			};
			expect(gen(value).with(arb)).toBe(value);
			expect(neverCall).toBeCalledTimes(0);
		};
		fc.assert(fc.property(fc.anything(), pred));
	});
});
