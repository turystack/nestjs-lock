import { ConflictException } from '@nestjs/common'

/** Thrown when a distributed lock cannot be acquired within the wait timeout. */
export class LockError extends ConflictException {
	constructor(key: string) {
		super(`Failed to acquire lock for key "${key}"`)
		this.name = 'LockError'
	}
}
