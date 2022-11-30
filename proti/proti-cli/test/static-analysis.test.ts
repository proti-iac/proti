import { Set } from 'immutable';
import { findImports } from '../src/static-analysis';

describe('static analysis', () => {
	describe('find imports', () => {
		it('should work', () => {
			expect(findImports(`${__dirname}/empty-ts-modules/src/d.ts`)).toStrictEqual(
				Set(['/a', './b', 'c'])
			);
		});
	});
});
