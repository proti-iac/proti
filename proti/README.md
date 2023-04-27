# ProTI

ProTI automates unit testing of Pulumi TypeScript programs leveraging fuzzing and property-based testing techniques.

This project contains the following packages:

* [jest-runner-proti]: A jest runner to run ProTI on Pulumi TypeScript programs.
* [proti-cli]: The ProTI CLI providing a convenient interface to run ProTI.
* [proti-core]: Implements the ProTI.

## ProTI Jest Runner

A Jest runner to be executed on `Pulumi.yaml` to run ProTI on the respective Pulumi TypeScript programs.

## ProTI CLI

Implements a ProTI's CLI providing a convenient interface to run ProTI through Jest and the ProTI Jest Runner on Pulumi TypeScript programs.

## ProTI Core

Implement ProTI.

# Known Issues

## Parallel Test Runner

Problem: We use our own Jest runner `@proti/runner` to pass down the resolver to the test runner `@proti/test-runner`. This works well in single process execution. However, currently parallel multi-process execution is broken, most likely because serialization and deserialization of the resolver fails when Jest passes the resolver to the separate test runner processes.

Workaround: Only use single process execution. If multiple projects are tested, this can be enforced with `--runInBand` or `-i`.

## Jest Memory Leak

Problem: When testing multiple projects, the memory consumption is growing rapidly and the process runs quickly out of memory. Maybe we implemented a memory leak in the module loading or monke patching? However, this seems to be a known unsolved issue that actually has to be fixed by node or webkit: https://github.com/jestjs/jest/issues/7874 https://github.com/jestjs/jest/issues/11956

Workarounds: Run ProTI only individually on programs. Fix the "Parallel Test Runner" bug and use `--workerIdleMemoryLimit`.
