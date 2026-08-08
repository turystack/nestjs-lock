import type { DynamicModule, FactoryProvider } from '@nestjs/common'
import {
	CACHE_MODULE_OPTIONS,
	CacheModule,
	type CacheService,
} from '@turystack/nestjs-cache'
import { describe, expect, it, vi } from 'vitest'

import { LockModule } from '@/lock.module.js'
import { LockService } from '@/lock.service.js'

const getLockServiceProvider = (
	options?: Parameters<typeof LockModule.register>[0],
) => {
	const dynamicModule = LockModule.register(options)
	return {
		dynamicModule,
		provider: dynamicModule.providers?.find(
			(provider) =>
				typeof provider === 'object' &&
				'provide' in provider &&
				provider.provide === LockService,
		) as FactoryProvider,
	}
}

const getCacheOptionsProvider = (
	options: Parameters<typeof LockModule.register>[0],
) => {
	const { dynamicModule } = getLockServiceProvider(options)
	const cacheModule = dynamicModule.imports?.[0] as DynamicModule

	return cacheModule.providers?.find(
		(provider) =>
			typeof provider === 'object' &&
			'provide' in provider &&
			provider.provide === CACHE_MODULE_OPTIONS,
	) as FactoryProvider
}

describe('LockModule', () => {
	describe('register', () => {
		it('should reuse the existing CacheModule when no options are given', () => {
			const { dynamicModule } = getLockServiceProvider()

			expect(dynamicModule.module).toBe(LockModule)
			expect(dynamicModule.global).toBe(true)
			expect(dynamicModule.imports).toEqual([])
			expect(dynamicModule.exports).toEqual([
				LockService,
			])
		})

		it('should register its own CacheModule when options are given', () => {
			const { dynamicModule } = getLockServiceProvider({
				adapter: 'redis',
				redis: {
					url: 'redis://localhost:6379',
				},
			})

			expect(dynamicModule.imports).toHaveLength(1)
			expect(dynamicModule.imports?.[0]).toMatchObject({
				module: CacheModule,
			})
		})

		it('should build LockService from the injected CacheService', () => {
			const { provider } = getLockServiceProvider()
			const cacheService = {} as CacheService

			expect(provider.useFactory(cacheService)).toBeInstanceOf(LockService)
		})

		it('should throw when no CacheService is available', () => {
			const { provider } = getLockServiceProvider()

			expect(() => provider.useFactory(undefined)).toThrow(
				'LockModule requires CacheModule',
			)
		})

		it('should resolve options from a config factory', () => {
			const optionsProvider = getCacheOptionsProvider((config) => ({
				adapter: 'redis',
				redis: {
					url: config.get('REDIS_URL') as string,
				},
			}))

			const config = {
				get: vi.fn().mockReturnValue('redis://config:6379'),
			}

			expect(optionsProvider.useFactory(config)).toEqual({
				adapter: 'redis',
				redis: {
					url: 'redis://config:6379',
				},
			})
			expect(config.get).toHaveBeenCalledWith('REDIS_URL')
		})

		it('should reject a config factory without ConfigModule', () => {
			const optionsProvider = getCacheOptionsProvider((config) => ({
				adapter: 'redis',
				redis: {
					url: config.get('REDIS_URL') as string,
				},
			}))

			expect(() => optionsProvider.useFactory(undefined)).toThrow(
				'[LockModule] register((config) => ...) requires ConfigModule (@turystack/nestjs-config) to be registered',
			)
		})
	})
})
