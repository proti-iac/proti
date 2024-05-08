// eslint-disable-next-line no-underscore-dangle
exports.__esModule = true;

class Oracle {
	name = 'Test';

	description = 'Test';

	constructor() {
		console.info('TEST_PLUGIN: constructor');
	}

	// eslint-disable-next-line class-methods-use-this
	newRunState = () => {
		console.info('TEST_PLUGIN: newRunState');
		return {};
	};

	// eslint-disable-next-line class-methods-use-this
	validateResource = () => console.info('TEST_PLUGIN: validateResource');
}

exports.default = Oracle;
exports.init = async () => console.info('TEST_PLUGIN: init');
exports.shutdown = async () => console.info('TEST_PLUGIN: shutdown');
