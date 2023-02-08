/**
 * Mutable collection of promises, signaling in the promise returned by `isCompleted` whether all
 * promises in the collection resolved. Promises are added through `wait`. Throws if a promise is
 * added or resolved after the waiter completed. Can be reset with `reset`.
 */
// eslint-disable-next-line import/prefer-default-export
export class MutableWaiter {
	private completed?: Promise<void>;

	private complete?: () => void;

	private waiting: Set<Promise<any>> = new Set();

	private checkCompleted(): void {
		if (!this.complete && this.completed)
			throw new Error('Waiter checked for completion after completing');
		if (this.complete && this.waiting.size === 0) this.complete();
	}

	/**
	 * Adds a promise to be waited for.
	 * @param promise Promise to wait for.
	 */
	public wait(promise: Promise<any>): void {
		if (!this.complete && this.completed)
			throw new Error('Adding promise to waiter after completing. Did you forget to reset?');
		this.waiting.add(promise);
		promise.then(() => {
			this.waiting.delete(promise);
			this.checkCompleted();
		});
	}

	/**
	 * @returns Promise that resoves once all promises added through `wait` resolved.
	 */
	public isCompleted(): Promise<void> {
		if (!this.completed) {
			this.completed = new Promise((resolve) => {
				this.complete = () => {
					delete this.complete;
					resolve();
				};
			});
			this.checkCompleted();
		}
		return this.completed;
	}

	/**
	 * Reset waiter by replacing current `isCompleted` with a new unresolved promise that resolves
	 * once all after the reset added promises resolved.
	 */
	public reset(): void {
		delete this.completed;
		delete this.complete;
	}
}
