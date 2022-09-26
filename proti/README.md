# ProTI

## Module Preloading

Importing modules is an expensive operation and causes single test execution times in the magnitude of seconds – even for very simple Pulumi TypeScript programs. Thus, we want to reuse as many imported modules as possible. However, reusing imports also shares the modules' state between the test runs, which may violate test isolation if the test runs interfere through shared module state.

ProTI searches for imports in a Pulumi TypeScript program. It is configurable, which imported modules ProTI preloads. ProTI preloads all modules given in `--preload`. In addition, setting `--preload{Absolute,Relative,Package}Imports` preloads all modules that are imported through an absolute file path, relative file path, or a package name respectively. By default, the `@pulumi/pulumi` module and all other package imports are preloaded (`--preload` is `['@pulumi/pulumi']` and only `--preloadPackageImports` is set). All other modules are dynamically imported in each test execution.

The module import search is configurable as well. If `--searchImportsProjectMain` is set, ProTI searches in the project's main file. Additionally, further absolute file paths, relative file paths, or package names to start the search from can be provided with `--searchImportsFrom`. If `--searchImportsRecursively` is set, the search recursively follows all found module imports that are not selected for preloading. Specific modules can be ignored in the search results by providing their identifier with `--searchImportsExclude`. By default, ProTI starts searching only from the project's main file, searches recursively in all imports that are not preloaded, and ignores no modules in the search results.

`--showPreloadedImports` and `--showDynamicImports` can be set to identify which modules ProTI preloads and which ones it dynamically imports during each test run. They can be used to detect modules that are not imported in the ideal fashion, i.e., modules that could be preloaded but are dynamically imported and vice versa.

## Backlog

* Test utitlities
