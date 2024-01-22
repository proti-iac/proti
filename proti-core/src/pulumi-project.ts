import * as yaml from 'js-yaml';
import * as fs from 'fs';
import path from 'path';

export type PulumiProject = Readonly<{
	projectFile: string;
	main: string;
	name?: string;
	description?: string;
}>;

export const readPulumiProject = async (projectFile: string): Promise<PulumiProject> => {
	const project: any = yaml.load(fs.readFileSync(projectFile, 'utf8'));

	const isTypeScriptProgram =
		project?.runtime === 'nodejs' ||
		(project?.runtime?.name === 'nodejs' && project?.runtime?.options?.typescript !== false);
	if (!isTypeScriptProgram) throw new Error(`${projectFile} is not a Pulumi TypeScript project`);

	return {
		projectFile,
		main:
			typeof project.main === 'string'
				? path.resolve(path.dirname(projectFile), project.main)
				: path.dirname(projectFile),
		...(typeof project.name === 'string' ? { name: project.name } : {}),
		...(typeof project.description === 'string' ? { description: project.description } : {}),
	};
};
