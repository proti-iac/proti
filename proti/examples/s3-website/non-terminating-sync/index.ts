import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';

// Create an AWS resource (S3 Bucket)
const bucket = new aws.s3.Bucket('website', { website: { indexDocument: 'index.html' } });
const index = new aws.s3.BucketObject('index', {
	bucket, // Direct dependency
	content: pulumi.interpolate`
<!DOCTYPE html>
<html lang="en">
	<head>
		<title>Hello world!</title>
	</head>
	<body>
		<p>Versioning enabled: ${bucket.versioning.enabled}</p>
	</body>
</html>`, // Lifting inside interpolation dependency
	key: 'index.html',
	contentType: 'text/html; charset=utf-8',
});

// Set the public access policy requires updating ownership controls and disabling block public access since May 2023
const ownershipControls = new aws.s3.BucketOwnershipControls('ownership-controls', {
	bucket: bucket.id,
	rule: { objectOwnership: 'ObjectWriter' },
});
const publicAccessBlock = new aws.s3.BucketPublicAccessBlock('public-access-block', {
	bucket: bucket.id,
	blockPublicAcls: false,
});
// Set the access policy for the bucket so all objects are readable
const bucketPolicy = new aws.s3.BucketPolicy(
	'bucketPolicy',
	{
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
	},
	{ dependsOn: [bucket, publicAccessBlock, ownershipControls] }
);

// Export the name of the bucket
export const url = bucket.websiteEndpoint; // Direct dependency

// Busy wait
// eslint-disable-next-line no-empty, no-constant-condition
while (true) {}
