import * as cp from 'child_process';
import { jestCmd } from './util';

describe('runner termination end-to-end', () => {
	it('should terminate examples/s3-website/non-terminating-async-open-handle', () => {
		const project = '../../examples/s3-website/non-terminating-async-open-handle';
		const jestConfig = {
			/** If not set, open handles will prevent jest from terminating. */
			forceExit: true,
		};
		expect(() => cp.execSync(jestCmd([project], jestConfig)).toString()).not.toThrow();
	});

	it('should soft timeout examples/s3-website/non-terminating-async', () => {
		const project = '../../examples/s3-website/non-terminating-async';
		const runnerConfig = {
			/** If not set, it will not timeout */
			timeout: 2000,
		};
		expect(() => cp.execSync(jestCmd([project], {}, runnerConfig))).toThrow('Property timeout');
	});

	it('should hard timeout examples/s3-website/non-terminating-deasync', () => {
		const project = '../../examples/s3-website/non-terminating-deasync';
		const runnerConfig = {
			/** If not set, it will not timeout */
			timeout: 2000,
		};
		expect(() => cp.execSync(jestCmd([project], {}, runnerConfig))).toThrow(
			'ProTI failed with a hard timeout.'
		);
	});

	/* Does not work because it blocks event loop */
	// it('should timeout examples/s3-website/non-terminating-sync', () => {
	// 	const project = '../../examples/s3-website/non-terminating-sync';
	// 	const jestConfig = {
	// 		/** If not set, it will not timeout */
	// 		timeout: 2000,
	// 	};
	// 	expect(() => cp.execSync(jestCmd([project], jestConfig))).toThrow('Command failed');
	// });
});
