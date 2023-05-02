/**
 * Mutable collection of promises, signaling in the promise returned by `isCompleted` whether all
 * promises in the collection settled. Promises are added through `wait`. Throws if a promise is
 * added or resolved after the waiter completed. Can be reset with `reset`.
 */
// eslint-disable-next-line import/prefer-default-export
export class MutableWaiter {
	private completed?: Promise<Error[]>;

	private complete?: () => void;

	private waiting: number = 0;

	private errors: Error[] = [];

	private checkCompleted(): void {
		if (!this.complete && this.completed)
			throw new Error('Waiter checked for completion after completing');
		if (this.complete && this.waiting === 0) this.complete();
	}

	/**
	 * Adds a promise to be waited for.
	 * @param promise Promise to wait for.
	 */
	public wait(promise: Promise<any>): void {
		this.waiting += 1;
		if (!this.complete && this.completed)
			throw new Error('Adding promise to waiter after completing. Did you forget to reset?');
		promise
			.catch((e) => this.errors.push(e))
			// Delay decreasing waiting counter in the event loop
			// to ensure callbacks that create a new promise are executed before
			.finally(() => new Promise(process.nextTick))
			.then(() => {
				this.waiting -= 1;
				this.checkCompleted();
			});
	}

	/**
	 * @returns Promise that resolves with the list of occurred errors once all promises resolved.
	 */
	public isCompleted(): Promise<Error[]> {
		if (!this.completed) {
			this.completed = new Promise((resolve) => {
				this.complete = () => {
					delete this.complete;
					resolve(this.errors);
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
		this.errors = [];
	}
}
