# S3 Website

A simple static website that is hosted in an AWS S3 bucket.

## Versions

* `built-in-dependence`: Only uses built-in options for resource dependencies, i.e., direct dependence, lifting and interpolation.
* `callback-dependence`: Uses apply callback based resource dependencies.

## Execution

`pulumi preview` executes the IaC program to generate a preview on the state update.
However, it does not execute apply callbacks as long as the output values they are applied to are not available.
In particular, `pulumi preview` on `built-in-dependence` shows that three new resources will be created,
while `pulumi preview` on `callback-dependence` only shows the creation of one resource.
Due to this difference,
`built-in-dependency-buggy` fails already in preview,
but `callback-dependence-buggy` fails after the bucket resource was deployed.