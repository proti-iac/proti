import * as pulumi from '@pulumi/pulumi';
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

	it('should type correctly', () => {
		gen<true>(true).with(fc.constant<true>(true));
		// @ts-expect-error
		gen<true>(true).with(fc.constant<false>(false));
		// @ts-expect-error
		gen<true>(true).with(fc.constant<boolean>(true));
		gen<boolean>(true).with(fc.constant<true>(true));
		gen<boolean>(true).with(fc.constant<false>(false));
		gen<boolean>(true).with(fc.constant<boolean>(true));
		gen<pulumi.Output<true>>(pulumi.output(true)).with(fc.constant<true>(true));
		// @ts-expect-error
		gen<pulumi.Output<true>>(pulumi.output(true)).with(fc.constant<false>(false));
		// @ts-expect-error
		gen<pulumi.Output<true>>(pulumi.output(true)).with(fc.constant<boolean>(true));
		gen<pulumi.Output<boolean>>(pulumi.output(true)).with(fc.constant<true>(true));
		gen<pulumi.Output<boolean>>(pulumi.output(true)).with(fc.constant<false>(false));
		gen<pulumi.Output<boolean>>(pulumi.output(true)).with(fc.constant<boolean>(true));
		gen<pulumi.Output<boolean>>(pulumi.output(true)).with(
			fc.constant<pulumi.Output<true>>(pulumi.output(true))
		);
		gen<pulumi.Output<boolean>>(pulumi.output(true)).with(
			fc.constant<pulumi.Output<false>>(pulumi.output(false))
		);
		gen<pulumi.Output<boolean>>(pulumi.output(true)).with(
			fc.constant<pulumi.Output<boolean>>(pulumi.output(true))
		);
	});
});
