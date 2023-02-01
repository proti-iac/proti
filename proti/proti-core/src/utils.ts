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
