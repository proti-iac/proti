import * as fc from 'fast-check';
import {
	type DeepPartial,
	deepMerge,
	errMsg,
	isObj,
	type Obj,
	interceptConstructor,
	type DeepReadonly,
	createReadonlyAppendArray,
	type Types,
	type JsType,
	typeOf,
} from '../src/utils';

describe('util', () => {
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
			},
		};
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		let t: DeepReadonly<typeof o>;

		it('should type check', () => {
			t = o;
			t = o as Readonly<typeof o>;
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
		] as [Types, unknown][])('should be %s: %s', (type, value) =>
			expect(typeOf(value)).toBe(type)
		);
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

	describe('is object', () => {
		it('should accept objects', () => {
			fc.assert(fc.property(fc.object(), (obj) => expect(isObj(obj)).toBe(true)));
		});
		it('should not accept non-objects', () => {
			const nonObjArb = fc.oneof(
				fc.array(fc.anything()),
				fc.tuple(),
				fc.anything({ maxDepth: 0 })
			);
			fc.assert(fc.property(nonObjArb, (nonObj) => expect(isObj(nonObj)).toBe(false)));
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
		const objToNestedRecordArb = (pattern: Obj, requiredKeys?: []): fc.Arbitrary<Obj> =>
			fc.record(
				Object.fromEntries(
					Object.entries(pattern).map(([k, v]) => {
						if (isObj(v)) return [k, objToNestedRecordArb(v)];
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

		it('throws if update is invalid', () => {
			fc.assert(
				fc.property(fc.object(), fc.anything({ maxDepth: 0 }), (obj, update) => {
					const fail = () => deepMerge(obj, update as DeepPartial<Obj>);
					expect(fail).toThrow('Update is not an object');
				})
			);
		});

		it('throws if update contains unknown property, but not if it is on ignored path', () => {
			const objWInvalidUpdate = fc
				.tuple(fc.string(), objAndUpdateArb(), fc.anything())
				.filter(([addProp, [obj]]) => !(addProp in obj))
				.map(([addProp, [obj, upd], val]) => {
					const update = { ...upd };
					update[addProp] = val;
					return [obj, update];
				});
			fc.assert(
				fc.property(objWInvalidUpdate, ([obj, update]) => {
					const properties = Object.keys(update).map((p) => `.${p}`);
					expect(() => deepMerge(obj, update, properties)).not.toThrow();
					expect(() => deepMerge(obj, update)).toThrow(
						/^Update property .* not in object$/
					);
				})
			);
		});

		it('throws if update value has wrong type', () => {
			const objWInvalidUpdate = objAndUpdateArb()
				.filter(([, upd]) => Object.keys(upd).length > 0)
				.chain(([obj, upd]) =>
					fc.tuple(
						fc.constant(obj),
						fc.constant(upd),
						fc.constantFrom(...Object.keys(upd)),
						fc.constantFrom<ValueType>(...(Object.keys(valueArbs) as ValueType[]))
					)
				)
				.filter(
					([, update, key, type]) =>
						typeof update[key] !== type &&
						!(Array.isArray(update[key]) && type === 'array') &&
						!(update[key] === null && type === 'null')
				)
				.chain(([obj, upd, key, type]) =>
					fc.tuple(fc.constant([obj, upd, key] as [Obj, Obj, string]), valueArbs[type]())
				)
				.map(([[obj, upd, key], val]) => {
					const update = { ...upd };
					update[key] = val;
					return [obj, update];
				});
			fc.assert(
				fc.property(objWInvalidUpdate, ([obj, update]) =>
					expect(() => deepMerge(obj, update)).toThrow(
						/^Update property \..* is .*, not .*$/
					)
				)
			);
		});

		it('should update values', () => {
			const checkUpdatedValues = (obj: Obj, upd: Obj): void =>
				Object.keys(upd).forEach((k) =>
					isObj(obj[k])
						? checkUpdatedValues(obj[k] as Obj, upd[k] as Obj)
						: expect(obj[k]).toStrictEqual(upd[k])
				);
			fc.assert(
				fc.property(objAndUpdateArb(), ([object, update]) => {
					const updated = deepMerge(object, update);
					checkUpdatedValues(updated, update);
				})
			);
		});

		it('should not change non-updated values', () => {
			const checkUnchangedValues = (obj: Obj, orig: Obj, upd: Obj): void =>
				Object.keys(orig)
					.filter((k) => !(k in upd) || isObj(orig[k]))
					.forEach((k) =>
						k in upd
							? checkUnchangedValues(obj[k] as Obj, orig[k] as Obj, upd[k] as Obj)
							: expect(obj[k]).toStrictEqual(orig[k])
					);
			fc.assert(
				fc.property(objAndUpdateArb(), ([object, update]) => {
					const updated = deepMerge(object, update);
					checkUnchangedValues(updated, object, update);
				})
			);
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

	describe('create readonly append array', () => {
		it('should append values', () => {
			fc.assert(
				fc.property(fc.array(fc.anything()), (array) => {
					const [a, push] = createReadonlyAppendArray();
					expect(a).toStrictEqual([]);
					array.forEach((v) => push(v));
					expect(a).toStrictEqual(array);
				})
			);
		});
	});
});
