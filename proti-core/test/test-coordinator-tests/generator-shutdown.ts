import { EmptyStateGeneratorPlugin } from '../../src/generator-plugins/empty-state-generator-plugin';
import type { CheckResult } from '../../src/result';
import { type PluginShutdownFn, type PluginWithShutdownFn } from '../../src/plugin';

// eslint-disable-next-line import/no-mutable-exports
export let result: CheckResult;
class EmptyStateGeneratorWithShutdownPlugin
	extends EmptyStateGeneratorPlugin
	implements PluginWithShutdownFn
{
	// eslint-disable-next-line class-methods-use-this
	readonly shutdown: PluginShutdownFn = async (checkResult) =>
		new Promise((done) => {
			process.nextTick(() => {
				result = checkResult;
				done();
			});
		});
}
export default EmptyStateGeneratorWithShutdownPlugin;
