import * as pulumi from '@pulumi/pulumi';
import * as fc from 'fast-check';
import { generate } from '../src/generator-syntax';

describe('generateerator syntax', () => {
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
			expect(generate(value).with(arb)).toBe(value);
			expect(neverCall).toBeCalledTimes(0);
		};
		fc.assert(fc.property(fc.anything(), pred));
	});

	it('should type correctly', () => {
		generate<true>(true).with(fc.constant<true>(true));
		// @ts-expect-error
		generate<true>(true).with(fc.constant<false>(false));
		// @ts-expect-error
		generate<true>(true).with(fc.constant<boolean>(true));
		generate<boolean>(true).with(fc.constant<true>(true));
		generate<boolean>(true).with(fc.constant<false>(false));
		generate<boolean>(true).with(fc.constant<boolean>(true));
		generate<pulumi.Output<true>>(pulumi.output(true)).with(fc.constant<true>(true));
		// @ts-expect-error
		generate<pulumi.Output<true>>(pulumi.output(true)).with(fc.constant<false>(false));
		// @ts-expect-error
		generate<pulumi.Output<true>>(pulumi.output(true)).with(fc.constant<boolean>(true));
		generate<pulumi.Output<boolean>>(pulumi.output(true)).with(fc.constant<true>(true));
		generate<pulumi.Output<boolean>>(pulumi.output(true)).with(fc.constant<false>(false));
		generate<pulumi.Output<boolean>>(pulumi.output(true)).with(fc.constant<boolean>(true));
		generate<pulumi.Output<boolean>>(pulumi.output(true)).with(
			fc.constant<pulumi.Output<true>>(pulumi.output(true))
		);
		generate<pulumi.Output<boolean>>(pulumi.output(true)).with(
			fc.constant<pulumi.Output<false>>(pulumi.output(false))
		);
		generate<pulumi.Output<boolean>>(pulumi.output(true)).with(
			fc.constant<pulumi.Output<boolean>>(pulumi.output(true))
		);
	});
});
