import { createJestRunner } from 'create-jest-runner';

export default createJestRunner(require.resolve('./runner'));
