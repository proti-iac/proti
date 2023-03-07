import * as fc from 'fast-check';

import UniqueUrnsTest from '../../src/tests/unique-urns-test';

describe('unique URNs test', () => {
	it('should not fail on unique strings', () => {
		fc.assert(
			fc.property(fc.uniqueArray(fc.string()), (urns) => {
				const test = new UniqueUrnsTest();
				urns.forEach((urn) => {
					const resource = { urn, type: 'a', name: 'name', inputs: {} };
					expect(test.validateResource(resource)).toBe(undefined);
				});
			})
		);
	});

	it('should fail on duplicated strings', () => {
		fc.assert(
			fc.property(
				fc
					.uniqueArray(fc.string(), { minLength: 1 })
					.chain((urns) =>
						fc.tuple(
							fc.constant(urns),
							fc.nat(urns.length - 1),
							fc.nat(urns.length - 1)
						)
					),
				([urns, duplicatePos, insertPos]) => {
					const test = new UniqueUrnsTest();
					const duplicateUrns = [
						...urns.slice(0, insertPos),
						urns[duplicatePos],
						...urns.slice(insertPos),
					];
					const errorPos: number[] = [];
					duplicateUrns.forEach((urn, pos) => {
						const resource = { urn, type: 'a', name: 'name', inputs: {} };
						const result = test.validateResource(resource);
						if (result !== undefined) {
							expect(result).toBeInstanceOf(Error);
							errorPos.push(pos);
						}
					});
					expect(errorPos).toStrictEqual([Math.max(insertPos, duplicatePos + 1)]);
				}
			)
		);
	});
});
