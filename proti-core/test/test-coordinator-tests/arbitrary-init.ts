import { EmptyStateGeneratorArbitrary } from '../../src/arbitraries/empty-state-generator-arbitrary';
import type { PluginArgs, PluginInitFn } from '../../src/plugin';

export default EmptyStateGeneratorArbitrary;

// eslint-disable-next-line import/no-mutable-exports
export let config: PluginArgs;
export const init: PluginInitFn = async (pluginArgs) =>
	new Promise((done) => {
		process.nextTick(() => {
			config = pluginArgs;
			done();
		});
	});
