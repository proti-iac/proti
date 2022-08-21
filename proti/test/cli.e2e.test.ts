import { run } from '../src/cli';

describe('CLI', () => {
	it('should run on ProTI', async () => {
		await expect(run(['--silent'])).resolves.toBe(undefined);
	});

	it('should not run on non-existing project', async () => {
		await expect(run(['--silent', 'abc'])).rejects.toThrow('Project path does not exist:');
	});

	it('should not run on flat S3 website', async () => {
		await expect(run(['--silent', '../examples/s3-website/flat'])).rejects.toThrow(
			'Jest tests failed'
		);
	});
});
