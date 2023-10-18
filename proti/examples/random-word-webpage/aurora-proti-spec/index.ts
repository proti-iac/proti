import * as ps from "@proti-iac/spec";
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as random from "@pulumi/random";

const words = ['software', 'is', 'great'];
const bucket = new aws.s3.Bucket('website', {
    website: { indexDocument: 'index.html'}
})
const rngRange = { min: 0, max: words.length - 1 };
const rng = new random.RandomInteger('word-id', rngRange);
ps.generate(rng.result).with(ps.integer(rngRange)).apply((wordId) => {
    return new aws.s3.BucketObject('index', {
        bucket: bucket, key: 'index.html',
        contentType: 'text/html; charset=utf-8',
        content: '<!DOCTYPE html>' + ps.expect(words[wordId].toUpperCase()).to((s) => s.length > 0)
    });
});

// Aurora setup based on https://gist.github.com/lukehoban/5c168258b641368dcccc7810dc454ca9, accessed on July 25, 2023
const vpc = new awsx.ec2.Vpc("vpc", {
	numberOfAvailabilityZones: 2,
	natGateways: { strategy: "None" }
});
const dbsubnet = new aws.rds.SubnetGroup("dbsubnet", {
    subnetIds: vpc.privateSubnetIds,
});
const db = new aws.rds.Cluster("db", {
    engine: "aurora-mysql",
    engineVersion: "8.0.mysql_aurora.3.04.0",
    dbSubnetGroupName: dbsubnet.name,
    masterUsername: "pulumi",
	masterPassword: "top-secret",
	skipFinalSnapshot: true
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
}, { dependsOn: [bucket, publicAccessBlock, ownershipControls, db] });

export const url = bucket.websiteEndpoint;
