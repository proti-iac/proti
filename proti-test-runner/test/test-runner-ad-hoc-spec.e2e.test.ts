import * as cp from 'child_process';
import { jestCmd } from './util';

describe('runner ad-hoc spec end-to-end', () => {
	const specProject = '../../examples/s3-website/proti-spec';
	const specErrorProject = '../../examples/s3-website/proti-spec-error';

	it.concurrent.each([specProject, specErrorProject])(
		'should run without ad-hoc specification mocking %s',
		(project) => {
			expect(() =>
				cp.execSync(jestCmd([project], {}, { disableAdHocSpecs: true })).toString()
			).not.toThrow();
		}
	);

	it('should run with ad-hoc specifications', () => {
		expect(() => cp.execSync(jestCmd([specProject])).toString()).not.toThrow();
	});

	it('should fail with ad-hoc specifications', () => {
		expect(() => cp.execSync(jestCmd([specErrorProject])).toString()).toThrow();
	});
});
