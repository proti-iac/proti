import { YAMLException } from 'js-yaml';
import * as path from 'path';
import { PulumiProject, readPulumiProject } from '../src/pulumi-project';

describe('pulumi project', () => {
	/**
	 * Expected project configs for Pulumi project YAML files in the ./pulumi-project/ subdirectory
	 */
	const validProjects: PulumiProject[] = [
		{
			projectFile: path.resolve(__dirname, 'pulumi-project/Pulumi.yaml'),
			main: path.resolve(__dirname, 'pulumi-project'),
		},
		{
			projectFile: path.resolve(__dirname, 'pulumi-project/Pulumi2.yaml'),
			main: path.resolve(__dirname, 'pulumi-project'),
			name: 'test',
			description: 'A minimal AWS TypeScript Pulumi program',
		},
		{
			projectFile: path.resolve(__dirname, 'pulumi-project/Pulumi3.yaml'),
			main: '/hello/world.ts',
			name: 'test',
			description: 'A minimal AWS TypeScript Pulumi program',
		},
		{
			projectFile: path.resolve(__dirname, 'pulumi-project/Pulumi4.yaml'),
			main: path.resolve(__dirname, 'pulumi-project/hello/world.ts'),
		},
	];
	it.each(validProjects)('should load %s', (project) =>
		expect(readPulumiProject(project.projectFile)).resolves.toStrictEqual(project)
	);

	it('should throw on invalid path', () => {
		const projectFile = path.resolve(__dirname, 'pulumi-project/PulumiDoesNotExist.yaml');
		return expect(readPulumiProject(projectFile)).rejects.toThrow('no such file');
	});

	it('should throw on invalid format', () => {
		const projectFile = path.resolve(__dirname, 'pulumi-project/PulumiInvalid.yaml');
		return expect(readPulumiProject(projectFile)).rejects.toThrow(YAMLException);
	});

	it.each(
		['pulumi-project/empty', 'pulumi-project/PulumiJs.yaml'].map((projectFile) =>
			path.resolve(__dirname, projectFile)
		)
	)('should throw on non-TypeScript project %s', (projectFile) =>
		expect(readPulumiProject(projectFile)).rejects.toThrow('not a Pulumi TypeScript project')
	);
});
