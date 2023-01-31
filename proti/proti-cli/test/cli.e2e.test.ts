import * as path from 'path';
import { run } from '../src/cli';

describe('CLI', () => {
	xit('should run on ProTI CLI', async () => {
		await expect(run(['--silent', path.resolve(__dirname, '..')])).resolves.toBe(undefined);
	});

	it('should not run on non-existing project', async () => {
		await expect(run(['--silent', 'abc'])).rejects.toThrow('Project path does not exist:');
	});

	xit('should run on flat S3 website', async () => {
		await expect(
			run(['--silent', path.resolve(__dirname, '../../../examples/s3-website/flat')])
		).resolves.toBe(undefined);
	});

	xit('should run on flat-redirect S3 website', async () => {
		await expect(
			run(['--silent', path.resolve(__dirname, '../../../examples/s3-website/flat-redirect')])
		).resolves.toBe(undefined);
	});

	it('should not run on flat-throws S3 website', async () => {
		await expect(
			run(['--silent', path.resolve(__dirname, '../../../examples/s3-website/flat-throws')])
		).rejects.toThrow('Jest tests failed');
	});
});
