import * as aws from "@pulumi/aws";

const buckets = [
	new aws.s3.Bucket("1").id
];

// Export the names of the buckets
export const bucketNames = buckets;
