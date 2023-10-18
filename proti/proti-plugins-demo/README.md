# @proti/plugins-demo

[![NPM version](https://badge.fury.io/js/%40proti%2Fplugins-demo.svg)](https://npmjs.com/package/@proti/plugins-demo)
[![License](https://img.shields.io/github/license/proti-iac/proti)](LICENSE)

This package demonstrates the implementation of a [ProTI](https://proti-iac.github.io/) generator and a [ProTI](https://proti-iac.github.io/) oracle plugin. The [demo generator](./src/demo-arbitrary.ts) simply generates an empty output configuration for all resources. The [demo oracle](./src/demo-oracle.ts) checks whether all resource URNs in the IaC program are unique. Both plugins and the [config](./src/config.ts) demonstrate how ProTI plugins can leverage ProTI's interface for ProTI plugin user configuration through Jest. Use this package as a starter blueprint for your own ProTI plugin implementations.

For development, we provide some general instructions under the [Developers Guide](../README.md#developers-guide) in the main README of this repository.

This package implements a rudimentary end-to-end test using one of the example Pulumi TypeScript programs in this project. You can run it through jest by running `yarn test`.

## Implementing Generator Plugins

[`src/demo-arbitrary.ts`](./src/demo-arbitrary.ts) is an example ProTI generator plugin. Generator modules must have a default export that implements `Arbitrary<Generator>`. `Arbitrary` is the arbitrary abstraction from fast-check, and [`Generator`](../proti-core/src/generator.ts) the test generator abstraction of ProTI. ProTI draws one generator from the arbitrary per test run. The generator itself is then invoked throughout the test run to incrementally provide the input for the test run, practically unfolding the test case.

## Implementing Oracle Plugins

[`src/demo-oracle.ts`](./src/demo-oracle.ts) is an example ProTI oracle plugin. Oracle modules must have a default export that implements one of [ProTI's oracle interfaces](../proti-core/src/oracle.ts). The following oracle interfaces exist:

* `ResourceOracle` is for oracles that are synchronously invoked for every resource on its definition.
* `AsyncResourceOracle` is like `ResourceOracle` but asynchronous.
* `DeploymentOracle` is for oracles that are synchronously invoked on the entire deployment configuration at the end of the IaC program execution.
* `AsyncDeploymentOracle` is like `DeploymentOracle` but asynchronous.

The oracle interfaces are parameterized by the type of their state. Such state is initialized in each test run through the `newRunState` method and then passed into each validation method call. Validation methods may mutate the state, which is visible across all validation calls on the oracle plugin during the specific test run.

## Using This Plugin

In the following, we assume the current package name `@proti/plugins-demo`. Replace it with your own package's name, if you used this package as a blueprint.

[Set up ProTI](https://proti-iac.github.io/#getting-started) in your Pulumi TypeScript IaC project and install this package:

```bash
npm install --save-dev @proti/plugins-demo
```

If you do not want to go through the central NPM registry, e.g., during development, you can instead link the package or pack it and install it through the packaged archive.

Configure ProTI's generator and oracle plugins options to use this package's plugins. Set the following two options in Jest's configuration, e.g., in your project's `jest.config.js` file:

```js
/* ... */
/** @type {import('jest').Config} */
const config = {
	/* ... */
	globals: {
		proti: {
			testCoordinator: {
				arbitrary: "@proti/plugins-demo/demo-arbitrary",
				oracles: ["@proti/plugins-demo/demo-arbitrary", /* ... */],
			},
			/* ... */
		},
		/* ... */
	},
	/* ... */
};
module.exports = config;
```

This package is configurable. The options are defined by the [exported `Config` type](./src/config.ts). This configuration can be defined under `globals.proti.plugins.plugins-demo`.
