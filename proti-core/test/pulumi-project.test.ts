import { YAMLException } from 'js-yaml';
import * as path from 'path';
import { PulumiProject, readPulumiProject } from '../src/pulumi-project';

describe('pulumi project', () => {
	const validProjects: (Omit<PulumiProject, 'main'> & Partial<PulumiProject>)[] = [
		{ projectFile: 'pulumi-project/Pulumi.yaml' },
		{
			projectFile: 'pulumi-project/Pulumi2.yaml',
			name: 'test',
			description: 'A minimal AWS TypeScript Pulumi program',
		},
		{
			projectFile: 'pulumi-project/Pulumi3.yaml',
			main: '/hello/world.ts',
			name: 'test',
			description: 'A minimal AWS TypeScript Pulumi program',
		},
	];

	it.each(
		validProjects.map((partialProject) => {
			const projectFile = path.resolve(__dirname, partialProject.projectFile);
			return [
				projectFile,
				{
					...partialProject,
					projectFile,
					main: partialProject.main || path.dirname(projectFile),
				},
			];
		})
	)('should load %s', (projectFile, project) =>
		expect(readPulumiProject(projectFile)).resolves.toStrictEqual(project)
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
