import { Inject, Injectable } from '@nestjs/common'
import { CacheService } from '@turystack/nestjs-cache'

import { LockError } from '@/lock.errors.js'
import type { LockOptions } from '@/lock.types.js'

const DEFAULT_TTL = 10_000
const DEFAULT_WAIT_TIMEOUT = 5_000
const DEFAULT_RETRY_INTERVAL = 100

/**
 * Service for acquiring and releasing distributed locks via the cache
 * adapter (Redis is the built-in option).
 *
 * @example
 * ```ts
 * import { LockService } from '@turystack/nestjs-lock'
 *
 * @Injectable()
 * class OrdersService {
 *   constructor(private readonly lock: LockService) {}
 *
 *   async process(orderId: string) {
 *     const { unlock } = await this.lock.lock(`order:${orderId}`)
 *     try {
 *       // critical section
 *     } finally {
 *       await unlock()
 *     }
 *   }
 * }
 * ```
 */
@Injectable()
export class LockService {
	constructor(
		@Inject(CacheService)
		private readonly cacheService: CacheService,
	) {}

	/**
	 * Acquires a distributed lock for the given key.
	 *
	 * Retries until the lock is acquired or the wait timeout is exceeded.
	 * Returns an `unlock` callback that **must** be called to release the lock.
	 *
	 * @throws {LockError} If the lock cannot be acquired within the wait timeout.
	 */
	async lock(
		key: string,
		options?: LockOptions,
	): Promise<{
		unlock: () => Promise<void>
	}> {
		const ttl = options?.ttl ?? DEFAULT_TTL
		const waitTimeout = options?.waitTimeout ?? DEFAULT_WAIT_TIMEOUT
		const retryInterval = options?.retryInterval ?? DEFAULT_RETRY_INTERVAL

		const lockKey = `lock:${key}`
		const lockValue = `${Date.now()}:${Math.random()}`
		const deadline = Date.now() + waitTimeout

		while (Date.now() < deadline) {
			const acquired = await this.cacheService.set(lockKey, lockValue, {
				mode: 'NX',
				ttl,
			})

			if (acquired) {
				return {
					unlock: async () => {
						await this.cacheService.del([
							lockKey,
						])
					},
				}
			}

			await this.sleep(retryInterval)
		}

		throw new LockError(key)
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}
}
