import { EmptyStateGeneratorPlugin } from '../../src/generator-plugins/empty-state-generator-plugin';
import type { PluginArgs, PluginInitFn, PluginWithInitFn } from '../../src/plugin';

// eslint-disable-next-line import/no-mutable-exports
export let config: PluginArgs;
class EmptyStateGeneratorWithInitPlugin
	extends EmptyStateGeneratorPlugin
	implements PluginWithInitFn
{
	// eslint-disable-next-line class-methods-use-this
	readonly init: PluginInitFn = (pluginArgs) =>
		new Promise((done) => {
			process.nextTick(() => {
				config = pluginArgs;
				done();
			});
		});
}
export default EmptyStateGeneratorWithInitPlugin;
