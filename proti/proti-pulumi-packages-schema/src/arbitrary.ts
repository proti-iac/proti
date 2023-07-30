import * as fc from 'fast-check';
import {
	createAppendOnlyMap,
	type Generator,
	type ResourceArgs,
	type ResourceOutput,
	type TestModuleInitFn,
	TraceGenerator,
} from '@proti/core';
import { secret, asset } from '@pulumi/pulumi';
import { is } from 'typia';
import { initModule } from './utils';
import { SchemaRegistry } from './schema-registry';
import { type ArbitraryConfig, config } from './config';
import {
	type ArrayTypeTransform,
	type BuiltInTypeTransform,
	type ConstTransform,
	type CycleBreakerTransform,
	type EnumTypeDefinitionTransform,
	type MapTypeTransform,
	type MutableTransforms,
	type NamedTypeArgs,
	type NormalizedUri,
	type NormalizedResourceUri,
	type ObjectTypeDetailsTransform,
	type PrimitiveTypeTransform,
	type PropertyDefinitionTransform,
	type ResourceDefinitionTransform,
	type SecretTransform,
	type Transforms,
	type TypeDefinition,
	type UnionTypeTransform,
	type UnresolvableUriTransform,
	type Urn,
	transformResourceDefinition,
	transformTypeDefinition,
} from './pulumi';

export type Arbitrary<T = unknown> = fc.Arbitrary<T>;

/**
 * Caching arbitraries under their normalized Pulumi type reference URI.
 */
export type ArbitraryCache = ReadonlyMap<NormalizedUri, Promise<Arbitrary>>;

export const builtInTypeArbitrary: BuiltInTypeTransform<Arbitrary> = async (type, path) => {
	const pulumiAssetArb = fc
		.tuple(
			fc.constantFrom(asset.FileAsset, asset.RemoteAsset, asset.StringAsset),
			fc.string({ minLength: 1 })
		)
		.map(([Asset, s]) => new Asset(s));
	const pulumiArchiveArb = fc.oneof(
		fc
			.tuple(
				fc.constantFrom(asset.FileArchive, asset.RemoteArchive),
				fc.string({ minLength: 1 })
			)
			.map(([Archive, s]) => new Archive(s)),
		fc
			.dictionary(fc.string(), pulumiAssetArb, { minKeys: 1 })
			.map((assetMap) => new asset.AssetArchive(assetMap))
	);
	if (type === 'pulumi.json#/Archive') return pulumiArchiveArb;
	if (type === 'pulumi.json#/Asset') return pulumiAssetArb;
	if (type === 'pulumi.json#/Any') return fc.anything();
	if (type === 'pulumi.json#/Json') return fc.json();
	throw new Error(`${path} has unknown built-in type ${type}`);
};

export const unresolvableUriArbitrary =
	(
		conf: ArbitraryConfig,
		transforms: Transforms<Arbitrary>,
		ntArgs: NamedTypeArgs<Arbitrary>
	): UnresolvableUriTransform<Arbitrary> =>
	async (uri, path) => {
		const errMsg = `${path} has unknown type reference to ${uri}`;
		if (conf.failOnMissingTypeReference) throw new Error(errMsg);
		console.warn(`${errMsg}. Using default type reference definition"`);
		const definition = conf.defaultTypeReferenceDefinition;
		if (definition === undefined) return fc.constant(undefined);
		if (is<TypeDefinition>(definition))
			return transformTypeDefinition(definition, transforms, ntArgs, path);
		return transformResourceDefinition(definition, transforms, ntArgs, path);
	};

export const cycleBreakerArbitrary: CycleBreakerTransform<Arbitrary> = (asyncArb) =>
	new (class extends fc.Arbitrary<unknown> {
		private arbitrary: Arbitrary | undefined;

		constructor() {
			super();
			asyncArb.then((val) => {
				this.arbitrary = val;
			});
		}

		generate(mrng: fc.Random, biasFactor: number | undefined): fc.Value<unknown> {
			if (!this.arbitrary) throw new Error('Cycle breaker arbitrary not initialized yet');
			return this.arbitrary.generate(mrng, biasFactor);
		}

		canShrinkWithoutContext(value: unknown): value is unknown {
			if (!this.arbitrary) throw new Error('Cycle breaker arbitrary not initialized yet');
			return this.arbitrary.canShrinkWithoutContext(value);
		}

		shrink(value: unknown, context: unknown): fc.Stream<fc.Value<unknown>> {
			if (!this.arbitrary) throw new Error('Cycle breaker arbitrary not initialized yet');
			return this.arbitrary.shrink(value, context);
		}
	})();

export const arrayTypeArbitrary: ArrayTypeTransform<Arbitrary> = async (itemsArbitrary) =>
	fc.array(itemsArbitrary);

export const mapTypeArbitrary: MapTypeTransform<Arbitrary> = async (propertiesArbitrary) =>
	fc.dictionary(fc.string(), propertiesArbitrary);

export const primitiveTypeArbitrary: PrimitiveTypeTransform<Arbitrary> = async (type, path) => {
	if (type === 'boolean') return fc.boolean();
	if (type === 'integer') return fc.integer();
	if (type === 'number') return fc.oneof(fc.integer(), fc.float(), fc.double());
	if (type === 'string') return fc.string();
	throw new Error(`${path} has unknown primitive type ${type}`);
};

export const unionTypeArbitrary: UnionTypeTransform<Arbitrary> = async (oneOfArbitraries) =>
	fc.oneof(...oneOfArbitraries);

export const propertyDefinitionArbitrary: PropertyDefinitionTransform<Arbitrary> = async (
	typeArbitrary,
	defaultArbitrary
) =>
	defaultArbitrary === undefined
		? typeArbitrary
		: fc.oneof(
				{ arbitrary: defaultArbitrary, weight: 1 },
				{ arbitrary: typeArbitrary, weight: 4 }
		  );

export const constArbitrary: ConstTransform<Arbitrary> = async (constant) => fc.constant(constant);

export const secretArbitrary: SecretTransform<Arbitrary> = async (property) => property.map(secret);

export const objectTypeDetailsArbitrary: ObjectTypeDetailsTransform<Arbitrary> = async (
	propertyArbitraries,
	required
) => fc.record(propertyArbitraries, { requiredKeys: [...required] });

export const resourceDefinitionArbitrary: ResourceDefinitionTransform<Arbitrary> = (
	inputPropertyArbitraries,
	requiredInputs,
	propertyArbitraries,
	required,
	path
) => objectTypeDetailsArbitrary(propertyArbitraries, required, path);

export const enumTypeDefinitionArbitrary: EnumTypeDefinitionTransform<Arbitrary> = async (values) =>
	fc.constantFrom(...values);

export class PulumiPackagesSchemaGenerator extends TraceGenerator {
	private static generatorIdCounter: number = 0;

	constructor(
		private readonly conf: ArbitraryConfig,
		private readonly registry: SchemaRegistry,
		private readonly arbitraryCache: ArbitraryCache,
		private readonly appendArbitraryCache: (
			type: NormalizedUri,
			arbitrary: Promise<Arbitrary>
		) => void,
		mrng: fc.Random,
		biasFactor: number | undefined
	) {
		const generatorId = `pulumi-packages-schema-generator-${PulumiPackagesSchemaGenerator.generatorIdCounter++}`;
		super(generatorId, mrng, biasFactor);
	}

	private async generateArbitrary(resourceType: Urn): Promise<Arbitrary> {
		let resDef = await this.registry.getResource(resourceType);
		if (resDef === undefined) {
			const errMsg = `Failed to find resource definition of ${resourceType}`;
			if (this.conf.failOnMissingResourceDefinition) throw new Error(errMsg);
			console.warn(`${errMsg}. Using default resource definition`);
			resDef = this.conf.defaultResourceDefinition;
		}
		const ntArgs: NamedTypeArgs<Arbitrary> = {
			caching: this.conf.cacheArbitraries,
			cache: this.arbitraryCache,
			appendCache: this.appendArbitraryCache,
			parentUris: [`#/resources/${resourceType}` as NormalizedResourceUri],
			registry: this.registry,
		};
		const mutTransforms: Partial<MutableTransforms<Arbitrary>> = {
			builtInType: builtInTypeArbitrary,
			cycleBreaker: cycleBreakerArbitrary,
			arrayType: arrayTypeArbitrary,
			mapType: mapTypeArbitrary,
			primitive: primitiveTypeArbitrary,
			unionType: unionTypeArbitrary,
			resourceDef: resourceDefinitionArbitrary,
			propDef: propertyDefinitionArbitrary,
			const: constArbitrary,
			secret: secretArbitrary,
			objType: objectTypeDetailsArbitrary,
			enumType: enumTypeDefinitionArbitrary,
		};
		const transforms = mutTransforms as Transforms<Arbitrary>;
		mutTransforms.unresolvableUri = unresolvableUriArbitrary(this.conf, transforms, ntArgs);
		return transformResourceDefinition(resDef, transforms, ntArgs, resourceType);
	}

	private async getArbitrary(resourceType: Urn): Promise<ResourceOutput['state']> {
		const cachedArbitrary = this.arbitraryCache.get(`#/resources/${resourceType}`);
		if (cachedArbitrary) return cachedArbitrary;
		const newArbitrary = this.generateArbitrary(resourceType).catch((cause) => {
			throw new Error(
				`Failed to generate resource arbitrary${
					cause?.message ? `: ${cause.message}` : ''
				}`,
				{ cause }
			);
		});
		if (this.conf.cacheArbitraries)
			this.appendArbitraryCache(`#/resources/${resourceType}`, newArbitrary);
		return newArbitrary;
	}

	async generateResourceOutput(resource: ResourceArgs): Promise<ResourceOutput> {
		const resourceArb = await this.getArbitrary(resource.type);
		const output: ResourceOutput = {
			id: resource.urn,
			state: resourceArb.generate(this.mrng, this.biasFactor).value,
		};
		this.appendTrace(output);
		return output;
	}

	public generateValue<T>(specId: string, arbitrary: fc.Arbitrary<T>): T {
		const { value } = arbitrary.generate(this.mrng, this.biasFactor);
		this.appendTrace({ id: specId, value });
		return value;
	}
}

export type PulumiPackagesSchemaArbitraryContext = {};

export class PulumiPackagesSchemaArbitrary extends fc.Arbitrary<PulumiPackagesSchemaGenerator> {
	private readonly registry: SchemaRegistry = SchemaRegistry.getInstance();

	/**
	 * Caching arbitraries under their normalized Pulumi type reference URI.
	 */
	private readonly arbitraryCache: ArbitraryCache;

	/**
	 * Add entry to arbitrary cache.
	 * @param type Normalized Pulumi type reference URI.
	 * @param arbitrary Promise resolving with the arbitrary to cache.
	 * @throws If cache already contains a arbitrary for the type.
	 */
	private readonly appendArbitraryCache: (
		type: NormalizedUri,
		arbitrary: Promise<Arbitrary>
	) => void;

	constructor(private readonly conf: ArbitraryConfig = config().arbitrary) {
		super();
		[this.arbitraryCache, this.appendArbitraryCache] = createAppendOnlyMap();
	}

	generate(
		mrng: fc.Random,
		biasFactor: number | undefined
	): fc.Value<PulumiPackagesSchemaGenerator> {
		const generator = new PulumiPackagesSchemaGenerator(
			this.conf,
			this.registry,
			this.arbitraryCache,
			this.appendArbitraryCache,
			mrng,
			biasFactor
		);
		const context: PulumiPackagesSchemaArbitraryContext = {};
		return new fc.Value(generator, context);
	}

	// eslint-disable-next-line class-methods-use-this
	canShrinkWithoutContext(value: unknown): value is PulumiPackagesSchemaGenerator {
		return is<PulumiPackagesSchemaGenerator>(value);
	}

	// eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars
	shrink(value: Generator, context: unknown): fc.Stream<fc.Value<PulumiPackagesSchemaGenerator>> {
		return fc.Stream.nil();
	}
}

export default PulumiPackagesSchemaArbitrary;
export const init: TestModuleInitFn = initModule;
