import { getType } from 'rttist';
import { assertEquals } from 'typia';

export type OProgram = { a: number; b: string; c: boolean[]; d: { e: null } };
export const osProgram = [
	{ a: 1, b: '2', c: [true], d: { e: null } } as OProgram,
	{ a: 1, b: '2', c: [true], d: { e: null, f: undefined } } as OProgram,
];
export const notOsProgram = [
	// @ts-expect-error
	{ a: '1', b: '2', c: [true], d: { e: null } } as OProgram,
	// @ts-expect-error
	1 as OProgram,
];

try {
	osProgram.forEach((o) => assertEquals<OProgram>(o));
} catch (e) {
	throw new Error('Typia fails at run time', { cause: e });
}
try {
	const t = JSON.stringify(getType<OProgram>());
	if (
		t !==
		'{"_isIterable":false,"_id":"@@proti/demo/bin/index::OProgram","_kind":62,"_name":"OProgram","_exported":false,"_moduleRef":{"_reference":"@@proti/demo/bin/index"},"_isGenericTypeDefinition":false,"_typeArgumentsRef":{"_references":[],"length":0},"_properties":[{"name":{"name":"a"},"_type":{"_reference":[10]},"_decorators":[],"metadata":{"name":"a","type":[10],"flags":0},"accessModifier":0,"accessor":0,"optional":false,"readonly":false},{"name":{"name":"b"},"_type":{"_reference":[12]},"_decorators":[],"metadata":{"name":"b","type":[12],"flags":0},"accessModifier":0,"accessor":0,"optional":false,"readonly":false},{"name":{"name":"c"},"_type":{"_reference":"::native::Array{::native::Boolean}"},"_decorators":[],"metadata":{"name":"c","type":"::native::Array{::native::Boolean}","flags":0},"accessModifier":0,"accessor":0,"optional":false,"readonly":false},{"name":{"name":"d"},"_type":{"_reference":"@@proti/demo/bin/index::AnonymousType:136"},"_decorators":[],"metadata":{"name":"d","type":"@@proti/demo/bin/index::AnonymousType:136","flags":0},"accessModifier":0,"accessor":0,"optional":false,"readonly":false}],"_methods":[],"_indexes":[]}'
	)
		throw new Error('RTTIST type information not as expected');
} catch (e) {
	throw new Error('RTTIST fails at run time', { cause: e });
}
