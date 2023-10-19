import type * as Resolver from 'jest-resolve';
import type { IHasteFS } from 'jest-haste-map';
import { is } from 'typia';

export const isResolver = (resolver: any): resolver is Resolver.default =>
	is<Resolver.default>(resolver);
export const isHasteFS = (hasteFS: any): hasteFS is IHasteFS => is<IHasteFS>(hasteFS);
