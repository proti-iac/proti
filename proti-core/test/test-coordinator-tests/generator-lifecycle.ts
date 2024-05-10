import { EmptyStateGeneratorPlugin } from '../../src/generator-plugins/empty-state-generator-plugin';
import type {
	PluginArgs,
	PluginInitFn,
	PluginPostRunArgs,
	PluginPostRunFn,
	PluginPreRunArgs,
	PluginPreRunFn,
	PluginShutdownFn,
	PluginWithInitFn,
	PluginWithPostRunFn,
	PluginWithPreRunFn,
	PluginWithShutdownFn,
} from '../../src/plugin';
import type { CheckResult } from '../../src/result';

// eslint-disable-next-line import/no-mutable-exports
export let config: PluginArgs;
// eslint-disable-next-line import/no-mutable-exports
export let preRunArgs: PluginPreRunArgs;
// eslint-disable-next-line import/no-mutable-exports
export let postRunArgs: PluginPostRunArgs;
// eslint-disable-next-line import/no-mutable-exports
export let result: CheckResult;
class EmptyStateGeneratorLifecylePlugin
	extends EmptyStateGeneratorPlugin
	implements PluginWithInitFn, PluginWithPreRunFn, PluginWithPostRunFn, PluginWithShutdownFn
{
	// eslint-disable-next-line class-methods-use-this
	readonly init: PluginInitFn = (pluginArgs) =>
		new Promise((done) => {
			process.nextTick(() => {
				config = pluginArgs;
				done();
			});
		});

	// eslint-disable-next-line class-methods-use-this
	readonly preRun: PluginPreRunFn = async (args) =>
		new Promise((done) => {
			process.nextTick(() => {
				preRunArgs = args;
				done();
			});
		});

	// eslint-disable-next-line class-methods-use-this
	readonly postRun: PluginPostRunFn = async (args) =>
		new Promise((done) => {
			process.nextTick(() => {
				postRunArgs = args;
				done();
			});
		});

	// eslint-disable-next-line class-methods-use-this
	readonly shutdown: PluginShutdownFn = async (checkResult) =>
		new Promise((done) => {
			process.nextTick(() => {
				result = checkResult;
				done();
			});
		});
}
export default EmptyStateGeneratorLifecylePlugin;
