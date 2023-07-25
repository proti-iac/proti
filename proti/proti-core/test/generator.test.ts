import { type Generated, generatorTraceToString } from '../src/generator';

describe('trace generator to string', () => {
	const res = { id: 'a', state: {} };
	it.each([
		['empty trace', [], ''],
		['single resource with empty state', [res], '0: a'],
		[
			'single resource with state',
			[{ id: 'a', state: { b: 'c', d: 2 } }],
			'0: a\n   - b: "c"\n   - d: 2',
		],
		['single empty value', [{ id: 'e', value: undefined }], '0: e\n   - undefined'],
		['single value', [{ id: 'e', value: ['f', 'g', 3] }], '0: e\n   - ["f","g",3]'],
		[
			'multiple resources with state',
			[res, { id: 'b', state: { c: false } }, res, res, res, res, res, res, res, res, res],
			' 0: a\n 1: b\n    - c: false\n 2: a\n 3: a\n 4: a\n 5: a\n 6: a\n 7: a\n 8: a\n 9: a\n10: a',
		],
		[
			'multiple resources and values',
			[res, res, { id: 'e', value: true }, res, { id: 'e', value: ['f', 'g', 3] }],
			'0: a\n1: a\n2: e\n   - true\n3: a\n4: e\n   - ["f","g",3]',
		],
	] as [string, readonly Generated[], string][])(
		'should correctly format %s',
		(_, trace, result) => {
			expect(generatorTraceToString(trace)).toBe(result);
		}
	);
});
