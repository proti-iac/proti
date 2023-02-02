import { getType } from 'rttist';
import { assertEquals } from 'typia';
import * as aws from '@pulumi/aws';

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
	const t = getType<OProgram>();
	if (
		t.toString() !== 'Object{@@proti/demo/bin/index::OProgram}' ||
		!t.isObject() ||
		t
			.getProperties()
			.map((p) => p.name.name)
			.toString() !== 'a,b,c,d'
	)
		throw new Error('RTTIST type information not as expected');
} catch (e) {
	throw new Error('RTTIST fails at run time', { cause: e });
}
try {
	const t = getType<aws.s3.Bucket>();
	if (
		!t.isClass() ||
		t.getConstructors().length !== 1 ||
		t
			.getConstructors()[0]
			.getParameters()
			.map((p) => p.name)
			.toString() !== 'name,args,opts'
	)
		throw new Error('RTTIST type information not as expected');
} catch (e) {
	throw new Error('RTTIST fails on @pulumi/aws at run time', { cause: e });
}
