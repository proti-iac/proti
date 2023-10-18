import * as aws from "@pulumi/aws";

const buckets = [
	new aws.s3.Bucket("1").id,
	new aws.s3.Bucket("2").id,
	new aws.s3.Bucket("3").id,
	new aws.s3.Bucket("4").id,
	new aws.s3.Bucket("5").id,
	new aws.s3.Bucket("6").id,
	new aws.s3.Bucket("7").id,
	new aws.s3.Bucket("8").id,
	new aws.s3.Bucket("9").id,
	new aws.s3.Bucket("10").id,
];

// Export the names of the buckets
export const bucketNames = buckets;
