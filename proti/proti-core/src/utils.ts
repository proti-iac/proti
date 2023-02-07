/**
 * Like built-in Partial<T> type, but recursive on object properties.
 */
export type DeepPartial<T> = {
	[P in keyof T]: T[P] extends (infer U)[]
		? DeepPartial<U>[]
		: T[P] extends object
		? DeepPartial<T[P]>
		: T[P];
};

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
export type Obj = { [_: string]: unknown | Obj };
export const isObj = (obj: unknown): obj is Obj => typeOf(obj) === 'object';

/**
 * Recursively overwrite values in `obj` with values in `update`. Expects that `update`'s
 * structure, including types, is a subset of `obj`'s structure.
 * @param obj Object to update.
 * @param update Update to merge onto `obj`.
 * @param propertyPath Current property path. Used for nicer error messages.
 * @returns Updated copy of `obj`.
 */
export const deepMerge = <T extends Obj>(obj: T, update: DeepPartial<T>, propertyPath = ''): T => {
	if (!isObj(update)) throw new Error(`Update is not an object but ${update}`);
	const updateProperty = (key: string) => {
		const property = `${propertyPath}.${key}`;
		if (!(key in obj)) throw new Error(`Update property ${property} not in object`);
		if (typeOf(obj[key]) !== typeOf(update[key]))
			throw new Error(
				`Update property ${property} is ${typeOf(update[key])}, not ${typeOf(obj[key])}`
			);
		const v = isObj(obj[key])
			? deepMerge(obj[key] as Obj, update[key] as Obj, property)
			: update[key];
		return [key, v];
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
