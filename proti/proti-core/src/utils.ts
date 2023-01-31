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

export type Obj = { [_: string]: unknown | Obj };
export const isObj = (obj: unknown): obj is Obj =>
	typeof obj === 'object' && obj !== null && !Array.isArray(obj);

export const deepMerge = <T extends Obj>(obj: T, update: DeepPartial<T>): T => ({
	...obj,
	...Object.fromEntries(
		Object.keys(update).map((k) => {
			if (!(k in obj)) throw new Error(`Update property not in object: ${k}`);
			if (
				typeof obj[k] !== typeof update[k] ||
				Array.isArray(obj[k]) !== Array.isArray(update[k]) ||
				(obj[k] === null) !== (update[k] === null)
			)
				throw new Error(`Invalid value type in update for ${k}`);
			const v = isObj(obj[k]) ? deepMerge(obj[k] as Obj, update[k] as Obj) : update[k];
			return [k, v];
		})
	),
});
