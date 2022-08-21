import { Config } from './config';

declare const proti: Config;

describe('ProTI', () => {
	it('should log the project dir', () => {
		console.log(proti.protiDir);
		console.log(process.cwd());
		console.log(proti.projectDir);
		// eslint-disable-next-line global-require, import/no-dynamic-require
		require(proti.projectDir);
	});
});
