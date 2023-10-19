import * as fc from 'fast-check';

import { UniqueUrnsOracle } from '../../src/oracles/unique-urns-oracle';

describe('unique URNs oracle', () => {
	it('should not fail on unique strings in separate runs', () => {
		const predicate = (urns: string[]) => {
			const test = new UniqueUrnsOracle();
			const state = new Set<string>();
			const state2 = new Set<string>();
			urns.forEach((urn) => {
				const resource = { urn, type: 'a', name: 'name', inputs: {} };
				expect(test.validateResource(resource, state)).toBe(undefined);
				expect(test.validateResource(resource, state2)).toBe(undefined);
			});
		};
		fc.assert(fc.property(fc.uniqueArray(fc.string()), predicate));
	});

	it('should fail on duplicated strings in same run', () => {
		const predicate = (urns: string[]) => {
			const test = new UniqueUrnsOracle();
			const state = new Set<string>();
			let err: Error | undefined;
			[...urns, ...urns].forEach((urn) => {
				const resource = { urn, type: 'a', name: 'name', inputs: {} };
				err = test.validateResource(resource, state) || err;
			});
			expect(err?.message).toMatch(/Duplicated definition of resource/);
		};
		fc.assert(fc.property(fc.array(fc.string(), { minLength: 1 }), predicate));
	});
});
