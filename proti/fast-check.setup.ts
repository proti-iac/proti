// eslint-disable-next-line import/no-extraneous-dependencies
import * as fc from 'fast-check';

fc.configureGlobal({ ...fc.readConfigureGlobal(), numRuns: 100 });
