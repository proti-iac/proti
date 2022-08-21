import { run } from '../src/cli';

describe('CLI', () => {
	it('should run on ProTI', async () => {
		await expect(run(['--silent'])).resolves.toBe(undefined);
	});

	it('should not run on non-existing project', async () => {
		await expect(run(['--silent', 'abc'])).rejects.toThrow('Project path does not exist:');
	});

	it('should run on flat S3 website', async () => {
		await expect(run(['--silent', '../examples/s3-website/flat'])).resolves.toBe(undefined);
	});

	it('should run on flat-redirect S3 website', async () => {
		await expect(run(['--silent', '../examples/s3-website/flat-redirect'])).resolves.toBe(
			undefined
		);
	});

	it('should not run on flat-throws S3 website', async () => {
		await expect(run(['--silent', '../examples/s3-website/flat-throws'])).rejects.toThrow(
			'Jest tests failed'
		);
	});
});
