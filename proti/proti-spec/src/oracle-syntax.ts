export const expect = <T>(value: T) =>
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	({ to: (predicate: (value: T) => boolean | Promise<boolean>): T => value });
