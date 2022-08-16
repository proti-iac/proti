declare const proti: string;

describe('ProTI', () => {
	it('should log the project dir', () => {
		console.log(process.cwd());
		console.log(__dirname);
		console.log(proti);
	});
});
