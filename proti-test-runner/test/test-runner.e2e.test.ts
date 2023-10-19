import * as cp from 'child_process';
import { jestCmd } from './util';

describe('runner end-to-end', () => {
	it.concurrent.each(['../../examples/s3-website/flat'])('should run on %s', (project) =>
		expect(() => cp.execSync(jestCmd([project])).toString()).not.toThrow()
	);

	it('should fail on non-existing project', () => {
		expect(() => cp.execSync(jestCmd(['abc']))).toThrow('Command failed:');
	});

	it('should fail transforming if main from Pulumi.yaml cannot be resolved', () => {
		let error: Error | undefined;
		try {
			cp.execSync(jestCmd(['../../examples/s3-website/no-program']));
		} catch (e) {
			error = e as Error;
		}
		expect(error).toBeDefined();
		expect(error?.message).toMatch(/Error: Failed to Transform program/);
		expect(error?.message).toMatch(/Failed to resolve program from path/);
	});

	it.concurrent.each([
		'../../examples/s3-website/invalid',
		'../../examples/s3-website/flat-throws',
		'../../examples/s3-website/flat-throws-async',
	])('should fail on %s', (project) => {
		expect(() => cp.execSync(jestCmd([project]))).toThrow('ProTI found');
	});
});
