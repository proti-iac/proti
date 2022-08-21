import * as pulumi from '@pulumi/pulumi';
import { Config } from './config';

declare const proti: Config;

describe(proti.projectDir, () => {
	beforeAll(async () => {
		// We need to mutate the same runtime instance that is later used by the Pulumi project
		const projPulumiPath = require.resolve('@pulumi/pulumi', { paths: [proti.projectDir] });
		const projectPulumi: typeof pulumi = await import(projPulumiPath);

		projectPulumi.runtime.setMocks({
			newResource(args: pulumi.runtime.MockResourceArgs): { id: string; state: any } {
				return {
					id: `${args.inputs.name}_id`,
					state: args.inputs,
				};
			},
			call(args: pulumi.runtime.MockCallArgs) {
				return args.inputs;
			},
		});
	});

	it('should run', async () => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const outputs = await import(proti.projectDir);

		// Wait for all async code to settle
		await new Promise(process.nextTick);
	});
});
