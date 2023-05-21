import { PluginsConfig } from '@proti/core';
import { resetCachedConfig } from '../src/config';
import { initModule } from '../src/utils';

describe('init module', () => {
	beforeEach(() => resetCachedConfig());

	it.each([
		['without plugin config', {}],
		['with plugin config', { 'pulumi-packages-schema': { verbose: false } }],
		['with plugin config for another plugin', { 'pulumi-packages-schem': { verbos: false } }],
	])('should initialize %s', (_, pluginsConfig: PluginsConfig) =>
		expect(initModule(pluginsConfig, '')).resolves.not.toThrow()
	);

	it('should not initialize with invalid plugin config', () => {
		const pluginsConfig = { 'pulumi-packages-schema': { verbose: 'false' } };
		return expect(initModule(pluginsConfig, '')).rejects.toThrow(
			'Update property .plugins.pulumi-packages-schema.verbose is string, not boolean'
		);
	});
});
