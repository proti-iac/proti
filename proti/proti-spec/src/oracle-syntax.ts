export const expect = <T>(value: T) => {
	type ValidationPredicate = (value: T) => boolean | Promise<boolean>;
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	return { to: (predicate: ValidationPredicate): T => value };
};
