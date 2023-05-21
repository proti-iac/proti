import { runPulumiCmd } from '@pulumi/pulumi/automation';

// Pulumi hides the runPulumiCmd export using @internal. To use it here, we provide the type declaration manually.
declare module '@pulumi/pulumi/automation' {
	class CommandResult {
		stdout: string;

		stderr: string;

		code: number;

		err?: Error;

		toString: () => string;
	}
	// eslint-disable-next-line @typescript-eslint/no-shadow
	const runPulumiCmd: (
		args: string[],
		cwd: string,
		additionalEnv: { [key: string]: string },
		onOutput?: (data: string) => void
	) => Promise<CommandResult>;
}
export const runPulumi = runPulumiCmd;
