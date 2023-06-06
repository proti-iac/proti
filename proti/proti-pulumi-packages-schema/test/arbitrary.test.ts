import * as fc from 'fast-check';
import type { RandomGenerator } from 'pure-rand';
import type { ResourceOutput } from '@proti/core';
import { PulumiPackagesSchemaGenerator, resourceOutputTraceToString } from '../src/arbitrary';
import { defaultArbitraryConfig } from '../src/config';
import { SchemaRegistry } from '../src/schema-registry';

jest.mock('fast-check');
(fc.Random as unknown as jest.Mock).mockImplementation(() => jest.fn());
jest.mock('../src/schema-registry', () => ({
	SchemaRegistry: {
		getInstance: jest.fn(),
	},
}));

describe('resource output trace to string', () => {
	const res = { id: 'a', state: {} };
	it.each([
		['empty trace', [], ''],
		['single resource with empty state', [res], '0: a'],
		[
			'single resource with state',
			[{ id: 'a', state: { b: 'c', d: 2 } }],
			'0: a\n   - b: "c"\n   - d: 2',
		],
		[
			'multiple resource with state',
			[res, { id: 'b', state: { c: false } }, res, res, res, res, res, res, res, res, res],
			' 0: a\n 1: b\n    - c: false\n 2: a\n 3: a\n 4: a\n 5: a\n 6: a\n 7: a\n 8: a\n 9: a\n10: a',
		],
	] as [string, ReadonlyArray<ResourceOutput>, string][])(
		'should correctly format %s',
		(_, trace, result) => {
			expect(resourceOutputTraceToString(trace)).toBe(result);
		}
	);
});

describe('pulumi packages schema generator', () => {
	const conf = defaultArbitraryConfig();
	const registry: SchemaRegistry = SchemaRegistry.getInstance();
	const rng: fc.Random = new fc.Random(undefined as unknown as RandomGenerator);

	it('should instantiate', () => {
		expect(
			() => new PulumiPackagesSchemaGenerator(conf, registry, rng, undefined)
		).not.toThrow();
	});
});
