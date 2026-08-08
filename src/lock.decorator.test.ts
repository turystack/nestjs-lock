import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Lock } from '@/lock.decorator.js'
import type { LockService } from '@/lock.service.js'

const unlock = vi.fn()
const mockLockService = {
	lock: vi.fn(),
} as unknown as LockService

class TestService {
	public lockService = mockLockService

	@Lock<
		[
			string,
		]
	>(([orderId]) => `order:${orderId}`, {
		ttl: 5_000,
	})
	async process(orderId: string) {
		return `processed:${orderId}`
	}

	@Lock<
		[
			string,
		]
	>(([orderId]) => `order:${orderId}`)
	async fail(_orderId: string) {
		throw new Error('boom')
	}

	@Lock('static:lock')
	async processStatic() {
		return 'processed'
	}

	@Lock(([orderId]) => `untyped:${orderId}`)
	async processUntyped(orderId: string) {
		return `processed:${orderId}`
	}
}

describe('@Lock', () => {
	let service: TestService

	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(mockLockService.lock).mockResolvedValue({
			unlock,
		})

		service = new TestService()
		service.lockService = mockLockService
	})

	it('should acquire the lock with the derived key and options', async () => {
		await service.process('123')

		expect(mockLockService.lock).toHaveBeenCalledWith('order:123', {
			ttl: 5_000,
		})
	})

	it('should return the original method result and release the lock', async () => {
		await expect(service.process('123')).resolves.toBe('processed:123')
		expect(unlock).toHaveBeenCalledTimes(1)
	})

	it('should release the lock even when the method throws', async () => {
		await expect(service.fail('123')).rejects.toThrow('boom')
		expect(unlock).toHaveBeenCalledTimes(1)
	})

	it('should accept a static string key', async () => {
		await expect(service.processStatic()).resolves.toBe('processed')
		expect(mockLockService.lock).toHaveBeenCalledWith('static:lock', undefined)
	})

	it('should work without an explicit tuple generic', async () => {
		await expect(service.processUntyped('9')).resolves.toBe('processed:9')
		expect(mockLockService.lock).toHaveBeenCalledWith('untyped:9', undefined)
	})

	it('should propagate lock acquisition failures without running the method', async () => {
		vi.mocked(mockLockService.lock).mockRejectedValue(new Error('timeout'))

		await expect(service.process('123')).rejects.toThrow('timeout')
		expect(unlock).not.toHaveBeenCalled()
	})
})
