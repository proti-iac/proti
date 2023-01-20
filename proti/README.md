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
