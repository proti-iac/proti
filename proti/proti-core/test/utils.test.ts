import * as fc from 'fast-check';
import {
	type DeepPartial,
	deepMerge,
	errMsg,
	interceptConstructor,
	type DeepReadonly,
	createAppendOnlyArray,
	type Types,
	type JsType,
	typeOf,
	createAppendOnlyMap,
	type Dict,
	mapValues,
	asyncMapValues,
} from '../src/utils';

describe('deep partial', () => {
	type T = { a: number; b: string; c: boolean[]; d: { e: boolean; f: { g: number } } };
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let t: DeepPartial<T>;
	it('should type check', () => {
		t = { a: 1, b: '2', c: [true, false], d: { e: true, f: { g: 3 } } };
		t = { a: 1, b: '2', c: [true, false], d: {} };
		t = { b: '2', c: [] as boolean[] };
		t = {};
	});

	it('should alert invalid property', () => {
		// @ts-expect-error
		t = { e: '1' };
	});

	it('should alert invalid property value type', () => {
		// @ts-expect-error
		t = { a: '1' };
		// @ts-expect-error
		t = { c: [1, 2] };
	});

	it('should alert invalid nested property', () => {
		// @ts-expect-error
		t = { d: { f: { gh: 1 } } };
	});

	it('should alert invalid nested property value type', () => {
		// @ts-expect-error
		t = { d: { f: { g: '1' } } };
	});
});

describe('deep readonly', () => {
	const o = {
		a: {
			b: 'a',
			c: new Set<{ d: 'e' }>(),
			f: new Map<{ f: 'g' }, { h: 'i' }>(),
			j: new Array<{ k: 'l' }>(),
			m: { n: 'o' },
			p: [{ q: 'r' }, 's', { t: 'q' }] as [{ q: string }, 's', { t: string }],
		},
	};
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let t: DeepReadonly<typeof o>;

	it('should type check', () => {
		t = o;
		t = o as Readonly<typeof o>;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const s: {
			readonly a: {
				readonly b: string;
				readonly c: ReadonlySet<{ readonly d: 'e' }>;
				readonly f: ReadonlyMap<{ readonly f: 'g' }, { readonly h: 'i' }>;
				readonly j: readonly { readonly k: 'l' }[];
				readonly m: { readonly n: string };
				readonly p: readonly [{ readonly q: string }, 's', { readonly t: string }];
			};
		} = t;
	});

	it('should alert mutating property', () => {
		// @ts-expect-error
		t.a = o.a;
	});

	it('should alert mutating nested property', () => {
		// @ts-expect-error
		t.a.b = o.a.b;
	});

	it('should alert mutating set', () => {
		// @ts-expect-error
		t.a.c.add({ d: 'e' });
	});

	it('should alert mutating set element', () => {
		Array.from(t.a.c.values()).forEach((v) => {
			// @ts-expect-error
			// eslint-disable-next-line no-param-reassign
			v.d = 'e';
		});
	});

	it('should alert mutating map', () => {
		// @ts-expect-error
		t.a.f.set({ f: 'g' }, { h: 'i' });
	});

	it('should alert mutating map key', () => {
		Array.from(t.a.f.keys()).forEach((v) => {
			// @ts-expect-error
			// eslint-disable-next-line no-param-reassign
			v.f = 'g';
		});
	});

	it('should alert mutating map value', () => {
		Array.from(t.a.f.values()).forEach((v) => {
			// @ts-expect-error
			// eslint-disable-next-line no-param-reassign
			v.h = 'i';
		});
	});

	it('should alert mutating array', () => {
		// @ts-expect-error
		t.a.j.push({ k: 'l' });
	});

	it('should alert mutating array value', () => {
		Array.from(t.a.j.values()).forEach((v) => {
			// @ts-expect-error
			// eslint-disable-next-line no-param-reassign
			v.k = 'l';
		});
	});

	it('should alert mutating tuple value', () => {
		// @ts-expect-error
		t.a.p[0] = { q: 'r' };
		// @ts-expect-error
		t.a.p[0].q = 'r';
		// @ts-expect-error
		t.a.p[2].t = 'q';
	});
});

describe('typeOf', () => {
	it.each([
		['number', 1],
		['number', 2.3],
		['bigint', 4n],
		['boolean', true],
		['symbol', Symbol('')],
		['undefined', undefined],
		['array', []],
		['array', [1, 'two']],
		['object', {}],
		['object', new Map()],
		['function', () => {}],
		['null', null],
	] as [Types, unknown][])('should be %s: %s', (type, value) => expect(typeOf(value)).toBe(type));
});

describe('JsType', () => {
	it('should type correctly', () => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const vals: {
			number: number;
			bigint: bigint;
			boolean: boolean;
			symbol: symbol;
			undefined: undefined;
			array: unknown[];
			object: object;
			function: Function;
			null: null;
		} = {
			number: null as unknown as JsType<'number'>,
			bigint: null as unknown as JsType<'bigint'>,
			boolean: 1 as unknown as JsType<'boolean'>,
			symbol: 2 as unknown as JsType<'symbol'>,
			undefined: 3 as unknown as JsType<'undefined'>,
			array: 4 as unknown as JsType<'array'>,
			object: 5 as unknown as JsType<'object'>,
			function: 6 as unknown as JsType<'function'>,
			null: 7 as unknown as JsType<'null'>,
		};
	});
});

describe('deep merge', () => {
	const valueArbs = {
		array: () => fc.array(fc.string()),
		boolean: fc.boolean,
		number: fc.double,
		null: () => fc.constant(null),
		string: fc.string,
		undefined: () => fc.constant(undefined),
	};
	type ValueType = keyof typeof valueArbs;
	const objToNestedRecordArb = (pattern: Dict, requiredKeys?: []): fc.Arbitrary<Dict> =>
		fc.record(
			Object.fromEntries(
				Object.entries(pattern).map(([k, v]) => {
					if (typeOf(v) === 'object') return [k, objToNestedRecordArb(v)];
					if (Array.isArray(v)) return [k, valueArbs.array()];
					return [k, valueArbs[v as ValueType]()];
				})
			),
			{ requiredKeys }
		);
	const objAndUpdateArb = () =>
		fc
			.object({ values: Object.keys(valueArbs).map(fc.constant) })
			.chain((obj) => fc.tuple(objToNestedRecordArb(obj), objToNestedRecordArb(obj, [])));

	it('throws if update contains unknown property, but not if it is on overwrite path', () => {
		const objWInvalidUpdate: fc.Arbitrary<[Dict, Dict]> = fc
			.tuple(fc.string(), objAndUpdateArb(), fc.object())
			.map(([addProp, [obj, upd], val]) => [
				{ ...obj, [addProp]: {} },
				{ ...upd, [addProp]: { ...val, new: true } },
			]);
		const predicate = ([obj, update]: [Dict, Dict]) => {
			const properties = Object.keys(update).map((p) => `.${p}`);
			expect(() => deepMerge(obj, update, properties)).not.toThrow();
			expect(() => deepMerge(obj, update)).toThrow(/^Update property .* not in object$/);
		};
		fc.assert(fc.property(objWInvalidUpdate, predicate));
	});

	it('should update values', () => {
		const checkUpdatedValues = (obj: Dict, upd: Dict): void =>
			Object.keys(upd).forEach((k) =>
				typeOf(obj[k]) === 'object'
					? checkUpdatedValues(obj[k], upd[k])
					: expect(obj[k]).toStrictEqual(upd[k])
			);
		const predicate = ([object, update]: [Dict, Dict]) => {
			const updated = deepMerge(object, update);
			checkUpdatedValues(updated, update);
		};
		fc.assert(fc.property(objAndUpdateArb(), predicate));
	});

	it('should not change non-updated values', () => {
		const checkUnchangedValues = (obj: Dict, orig: Dict, upd: Dict): void =>
			Object.keys(orig)
				.filter((k) => typeOf(upd[k]) === 'object' || !(k in upd))
				.forEach((k) =>
					typeOf(upd[k]) === 'object'
						? checkUnchangedValues(obj[k], orig[k], upd[k])
						: expect(obj[k]).toStrictEqual(orig[k])
				);
		const predicate = ([object, update]: [Dict, Dict]) => {
			const updated = deepMerge(object, update);
			checkUnchangedValues(updated, object, update);
		};
		fc.assert(fc.property(objAndUpdateArb(), predicate));
	});
});

describe('errMsg', () => {
	it('should not alter resolving promises', () =>
		fc.assert(
			fc.asyncProperty(fc.anything(), fc.string(), (val: any, msg: string) =>
				expect(errMsg(Promise.resolve(val), msg)).resolves.toBe(val)
			)
		));

	it('should wrap failing promise errors', () =>
		fc.assert(
			fc.asyncProperty(fc.anything(), fc.string(), (val: any, msg: string) =>
				expect(errMsg(Promise.reject(val), msg)).rejects.toThrow(msg)
			)
		));
});

describe('interceptConstructor', () => {
	class A {
		private w: number;

		constructor(private v: number) {
			this.w = 34;
		}

		public static x = 56;

		public getVW = () => this.v * this.w;
	}
	let a: A;
	const B = interceptConstructor(A, (t: A) => {
		a = t;
	});
	const b: A = new B(12);

	it('should call interceptFn with this', () => {
		expect(a).toBe(b);
	});

	it('should be instance of original class', () => {
		expect(b).toBeInstanceOf(A);
	});

	it('should have static property of original class', () => {
		expect(B.x).toBe(56);
	});

	it('should have dynamic property of original class', () => {
		expect(b.getVW()).toBe(408);
	});
});

describe('create append only array', () => {
	it('should append values', () => {
		fc.assert(
			fc.property(fc.array(fc.anything()), (array) => {
				const [a, push] = createAppendOnlyArray();
				expect(a).toStrictEqual([]);
				array.forEach((v) => push(v));
				expect(a).toStrictEqual(array);
			})
		);
	});
});

describe('create append only map', () => {
	it('should append values for unique keys', () => {
		const predicate = (keys: any[], values: any[]) => {
			const [map, set] = createAppendOnlyMap();
			keys.forEach((key, i) => set(key, values[i % values.length]));
			expect(new Set(map.keys())).toStrictEqual(new Set(keys));
			expect(new Set(map.values())).toStrictEqual(new Set(values.slice(0, keys.length)));
		};
		const valuesArb = fc.array(fc.anything(), { minLength: 1 });
		fc.assert(fc.property(fc.uniqueArray(fc.anything({ maxDepth: 0 })), valuesArb, predicate));
	});

	it('should throw on mutating value', () => {
		const predicate = (key: any, value: any) => {
			const [, set] = createAppendOnlyMap();
			set(key, value);
			expect(() => set(key, value)).toThrowError(/already has value for/);
		};
		fc.assert(fc.property(fc.anything({ maxDepth: 0 }), fc.anything(), predicate));
	});
});

describe('map values', () => {
	it('types correctly', () => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const m: { [_: string]: number } = mapValues({ a: 'b' }, () => 5);
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const n: { [_: string]: any } = mapValues({ a: 'b' }, () => 5);
		// @ts-expect-error
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const o: { [_: string]: string } = mapValues({ a: 'b' }, () => 5);
	});
	const dictArb = fc.dictionary(fc.string(), fc.integer());

	it('preserves keys', () => {
		const predicate = (dict: Record<string, number>, f: (_: number) => any) => {
			const keys = Object.keys(dict);
			const mapped = mapValues(dict, (value, key) => {
				expect(keys.includes(key)).toBe(true);
				return f(value);
			});
			expect(Object.keys(mapped)).toStrictEqual(keys);
		};
		fc.assert(fc.property(dictArb, fc.func(fc.anything()), predicate));
	});

	it('maps values', () => {
		const predicate = (dict: Record<string, number>) => {
			const vals = Object.values(dict);
			Object.values(mapValues(dict, (n: number) => n * 2)).forEach((n2, i) =>
				expect(n2).toBe(vals[i] * 2)
			);
		};
		fc.assert(fc.property(dictArb, predicate));
	});
});

describe('async map values', () => {
	it('types correctly', () => {
		const f = () => Promise.resolve(5);
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const m: Promise<{ [_: string]: number }> = asyncMapValues({ a: 'b' }, f);
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const n: Promise<{ [_: string]: any }> = asyncMapValues({ a: 'b' }, f);
		// @ts-expect-error
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const o: Promise<{ [_: string]: string }> = asyncMapValues({ a: 'b' }, f);
	});
	const dictArb = fc.dictionary(fc.string(), fc.integer());

	it('preserves keys', () => {
		const predicate = async (dict: Record<string, number>, f: (_: number) => any) => {
			const keys = Object.keys(dict);
			const mapped = await asyncMapValues(dict, (value, key) => {
				expect(keys.includes(key)).toBe(true);
				return f(value);
			});
			expect(Object.keys(mapped)).toStrictEqual(keys);
		};
		return fc.assert(fc.asyncProperty(dictArb, fc.func(fc.anything()), predicate));
	});

	it('maps values', () => {
		const predicate = async (dict: Record<string, number>) => {
			const vals = Object.values(dict);
			Object.values(
				await asyncMapValues(dict, (n: number) => Promise.resolve(n * 2))
			).forEach((n2, i) => expect(n2).toBe(vals[i] * 2));
		};
		return fc.assert(fc.asyncProperty(dictArb, predicate));
	});
});
