import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as random from "@pulumi/random";

const words = ['software', 'is', 'great'];
const bucket = new aws.s3.Bucket('website', {
    website: { indexDocument: 'index.html'}
})
const rng = new random.RandomInteger('word-id', {
    min: 0, max: words.length
});
rng.result.apply((wordId) => {
    return new aws.s3.BucketObject('index', {
        bucket: bucket, key: 'index.html',
        contentType: 'text/html; charset=utf-8',
        content: '<!DOCTYPE html>' + words[wordId].toUpperCase()
    });
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
});


export const url = bucket.websiteEndpoint;
