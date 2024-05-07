import { EmptyStateGeneratorArbitrary } from '../../src/arbitraries/empty-state-generator-arbitrary';
import type { CheckResult } from '../../src/result';
import type { PluginShutdownFn } from '../../src/plugin';

export default EmptyStateGeneratorArbitrary;

// eslint-disable-next-line import/no-mutable-exports
export let result: CheckResult;
export const shutdown: PluginShutdownFn = async (checkResult) =>
	new Promise((done) => {
		process.nextTick(() => {
			result = checkResult;
			done();
		});
	});
