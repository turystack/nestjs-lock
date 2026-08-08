import { type DynamicModule, Module } from '@nestjs/common'
import {
	CACHE_MODULE_OPTIONS,
	CacheModule,
	CacheService,
} from '@turystack/nestjs-cache'
import { ConfigService } from '@turystack/nestjs-config'

import { LockService } from '@/lock.service.js'
import type { LockModuleOptions } from '@/lock.types.js'

@Module({})
export class LockModule {
	/**
	 * Registers the lock globally. Without options it reuses the app-wide
	 * connection from `CacheModule.register()` (register the cache once in the
	 * app root); with options it registers its own CacheModule. Options accept
	 * a plain object or a `(config) => options` factory that receives the
	 * `ConfigService` from `@turystack/nestjs-config` at boot (requires
	 * `ConfigModule` to be registered).
	 */
	static register(
		options?:
			| LockModuleOptions
			| ((config: ConfigService) => LockModuleOptions),
	): DynamicModule {
		const imports = options
			? [
					LockModule._registerCacheModule(options),
				]
			: []

		return {
			exports: [
				LockService,
			],
			global: true,
			imports,
			module: LockModule,
			providers: [
				{
					inject: [
						{
							optional: true,
							token: CacheService,
						},
					],
					provide: LockService,
					useFactory: (cacheService?: CacheService) => {
						if (!cacheService) {
							throw new Error(
								'LockModule requires CacheModule to be imported or a provider config to be passed to LockModule.register()',
							)
						}
						return new LockService(cacheService)
					},
				},
			],
		}
	}

	private static _resolveOptions(
		optionsOrFactory:
			| LockModuleOptions
			| ((config: ConfigService) => LockModuleOptions),
		config?: ConfigService,
	): LockModuleOptions {
		if (typeof optionsOrFactory !== 'function') {
			return optionsOrFactory
		}

		if (!config) {
			throw new Error(
				'[LockModule] register((config) => ...) requires ConfigModule (@turystack/nestjs-config) to be registered',
			)
		}

		return optionsOrFactory(config)
	}

	/**
	 * Builds the standalone CacheModule import, swapping its options provider
	 * so the options are resolved once through {@link LockModule._resolveOptions}
	 * (and factory misuse reports LockModule, not CacheModule).
	 */
	private static _registerCacheModule(
		optionsOrFactory:
			| LockModuleOptions
			| ((config: ConfigService) => LockModuleOptions),
	): DynamicModule {
		const cacheModule = CacheModule.register(optionsOrFactory)

		return {
			...cacheModule,
			providers: [
				...(cacheModule.providers ?? []).filter(
					(provider) =>
						!(
							typeof provider === 'object' &&
							'provide' in provider &&
							provider.provide === CACHE_MODULE_OPTIONS
						),
				),
				{
					inject: [
						{
							optional: true,
							token: ConfigService,
						},
					],
					provide: CACHE_MODULE_OPTIONS,
					useFactory: (config?: ConfigService) =>
						LockModule._resolveOptions(optionsOrFactory, config),
				},
			],
		}
	}
}
