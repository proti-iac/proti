# S3 Website

A simple static website that is hosted in an AWS S3 bucket.

## Versions

* `flat`: Only uses built-in options for resource dependencies, i.e., direct dependence, lifting and interpolation.
* `cb-dependent`: Uses apply callback based resource dependencies.

## Execution

`pulumi preview` executes the IaC program to generate a preview on the state update.
However, it does not execute apply callbacks as long as the output values they are applied to are not available.
In particular, `pulumi preview` on `flat` shows that three new resources will be created,
while `pulumi preview` on `cb-dependent` only shows the creation of one resource.
Due to this difference,
`flat-throws` fails already in preview,
but `cb-dependent-throws` fails after the bucket resource was deployed.

## Buggy Versions

* `*-throws`: Throws an exception.
* `*-redirect`: Configures bucket object with invalid redirect url.

| Example               | Preview | ProTI | Deployment |
| --------------------- | ------- | ----- | ---------- |
| `flat`                | ✅       | ✅     | ✅          |
| `flat-throws`         | ❌       | ❌     | ❌          |
| `flat-redirect`       | ✅       | (✅)   | ❌          |
| `cb-dependent`        | ✅       | ✅     | ✅          |
| `cb-dependent-throws` | ✅       | ❌     | ❌          |
