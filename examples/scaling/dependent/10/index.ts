import type { Output } from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';

const defineBuckets = (count: number): Output<string[]> =>
	count == 1
		? new aws.s3.Bucket(`${count}`).id.apply((i) => [i])
		: defineBuckets(count - 1).apply((i) =>
				new aws.s3.Bucket(`${count}`).id.apply((j) => [...i, j])
		  );

const buckets = defineBuckets(10);

// Export the names of the buckets
export const bucketNames = buckets;
