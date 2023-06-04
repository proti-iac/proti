# ProTI

ProTI automates unit testing of Pulumi TypeScript programs leveraging fuzzing and property-based testing techniques.

This project contains the following packages:

* [@proti/core](./proti-core/): Implements the ProTI.
* [@proti/pulumi-packages-schema](./proti-pulumi-packages-schema/): ProTI generator arbitrary and oracle based on Pulumi packages schema.
* [@proti/reporter](./proti-reporter/): Jest reporter exporting detailed run information in CSV format that is provided by ProTI test runner.
* [@proti/runner](./proti-runner/): Jest runner of ProTI, providing additional context to the ProTI test runner.
* [@proti/test-runner](./proti-test-runner/): Jest test runner, running ProTI on a single Pulumi TypeScript project.
* [@proti/transformer](./proti-transformer/): Custom TypeScript transfomer for ProTI. *Not used currently.*

## Pulumi Packages Schema Arbitrary and Oracle

The module maintains a registry that maps Pulumi resource type strings to their resource schema in their package's schema definition. The registry is initialized with the schemas found in the Jest project cache directory (from previous runs) and the ones defined in the `schemas` or `schemaFiles` fields of the plugin's configuration. If the oracle or arbitrary is called with a resource type string that is not in the registry, all `package.json` files loaded in ProTI's module loader are inspected for using `install-pulumi-plugin.js resource {PACKAGE}[ {VERSION}]`. If new packages are found, their schemas are loaded using pulumi's `package get-schema` command. It provides the schema of the locally installed package, downloading and installing the package automatically if it is missing in the local Pulumi workspace. Retrieved schemas are cached in the Jest project cache directory and preloaded into the registry in subsequent executions.

# Known Issues

## Mutable Type Definitions

Type definitions should leverage more immutability, e.g., with `Readonly<>` or `ReadonlyArray<>`.
https://levelup.gitconnected.com/the-complete-guide-to-immutability-in-typescript-99154f859fdb

## Parallel Test Runner

Problem: We use our own Jest runner `@proti/runner` to pass down the resolver to the test runner `@proti/test-runner`. This works well in single process execution. However, currently parallel multi-process execution is broken, most likely because serialization and deserialization of the resolver fails when Jest passes the resolver to the separate test runner processes.

Workaround: Only use single process execution. If multiple projects are tested, this can be enforced with `--runInBand` or `-i`.

## Jest Memory Leak

Problem: When testing multiple projects, the memory consumption is growing rapidly and the process runs quickly out of memory. Maybe we implemented a memory leak in the module loading or monke patching? However, this seems to be a known unsolved issue that actually has to be fixed by node or webkit: https://github.com/jestjs/jest/issues/7874 https://github.com/jestjs/jest/issues/11956

Workarounds: Run ProTI only individually on programs. Fix the "Parallel Test Runner" bug and use `--workerIdleMemoryLimit`.
