export const expect = <T>(value: T) =>
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	({ to: <S extends T>(predicate: (value: S) => boolean): T => value });
