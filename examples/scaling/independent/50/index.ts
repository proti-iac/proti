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
	new aws.s3.Bucket("11").id,
	new aws.s3.Bucket("12").id,
	new aws.s3.Bucket("13").id,
	new aws.s3.Bucket("14").id,
	new aws.s3.Bucket("15").id,
	new aws.s3.Bucket("16").id,
	new aws.s3.Bucket("17").id,
	new aws.s3.Bucket("18").id,
	new aws.s3.Bucket("19").id,
	new aws.s3.Bucket("20").id,
	new aws.s3.Bucket("21").id,
	new aws.s3.Bucket("22").id,
	new aws.s3.Bucket("23").id,
	new aws.s3.Bucket("24").id,
	new aws.s3.Bucket("25").id,
	new aws.s3.Bucket("26").id,
	new aws.s3.Bucket("27").id,
	new aws.s3.Bucket("28").id,
	new aws.s3.Bucket("29").id,
	new aws.s3.Bucket("30").id,
	new aws.s3.Bucket("31").id,
	new aws.s3.Bucket("32").id,
	new aws.s3.Bucket("33").id,
	new aws.s3.Bucket("34").id,
	new aws.s3.Bucket("35").id,
	new aws.s3.Bucket("36").id,
	new aws.s3.Bucket("37").id,
	new aws.s3.Bucket("38").id,
	new aws.s3.Bucket("39").id,
	new aws.s3.Bucket("40").id,
	new aws.s3.Bucket("41").id,
	new aws.s3.Bucket("42").id,
	new aws.s3.Bucket("43").id,
	new aws.s3.Bucket("44").id,
	new aws.s3.Bucket("45").id,
	new aws.s3.Bucket("46").id,
	new aws.s3.Bucket("47").id,
	new aws.s3.Bucket("48").id,
	new aws.s3.Bucket("49").id,
	new aws.s3.Bucket("50").id,
];

// Export the names of the buckets
export const bucketNames = buckets;
