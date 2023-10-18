# @proti/pulumi-packages-schema

[![NPM version](https://badge.fury.io/js/%40proti%2Fpulumi-packages-schema.svg)](https://npmjs.com/package/@proti/pulumi-packages-schema)
[![License](https://img.shields.io/github/license/proti-iac/proti)](LICENSE)

This package implements a [ProTI](https://proti-iac.github.io/) generator and a [ProTI](https://proti-iac.github.io/) oracle plugin. They are type-based, leveraging input and output configuration type metadata from [Pulumi package schemas](https://www.pulumi.com/docs/using-pulumi/pulumi-packages/schema/). By design, these are available for all resource types distributed in [Pulumi packages](https://www.pulumi.com/product/packages/). The generator plugin composes primitive fast-check arbitraries to a complex arbitrary of the shape of the resource type's output configuration type and draws random output configuration values from such arbitrary. The oracle plugin checks all received input configurations for type compliance with the resource type's input configuration type. 

## [Getting Started](https://proti-iac.github.io/#getting-started)

[Set up ProTI](https://proti-iac.github.io/#getting-started) in your Pulumi TypeScript IaC project and install this package:

```bash
npm install --save-dev @proti/pulumi-packages-schema
```

Configure ProTI's generator and oracle plugins options to use this package's plugins. Set the following two options in Jest's configuration, e.g., in your project's `jest.config.js` file:

```js
/* ... */
/** @type {import('jest').Config} */
const config = {
	/* ... */
	globals: {
		proti: {
			testCoordinator: {
				arbitrary: "@proti/pulumi-packages-schema/arbitrary",
				oracles: ["@proti/pulumi-packages-schema/oracle", /* ... */],
			},
			/* ... */
		},
		/* ... */
	},
	/* ... */
};
module.exports = config;
```

This package is configurable. The options are defined by the [exported `Config` type](./src/config.ts). This configuration can be defined under `globals.proti.plugins.pulumi-packages-schema`. For instance, to disable the schema registry's schema cache you can set `globals.proti.plugins.pulumi-packages-schema.registry.cacheDownloadedSchemas` of the `config` object in your project's `jest.config.js` file to `false`.

## Schema Registry

This package maintains a registry that maps Pulumi resource type strings to their resource schema in their package's schema definition. The registry is initialized with the schemas found in the Jest project cache directory (from previous runs) and the ones defined in the `schemas` or `schemaFiles` fields of the plugin's configuration. If the oracle or arbitrary is called with a resource type string that is not in the registry, all `package.json` files loaded in ProTI's module loader are inspected for using `install-pulumi-plugin.js resource {PACKAGE}[ {VERSION}]`. If new packages are found, their schemas are loaded using pulumi's `package get-schema` command. It provides the schema of the locally installed package, downloading and installing the package automatically if it is missing in the local Pulumi workspace. Retrieved schemas are cached in the Jest project cache directory and preloaded into the registry in subsequent executions.
