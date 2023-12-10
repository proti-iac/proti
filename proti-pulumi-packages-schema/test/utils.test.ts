import type { ModuleLoader, PluginsConfig, PluginArgs } from '@proti-iac/core';
import { resetCachedConfig } from '../src/config';
import { initModule } from '../src/utils';

describe('init module', () => {
	const pluginArgs: PluginArgs = {
		moduleLoader: new (jest.fn<ModuleLoader, []>())(),
		pluginsConfig: {},
		testPath: '',
		cacheDir: '',
	};

	beforeEach(() => resetCachedConfig());

	it.each([
		['without plugin config', {}],
		['with plugin config', { 'pulumi-packages-schema': { verbose: false } }],
		['with plugin config for another plugin', { 'pulumi-packages-schem': { verbos: false } }],
	])('should initialize %s', (_, pluginsConfig: PluginsConfig) =>
		expect(initModule({ ...pluginArgs, pluginsConfig })).resolves.not.toThrow()
	);

	it('should not initialize with invalid plugin config', () => {
		const pluginsConfig = { 'pulumi-packages-schema': { verbose: 'false' } };
		return expect(initModule({ ...pluginArgs, pluginsConfig })).rejects.toThrow(
			'Invalid @proti-iac/pulumi-packages-schema configuration. $input.verbose should be (boolean | undefined) but is false.'
		);
	});
});
