import * as fc from 'fast-check';
import {
	isGeneratorPlugin,
	isOraclePlugin,
	isPluginWithInitFn,
	isPluginWithPreRunFn,
	isPluginWithPostRunFn,
	isPluginWithShutdownFn,
	type PluginWithInitFn,
	type PluginWithPreRunFn,
	type PluginWithPostRunFn,
	type PluginWithShutdownFn,
} from '../src/plugin';

describe('plugin type guards', () => {
	it('should guard GeneratorPlugin', () => {
		expect(isGeneratorPlugin(fc.integer())).toBe(true);
		expect(isGeneratorPlugin('')).toBe(false);
		expect(isGeneratorPlugin({})).toBe(false);
	});

	it('should guard OraclePlugin', () => {
		expect(
			isOraclePlugin({ name: '', newRunState: () => {}, validateResource: async () => {} })
		).toBe(true);
		expect(isOraclePlugin('')).toBe(false);
		expect(isOraclePlugin({})).toBe(false);
		expect(isOraclePlugin({ name: '', newRunState: () => {}, validateResource: '' })).toBe(
			false
		);
	});

	it('should guard PluginWithInitFn', () => {
		const v: PluginWithInitFn = { init: async () => {} };
		expect(isPluginWithInitFn(v)).toBe(true);
		expect(isPluginWithInitFn('')).toBe(false);
		expect(isPluginWithInitFn({})).toBe(false);
		expect(isPluginWithInitFn({ init: '' })).toBe(false);
	});

	it('should guard PluginWithPreRunFn', () => {
		const v: PluginWithPreRunFn = { preRun: async () => {} };
		expect(isPluginWithPreRunFn(v)).toBe(true);
		expect(isPluginWithPreRunFn('')).toBe(false);
		expect(isPluginWithPreRunFn({})).toBe(false);
		expect(isPluginWithPreRunFn({ preRun: '' })).toBe(false);
	});

	it('should guard PluginWithPostRunFn', () => {
		const v: PluginWithPostRunFn = { postRun: async () => {} };
		expect(isPluginWithPostRunFn(v)).toBe(true);
		expect(isPluginWithPostRunFn('')).toBe(false);
		expect(isPluginWithPostRunFn({})).toBe(false);
		expect(isPluginWithPostRunFn({ postRun: '' })).toBe(false);
	});

	it('should guard PluginWithShutdownFn', () => {
		const v: PluginWithShutdownFn = { shutdown: async () => {} };
		expect(isPluginWithShutdownFn(v)).toBe(true);
		expect(isPluginWithShutdownFn('')).toBe(false);
		expect(isPluginWithShutdownFn({})).toBe(false);
		expect(isPluginWithShutdownFn({ shutdown: '' })).toBe(false);
	});
});
