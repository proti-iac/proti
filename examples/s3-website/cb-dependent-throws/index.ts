import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';

// Create an AWS resource (S3 Bucket)
const bucket = new aws.s3.Bucket('website', { website: { indexDocument: 'index.html' } });
// Apply callback dependency
const index = bucket.versioning.apply((versioning) => {
	throw new Error();
	return new aws.s3.BucketObject('index', {
		bucket, // Direct dependency
		content: `
<!DOCTYPE html>
<html lang="en">
	<head>
		<title>Hello world!</title>
	</head>
	<body>
		<p>Versioning enabled: ${versioning.enabled}</p>
	</body>
</html>`, // No dependency, only TS string interpolation
		key: 'index.html',
		contentType: 'text/html; charset=utf-8',
	});
});

// Set the public access policy requires updating ownership controls and disabling block public access since May 2023 
const ownershipControls = new aws.s3.BucketOwnershipControls("ownership-controls", {
    bucket: bucket.id,
    rule: { objectOwnership: "ObjectWriter" }
});
const publicAccessBlock = new aws.s3.BucketPublicAccessBlock("public-access-block", {
    bucket: bucket.id,
    blockPublicAcls: false,
});
// Set the access policy for the bucket so all objects are readable
const bucketPolicy = new aws.s3.BucketPolicy('bucketPolicy', {
	bucket: bucket.bucket, // Direct dependency
	policy: {
		Version: '2012-10-17',
		Statement: [
			{
				Effect: 'Allow',
				Principal: '*',
				Action: 's3:GetObject',
				Resource: pulumi.interpolate`${bucket.arn}/*`, // Interpolation dependency
			},
		],
	},
}, { dependsOn: ownershipControls });

// Export the name of the bucket
export const url = bucket.websiteEndpoint; // Direct dependency
