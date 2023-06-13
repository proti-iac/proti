/**
 * Like built-in Partial<T> type, but recursive on object properties.
 */
export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends (infer U)[]
		? DeepPartial<U>[]
		: T[P] extends object
		? DeepPartial<T[P]>
		: T[P];
};

/**
 * Like Readonly<T> but recursive and also making Arrays, Maps, Sets, and Tuples
 * readonly.
 */
export type DeepReadonly<T> = T extends Function
	? T
	: T extends Map<infer K, infer V>
	? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
	: T extends Set<infer U>
	? ReadonlySet<DeepReadonly<U>>
	: T extends [infer H] // One-Tuple
	? Readonly<[DeepReadonly<H>]>
	: T extends [infer H, ...infer R] // Tuples
	? Readonly<[DeepReadonly<H>, ...DeepReadonly<R>]>
	: T extends Array<infer U>
	? ReadonlyArray<DeepReadonly<U>>
	: T extends object
	? { readonly [P in keyof T]: DeepReadonly<T[P]> }
	: T;

const wrappedTypeof = (x: any) => typeof x;
/**
 * JS types extended by 'null' and 'array'.
 */
export type Types = ReturnType<typeof wrappedTypeof> | 'null' | 'array';
export const typeOf = (val: unknown): Types => {
	const type = typeof val;
	if (type === 'object') {
		if (Array.isArray(val)) return 'array';
		if (val === null) return 'null';
	}
	return type;
};
export type JsType<T extends Types> = T extends 'string'
	? string
	: T extends 'number'
	? number
	: T extends 'bigint'
	? bigint
	: T extends 'boolean'
	? boolean
	: T extends 'symbol'
	? symbol
	: T extends 'undefined'
	? undefined
	: T extends 'array'
	? unknown[]
	: T extends 'object'
	? object
	: T extends 'function'
	? Function
	: T extends 'null'
	? null
	: never;

export type Dict = { [_: string]: any };

/**
 * Recursively overwrite values in `obj` with values in `update`. Expects that
 * `update`'s structure, including types, is a subset of `obj`'s structure.
 * @param obj Object to update.
 * @param update Update to merge onto `obj`.
 * @param overwritePaths Does not recursively merge but overwrite such
 * properties, if present `update`.
 * @param propertyPath Current property path. Used for nicer error messages.
 * @returns Updated copy of `obj`.
 * @throws If `update` contains a property that is not in `obj` in a not
 * overwritten path.
 */
export const deepMerge = <T extends Dict>(
	obj: T,
	update: DeepPartial<T>,
	overwritePaths: string[] = [],
	propertyPath = ''
): T => {
	const updateProperty = (key: string) => {
		const property = `${propertyPath}.${key}`;
		if (!(key in obj)) throw new Error(`Update property ${property} not in object`);
		return [
			key,
			overwritePaths.includes(property) || typeOf(update[key]) !== 'object'
				? update[key]
				: deepMerge(obj[key], update[key]!, overwritePaths, property),
		];
	};
	return {
		...obj,
		...Object.fromEntries(Object.keys(update).map(updateProperty)),
	};
};

/**
 * Wrap a rejecting promises value in an `Error` with the message `errorMsg`.
 * @param p Promise.
 * @param errorMsg Error message on reject.
 * @returns Promise that resolves with `p` or rejects with an `Error` of `errorMsg`, holding the
 * rejection value of `p` as cause.
 */
export const errMsg = <T>(p: Promise<T>, errorMsg: string): Promise<T> =>
	p.catch<T>((cause) => Promise.reject(new Error(errorMsg, { cause })));

/**
 * Augment class `Clazz` to call `interceptFn` at the beginning of the constructor. The returned
 * augmented class can act as drop-in replacement for `Class`.
 * Inspired by https://github.com/jamesallardice/patchwork.js/.
 * @param Clazz Class to augment.
 * @param interceptFn Function to call after the original constructor, receiving the new object.
 * @returns Augmented version of `Clazz`.
 */
export const interceptConstructor = <T, U extends { new (...v: any[]): T }>(
	Clazz: U,
	interceptFn: (t: T) => any
): U => {
	/**
	 * Patched class constructor
	 * @param args Constructor arguments
	 * @returns New monkey-patched object
	 */
	function C(this: T, ...args: any[]): T {
		const o = new (Function.prototype.bind.call(Clazz, null, ...args))();
		interceptFn(o);
		return o;
	}
	C.prototype = Clazz.prototype;
	C.prototype.constructor = C;

	// Transfer static properties and methods
	Object.getOwnPropertyNames(Clazz)
		.filter((prop) => !(prop in Function))
		.forEach((prop) => {
			(C as any)[prop] = (Clazz as any)[prop];
		});
	return C as unknown as U;
};

/**
 * Create a readonly array with a separate append function.
 * @returns Bituple of readonly array and its append function.
 */
export const createAppendOnlyArray = <T>(): readonly [
	DeepReadonly<T[]>,
	(i: DeepReadonly<T>) => void
] => {
	const array: DeepReadonly<T>[] = [];
	return [array, array.push.bind(array)];
};

/**
 * Create a readonly map with a separate append-only function that does not
 * permit overwriting existing keys.
 * @returns Bituple of readonly map and its append function.
 */
export const createAppendOnlyMap = <K, V>(): [
	ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>,
	(key: DeepReadonly<K>, value: DeepReadonly<V>) => void
] => {
	const map = new Map<DeepReadonly<K>, DeepReadonly<V>>();
	const append = (key: DeepReadonly<K>, value: DeepReadonly<V>) => {
		if (map.has(key)) throw new Error(`Append only map already has value for ${key}`);
		map.set(key, value);
	};
	return [map, append];
};
