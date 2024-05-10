import type { Config } from 'jest';
import { defaults as jestDefaults } from 'jest-config';
import * as path from 'path';
import * as fs from 'fs';
import { defaults } from 'ts-jest/presets';

const resolve = (...p: string[]) => path.resolve(__dirname, ...p);
const packageJson = JSON.parse(fs.readFileSync(resolve('package.json')).toString());
const config: Config = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	projects: packageJson.workspaces.map((packet: string) => {
		const packetConfig = fs.existsSync(resolve(packet, 'jest.config.ts'))
			? // eslint-disable-next-line global-require, import/no-dynamic-require
				require(resolve(packet, 'jest.config.ts'))
			: {};
		return {
			displayName: packet,
			preset: 'ts-jest',
			transform: Object.fromEntries(
				Object.entries(defaults.transform as any).map(([match, conf]) => [
					match,
					Array.isArray(conf) && conf[0] === 'ts-jest'
						? [
								'ts-jest',
								{
									...conf[1],
									tsconfig: resolve(packet, 'tsconfig.json'),
									...packetConfig?.globals?.tsJest,
								},
							]
						: conf,
				])
			),
			testMatch: jestDefaults.testMatch.map((m) => `${resolve(packet)}/${m}`),
			...packetConfig,
			setupFiles: [resolve('fast-check.setup.ts')],
		};
	}),
};

export default config;
