import { Reporter } from '@jest/reporters';
import { Test, TestResult } from '@jest/test-result';
import { createHash } from 'crypto';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';
import * as path from 'path';
import { hrtime } from 'process';

export const reportDir: string = 'proti-report';
const reportExecutionsFile: string = path.join(reportDir, 'executions.csv');
const executionReportTestsFilename: string = 'tests.csv';
const toCsv = (data: any): string => stringify(data, { quoted_string: true });

const generateHash = (s: string) => createHash('sha3-224').update(s, 'utf8').digest('base64url');

export default class TestReporter implements Omit<Reporter, 'getLastError'> {
	private readonly executionId = Date.now();

	private startTime?: bigint;

	private endTime?: bigint;

	private readonly testFiles: Map<
		string,
		{
			startTime: bigint;
			endTime?: bigint;
			result?: TestResult;
		}
	> = new Map();

	onRunStart() {
		if (this.startTime) throw new Error('Start time already set');
		this.startTime = hrtime.bigint();
	}

	onTestFileStart(test: Test) {
		if (this.testFiles.has(test.path))
			throw new Error(`Test file already in report: ${test.path}`);
		this.testFiles.set(test.path, { startTime: process.hrtime.bigint() });
	}

	onTestFileResult(test: Test, testResult: TestResult) {
		const fileResult = this.testFiles.get(test.path);
		if (!fileResult) throw new Error(`Test file not in report: ${test.path}`);
		if (fileResult.endTime) throw new Error(`Test file's end time already set: ${test.path}`);
		fileResult.endTime = hrtime.bigint();
		fileResult.result = testResult;
	}

	onRunComplete() {
		if (this.endTime) throw new Error('End time already set');
		this.endTime = hrtime.bigint();
		this.writeReport();
	}

	private writeReport(): void {
		if (!this.startTime) throw new Error('Start time missing');
		if (!this.endTime) throw new Error('End time missing');
		this.testFiles.forEach((report, file) => {
			if (!report.endTime) throw new Error(`Test file's end time missing: ${file}`);
			if (!report.result) throw new Error(`Test file's result missing: ${file}`);
		});

		// Ensure report directories
		if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir);
		const executionReportDir = path.join(reportDir, `${this.executionId}`);
		fs.mkdirSync(executionReportDir);

		// Init executions overview if not existing
		if (!fs.existsSync(reportExecutionsFile)) {
			fs.writeFileSync(reportExecutionsFile, toCsv([['ID', 'Start', 'End', 'TestFiles']]));
		}

		// Write execution overview record
		fs.appendFileSync(
			reportExecutionsFile,
			toCsv([
				[
					this.executionId,
					this.startTime,
					this.endTime,
					Array.from(this.testFiles.keys()).map(generateHash),
				],
			])
		);

		// Write execution report
		const executionReport: any[][] = [
			[
				...['TestFile', 'FileName', 'Start', 'End', 'Memory', 'Success', 'Error'],
				...['TestCountPassed', 'TestCountFailing', 'TestCountPending'],
			],
		];
		this.testFiles.forEach((test, file) =>
			executionReport.push([
				generateHash(file),
				file,
				test.startTime,
				test.endTime,
				test.result?.memoryUsage,
				test.result?.failureMessage == null,
				test.result?.failureMessage,
				test.result?.numPassingTests,
				test.result?.numFailingTests,
				test.result?.numPendingTests,
			] as any[])
		);
		fs.writeFileSync(
			path.join(executionReportDir, executionReportTestsFilename),
			toCsv(executionReport)
		);

		// Write execution test file reports
		this.testFiles.forEach((test, file) => {
			const report: any[][] = [['Name', 'Duration', 'Status', 'Failures']];
			test.result?.testResults.forEach((result) =>
				report.push([
					result.fullName,
					result.duration,
					result.status,
					result.failureMessages,
				])
			);
			report.push([]);
			fs.writeFileSync(path.join(executionReportDir, generateHash(file)), toCsv(report));
		});
	}
}
