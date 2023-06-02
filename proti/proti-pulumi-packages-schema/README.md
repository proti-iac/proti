# ProTI Pulumi Package Schema

Pulumi package schema based generator oracle and validator.

## Update Pulumi Package Schema JSON Schema

For typing and package schema validation, this package uses generated types of Pulumi's package schema JSON schema. The JSON schema is downloaded from Pulumi's main repository head and the types are in `pulumi-generated.ts`, which is a fully generated file. To update it, run `yarn update-schema`.
