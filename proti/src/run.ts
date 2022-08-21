#!/usr/bin/env node
import { run } from './cli';

run(process.argv.slice(2))
	.catch((err) => {
		console.error('❌ ProTI  failed 😰');
		console.error(err);
		process.exit(1);
	})
	.finally(() => {
		console.info('✅ ProTI completed. Have a nice day! 👋');
		process.exit(0);
	});
