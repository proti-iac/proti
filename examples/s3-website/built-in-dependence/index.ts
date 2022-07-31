import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Create an AWS resource (S3 Bucket)
const bucket = new aws.s3.Bucket("website", { website: { indexDocument: 'index.html' } });
const index = new aws.s3.BucketObject('index', {
    bucket, // Direct dependency
    content: pulumi.interpolate `
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
    contentType: 'text/html; charset=utf-8'
});

// Set the access policy for the bucket so all objects are readable
const bucketPolicy = new aws.s3.BucketPolicy("bucketPolicy", {
    bucket: bucket.bucket, // Direct dependency
    policy: {
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Principal: "*",
            Action: "s3:GetObject",
            Resource: pulumi.interpolate `${bucket.arn}/*` // Interpolation dependency
        }]
    }
});

// Export the name of the bucket
export const url = bucket.websiteEndpoint; // Direct dependency
