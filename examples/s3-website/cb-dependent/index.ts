import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';

// Create an AWS resource (S3 Bucket)
const bucket = new aws.s3.Bucket('website', { website: { indexDocument: 'index.html' } });
// Apply callback dependency
const index = bucket.versioning.apply((versioning) => {
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

const bucketPolicy = pulumi
	.all([bucket.bucket, bucket.arn])
	// Apply callback dependency
	.apply(([bucket, arn]) => {
		// Set the access policy for the bucket so all objects are readable
		new aws.s3.BucketPolicy('bucketPolicy', {
			bucket: bucket, // Direct dependency
			policy: {
				Version: '2012-10-17',
				Statement: [
					{
						Effect: 'Allow',
						Principal: '*',
						Action: 's3:GetObject',
						Resource: `${arn}/*`, // No dependency, only TS string interpolation
					},
				],
			},
		});
	});

// Export the name of the bucket
export const url = bucket.websiteEndpoint; // Direct dependency
