export const pick = <O, K extends keyof O>(obj: O, keys: K[]): Pick<O, K> =>
	Object.fromEntries(keys.map((key) => [key, obj[key]])) as Pick<O, K>;

export const keys = <O extends object, K extends keyof O>(obj: O): K[] => Object.keys(obj) as K[];

type DropUndefined<O extends object> = { [K in keyof O]: Exclude<O[K], undefined> };
export const dropUndefined = <O extends object>(obj: O): DropUndefined<O> =>
	Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as DropUndefined<O>;
