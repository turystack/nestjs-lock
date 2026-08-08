import { Inject } from '@nestjs/common'
import { type CacheKeyResolver, resolveCacheKey } from '@turystack/nestjs-cache'

import { LockService } from '@/lock.service.js'
import type { LockOptions } from '@/lock.types.js'

/**
 * Method decorator that acquires a distributed lock before execution
 * and releases it after (even on error).
 *
 * Auto-injects {@link LockService} into the class instance.
 *
 * Uses the same key-resolution engine as `@Cache.*`: pass a static string, or
 * a resolver that receives the method arguments as a tuple. The tuple generic
 * is optional — pass it when you want the arguments typed.
 *
 * @param key - Static key or resolver function receiving the method arguments.
 * @param options - Optional lock configuration (TTL, wait timeout, retry interval).
 *
 * @example
 * ```ts
 * import { Lock } from '@turystack/nestjs-lock'
 *
 * class OrdersService {
 *   @Lock(([orderId]) => `order:${orderId}`, { ttl: 15_000 })
 *   async process(orderId: string) {
 *     // automatically locked/unlocked
 *   }
 *
 *   // Optionally type the args tuple:
 *   @Lock<[string]>(([orderId]) => `order:${orderId}`)
 *   async cancel(orderId: string) {}
 * }
 * ```
 */
export function Lock<T extends unknown[] = unknown[]>(
	key: CacheKeyResolver<T>,
	options?: LockOptions,
): MethodDecorator {
	return (
		target: object,
		_propertyKey: string | symbol,
		descriptor: PropertyDescriptor,
	) => {
		Inject(LockService)(target, 'lockService')
		const original = descriptor.value

		descriptor.value = async function (
			this: Record<string, unknown>,
			...args: unknown[]
		) {
			const lockService = this.lockService as LockService
			const resolvedKey = await resolveCacheKey(key, args as T)
			const { unlock } = await lockService.lock(resolvedKey, options)
			try {
				return await original.apply(this, args)
			} finally {
				await unlock()
			}
		}

		return descriptor
	}
}
