export const pick = <O, K extends keyof O>(obj: O, keys: K[]): Pick<O, K> =>
	Object.fromEntries(keys.map((key) => [key, obj[key]])) as Pick<O, K>;

export const keys = <O extends object, K extends keyof O>(obj: O): K[] => Object.keys(obj) as K[];
