import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { config } from '../src/config';
import { SchemaRegistry } from '../src/schemas';

describe('schema registry', () => {
	const conf = config();
	const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));

	afterAll(() => {
		fs.rmdirSync(cacheDir, { recursive: true });
	});

	describe('initialization', () => {
		it('should fail without initialization', () => {
			expect(() => SchemaRegistry.getInstance()).toThrow(/registry not initialized/);
		});

		it('should initialize once', () => {
			SchemaRegistry.initInstance(conf, cacheDir);
			const firstRegistry = SchemaRegistry.getInstance();
			SchemaRegistry.initInstance(conf, cacheDir);
			expect(SchemaRegistry.getInstance()).toBe(firstRegistry);
		});

		it('should replace on forced re-initialization', () => {
			SchemaRegistry.initInstance(conf, cacheDir);
			const firstRegistry = SchemaRegistry.getInstance();
			SchemaRegistry.initInstance(conf, cacheDir, true);
			expect(SchemaRegistry.getInstance()).not.toBe(firstRegistry);
		});
	});
});
