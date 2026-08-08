import { Injectable, Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import {
	CACHE_ADAPTER_REDIS,
	CacheModule,
	CacheService,
} from '@turystack/nestjs-cache'
import { describe, expect, it } from 'vitest'

import { LockModule } from '@/lock.module.js'
import { LockService } from '@/lock.service.js'

@Injectable()
class DomainService {
	constructor(
		public readonly cacheService: CacheService,
		public readonly lockService: LockService,
	) {}
}

@Module({
	providers: [
		DomainService,
	],
})
class DomainLibModule {}

describe('LockModule (integration)', () => {
	it('should share the app-wide CacheService and inject into domain libs', async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [
				CacheModule.register({
					adapter: 'redis',
					redis: {
						url: 'redis://test:6379',
					},
				}),
				LockModule.register(),
				DomainLibModule,
			],
		})
			.overrideProvider(CACHE_ADAPTER_REDIS)
			.useValue({})
			.compile()

		const domainService = moduleRef.get(DomainService)
		expect(domainService.cacheService).toBeInstanceOf(CacheService)
		expect(domainService.lockService).toBeInstanceOf(LockService)

		// One connection app-wide: the lib and the lock share the exact same
		// CacheService singleton (and therefore the same adapter connection).
		const sharedCacheService = moduleRef.get(CacheService)
		expect(domainService.cacheService).toBe(sharedCacheService)
		expect(
			(domainService.lockService as unknown as Record<string, unknown>)
				.cacheService,
		).toBe(sharedCacheService)
	})
})
