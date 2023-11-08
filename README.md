# <img src="https://proti-iac.github.io/assets/img/logo.svg" alt="ProTI" width="200" />

![CI workflow](https://github.com/proti-iac/proti/actions/workflows/ci.yaml/badge.svg)
[![GitHub version](https://badge.fury.io/gh/proti-iac%2Fproti.svg)](https://badge.fury.io/gh/proti-iac%2Fproti)
[![NPM version](https://badge.fury.io/js/@proti-iac%2Fcore.svg)](https://badge.fury.io/js/@proti-iac%2Fcore)
[![License](https://img.shields.io/github/license/proti-iac/proti)](./LICENSE)
[![DOI](https://zenodo.org/badge/706779109.svg)](https://zenodo.org/doi/10.5281/zenodo.10028479)

[ProTI](https://proti-iac.github.io) is an automated unit testing tool for Infrastructure as Code (IaC) programs. ProTI implements [Automated Configuration Testing (ACT)](https://proti-iac.github.io/#approach) for [Pulumi](https://pulumi.com) TypeScript, minimizing the development effort for unit testing Pulumi TypeScript IaC programs. ProTI is extensible through test generator and oracle plugins and leverages ideas from [fuzzing](https://en.wikipedia.org/wiki/Fuzzing) and [property-based testing](https://en.wikipedia.org/wiki/Software_testing#Property_testing).

ProTI builds upon [Jest](https://jestjs.io/), implementing the Jest runner [`@proti-iac/runner`](./proti-runner/), the Jest test-runner [`@proti-iac/test-runner`](./proti-test-runner/), and the Jest reporter [`@proti-iac/reporter`](./proti-reporter/). [`@proti-iac/core`](./proti-core/) and [`@proti-iac/spec`](./proti-spec/) implement the core abstractions and the inline specification syntax, leveraging [fast-check](https://fast-check.dev) for random-based testing abstractions. [`@proti-iac/pulumi-packages-schema`](./proti-pulumi-packages-schema/) implements the first type-based generator and oracle plugins. [`@proti-iac/plugins-demo`](./proti-plugins-demo/) demonstrates the setup of an NPM package of configurable ProTI generator and oracle plugins, serving as a blueprint for new ProTI plugins.

![Overview of ProTI's NPM packages](https://proti-iac.github.io/assets/img/proti-packages.svg)

## [Getting Started](https://proti-iac.github.io/#getting-started)

To work with ProTI you require an installation of [NodeJS](https://nodejs.org/) with NPM. ProTI is developed with and supports NodeJS 18 LTS.

### Using ProTI to Test a Pulumi TypeScript IaC Program

1. [Set up Jest](https://jestjs.io/docs/getting-started) in the project. Using NPM and `ts-jest` for the transpilation, you can run these commands in the project directory:

```bash
npm install --save-dev jest ts-jest
```

2. Install [`@proti-iac/runner`](./proti-runner/) and [`@proti-iac/test-runner`](./proti-test-runner/):

```bash
npm install --save-dev @proti-iac/runner @proti-iac/test-runner
```

3. Configure Jest to invoke ProTI. The easiest way to do so is to inherit the ProTI configuration preset from [`@proti-iac/test-runner`](./proti-test-runner/). You can configure Jest by creating a `jest.config.js` file in the root of your project with this content:

```js
/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

/** @type {import('jest').Config} */
const config = {
	preset: "@proti-iac/test-runner",
};
module.exports = config;
```

Add further configuration to the file to augment Jest's, ts-jest's, and ProTI's default configuration. The default configuration configures a simple empty state test generator and an oracle that only checks URN uniqueness across all resources, which are implemented in [`@proti-iac/core`](./proti-core/). Most likely, you want to configure more sophisticated generator and generator plugins. [The next section](#configuring-proti) describes how. Concretely, [`@proti-iac/pulumi-packages-schema`'s README](./proti-pulumi-packages-schema/README.md) describes how to install and configure our first type-based plugins.

4. Run ProTI by running Jest on the project:

```bash
npx jest
```

### Configuring ProTI

[`@proti-iac/test-runner`](./proti-test-runner/) exports [ProTI's Jest configuration preset](./proti-test-runner/src/jest-preset.ts). ProTI exposes all configuration options through Jest's configuration interface under the path `globals.proti`. The type of `globals.proti` and thus ProTI's configuration options are defined and documented in [ProTI's core `Config` type](./proti-core/src/config.ts).

The generator plugin and the set of oracle plugins are configured in the test coordinator configuration. The generator plugin is configured as a NodeJS module resolution string in `globals.proti.testCoordinator.arbitrary`, and the oracle plugins as an array of NodeJS module resolution strings in `globals.proti.testCoordinator.oracles`.

The test runner configuration object under `globals.proti.testRunner` is passed as a whole to fast-check's runner in ProTI's test runner, inheriting all [configuration options of fast-check](https://fast-check.dev/api-reference/interfaces/Parameters.html). For instance, you can configure the test runner's verbosity level in `globals.proti.testRunner.verbose`. `0` only shows the final error result, `1` all failing tests, `2` the full tree of passing and failing tests.

ProTI plugins are configured through `globals.proti.plugins.[PLUGIN NAME]`. For instance, the schema registry's schema cache of [`@proti-iac/pulumi-packages-schema`](./proti-pulumi-packages-schema/) can be disabled by setting `globals.proti.plugins.pulumi-packages-schema.registry.cacheDownloadedSchemas` to `false`.

### Using ProTI's Inline Specifications

To use ProTI's inline specification syntax, additionally, install the [`@proti-iac/spec`](./proti-spec/) package as a dependency (not only as a development dependency):

```bash
npm install --save @proti-iac/spec
```

Simply import the package in your IaC program's code and use the syntax it exports:

```ts
import * as ps from "@proti-iac/spec";
```

As an example of its use, you can have a look at the [correct random word website example with ProTI inline specifications](./examples/random-word-webpage/correct-proti-spec/index.ts).

### Detailed Reporting

For detailed reporting in CSV format, additionally install the [`@proti-iac/reporter`](./proti-reporter/) package, and [configure it as Jest reporter](https://jestjs.io/docs/configuration#reporters-arraymodulename--modulename-options).

### Developing ProTI Plugins

ProTI is extended through generator and oracle plugins. Implementing either is simple and demonstrated in [`@proti-iac/plugins-demo`](./proti-plugins-demo/). This package serves as a blueprint for new plugins. Please refer to its code and documentation for further details. Once developed, configure your IaC program to load your plugin as described above under [Configuring ProTI](#configuring-proti).

## Developers Guide

This project uses yarn. Initialize all dependencies by running `yarn`. Further, some end-to-end tests use the example Pulumi TypesScript projects under [`examples/`](./examples/). To install their dependencies, first, run `yarn pack:all` in the root directory of this repository and then `pnpm install` in [`examples/`](./examples/).

All ProTI packages implement the following commands. Running the respective command in the root directory of this repository executes it for all packages.

* `yarn build` builds the package incrementally.
* `yarn clean` deletes the build.
* `yarn lint` runs eslint to indicate simple errors and formatting.
* `yarn test` builds the package and runs all tests.
* `yarn prepack` deletes the build and rebuilds the package. This is also run during `yarn npm publish`.

[`@proti-iac/test-runner`](./proti-test-runner/) and the plugin packages [`@proti-iac/plugins-demo`](./proti-plugins-demo/) and [`@proti-iac/pulumi-packages-schema`](./proti-pulumi-packages-schema/) further feature `yarn dev` for development, running Jest configured with the configuration preset of [`@proti-iac/test-runner`](./proti-test-runner/) and the respective generator and oracle plugins.

## Known Issues

### Resolving Pulumi Package Schemas

Problem: With Pulumi versions 3.72.0 and 3.73.0 retrieving package schemas of Pulumi packages that are not installed yet leads to a panic in Pulumi's CLI. In ProTI, this means such schemas cannot be resolved. This was [fixed in 3.74.0](https://github.com/pulumi/pulumi/issues/13279).

Workaround: Use another Pulumi version than 3.72.0 or 3.73.0.

### Parallel Test Runner

We use our own Jest runner [`@proti-iac/runner`](./proti-runner/) to pass down the resolver to the test runner [`@proti-iac/test-runner`](./proti-test-runner/). This works well in single-worker execution. However, currently, parallel multi-worker execution is broken, most likely because serialization and deserialization of the resolver fails when Jest passes the resolver to the separate test runner.

Workaround: Only use single-worker execution. If multiple projects are tested, this can be enforced with `--runInBand` or `-i`.

### Jest Memory Leak

Problem: When testing multiple projects, the memory consumption is growing rapidly and the process runs quickly out of memory. Maybe there is a memory leak in the module loading or monkey patching. However, this seems to be a known unsolved issue that has to be fixed by NodeJS or WebKit: https://github.com/jestjs/jest/issues/7874 https://github.com/jestjs/jest/issues/11956

Workarounds: Run ProTI only individually on programs. Fix the "Parallel Test Runner" bug and use `--workerIdleMemoryLimit`.

## Some Design Considerations

We aim to leverage some cool concepts in our code:

* Immutable types: Wherever possible we want to immutable `readonly` type definitions, i.e., through `Readonly<...>`, `ReadonlyArray<...>`, `ReadonlySet<...>`, and `ReadonlyMap<..., ...>`. [`@proti-iac/core`](./proti-core/) implements a `DeepReadonly<...>` utility which makes this easier. More about immutable types in TypeScript: https://levelup.gitconnected.com/the-complete-guide-to-immutability-in-typescript-99154f859fdb
* Stateless arbitraries: fast-check arbitraries are meant to be stateless, allowing safe re-use across tests. We embrace this and try to re-use instantiated arbitraries wherever possible for better run time and resource efficiency. 
