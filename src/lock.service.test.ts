import { Test } from '@nestjs/testing'
import { CacheService } from '@turystack/nestjs-cache'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LockError } from '@/lock.errors.js'
import { LockService } from '@/lock.service.js'

describe('LockService', () => {
	let service: LockService
	let cacheService: CacheService

	beforeEach(async () => {
		const moduleRef = await Test.createTestingModule({
			providers: [
				LockService,
				{
					provide: CacheService,
					useValue: {
						del: vi.fn(),
						set: vi.fn(),
					},
				},
			],
		}).compile()

		service = moduleRef.get<LockService>(LockService)
		cacheService = moduleRef.get<CacheService>(CacheService)
	})

	describe('lock', () => {
		it('should acquire lock on first attempt', async () => {
			vi.mocked(cacheService.set).mockResolvedValue(true)
			vi.mocked(cacheService.del).mockResolvedValue(1)

			const { unlock } = await service.lock('my-resource')

			expect(cacheService.set).toHaveBeenCalledWith(
				'lock:my-resource',
				expect.any(String),
				{
					mode: 'NX',
					ttl: 10_000,
				},
			)

			await unlock()
			expect(cacheService.del).toHaveBeenCalledWith([
				'lock:my-resource',
			])
		})

		it('should use custom ttl', async () => {
			vi.mocked(cacheService.set).mockResolvedValue(true)

			await service.lock('my-resource', {
				ttl: 30_000,
			})

			expect(cacheService.set).toHaveBeenCalledWith(
				'lock:my-resource',
				expect.any(String),
				{
					mode: 'NX',
					ttl: 30_000,
				},
			)
		})

		it('should retry and acquire lock on subsequent attempt', async () => {
			vi.mocked(cacheService.set)
				.mockResolvedValueOnce(false)
				.mockResolvedValueOnce(true)

			const { unlock } = await service.lock('my-resource', {
				retryInterval: 10,
			})

			expect(cacheService.set).toHaveBeenCalledTimes(2)
			await unlock()
		})

		it('should throw LockError when wait timeout is exceeded', async () => {
			vi.mocked(cacheService.set).mockResolvedValue(false)

			await expect(
				service.lock('my-resource', {
					retryInterval: 10,
					waitTimeout: 50,
				}),
			).rejects.toThrow(LockError)
		})

		it('should throw LockError with descriptive message', async () => {
			vi.mocked(cacheService.set).mockResolvedValue(false)

			await expect(
				service.lock('order:123', {
					retryInterval: 10,
					waitTimeout: 50,
				}),
			).rejects.toThrow('Failed to acquire lock for key "order:123"')
		})
	})
})
