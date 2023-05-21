import type { CommandResult } from '@pulumi/pulumi/automation';
import { runPulumi } from '../src/pulumi';

describe('run pulumi', () => {
	it('should err', () =>
		expect(runPulumi(['version', 'fail'], process.cwd(), {})).rejects.toThrow(
			/stderr: Command failed with exit code 255: pulumi version fail --non-interactive/
		));

	it('should not err', () =>
		expect(
			runPulumi(['version'], process.cwd(), {}).then(({ code, err }: CommandResult) => ({
				code,
				err,
			}))
		).resolves.toEqual({
			code: 0,
			err: undefined,
		}));
});
