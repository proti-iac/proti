import type { ModuleLoader, PluginsConfig } from '@proti/core';
import { resetCachedConfig } from '../src/config';
import { initModule } from '../src/utils';

describe('init module', () => {
	const moduleLoader = new (jest.fn<ModuleLoader, []>())();

	beforeEach(() => resetCachedConfig());

	it.each([
		['without plugin config', {}],
		['with plugin config', { 'pulumi-packages-schema': { verbose: false } }],
		['with plugin config for another plugin', { 'pulumi-packages-schem': { verbos: false } }],
	])('should initialize %s', (_, pluginsConfig: PluginsConfig) =>
		expect(initModule(moduleLoader, pluginsConfig, '')).resolves.not.toThrow()
	);

	it('should not initialize with invalid plugin config', () => {
		const pluginsConfig = { 'pulumi-packages-schema': { verbose: 'false' } };
		return expect(initModule(moduleLoader, pluginsConfig, '')).rejects.toThrow(
			'Update property .plugins.pulumi-packages-schema.verbose is string, not boolean'
		);
	});
});
