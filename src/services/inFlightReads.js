const cancelled = () => Object.assign(new Error('This read is no longer current.'), { name: 'AbortError', code: 'ERR_CANCELED' })

/** Share pending reads only. Results and failures are never cached. */
export function createInFlightReads(readScope = () => '') {
  const pending = new Map()
  let revision = 0
  return {
    invalidate() {
      revision += 1
      for (const entry of pending.values()) entry.controller.abort()
      pending.clear()
    },
    get(key, request, signal) {
      if (signal?.aborted) return Promise.reject(cancelled())
      const scope = readScope(), startedRevision = revision
      const identity = JSON.stringify([scope, revision, key])
      let entry = pending.get(identity)
      if (!entry) {
        const controller = new AbortController()
        entry = { controller, subscribers: 0 }
        entry.promise = Promise.resolve().then(() => request(controller.signal)).then(value => {
          if (controller.signal.aborted || startedRevision !== revision || scope !== readScope()) throw cancelled()
          return value
        }).finally(() => { if (pending.get(identity) === entry) pending.delete(identity) })
        pending.set(identity, entry)
      }
      entry.subscribers += 1
      return new Promise((resolve, reject) => {
        let settled = false
        const finish = (handler, value) => {
          if (settled) return
          settled = true
          signal?.removeEventListener('abort', abort)
          entry.subscribers -= 1
          if (!entry.subscribers && pending.get(identity) === entry) {
            pending.delete(identity)
            entry.controller.abort()
          }
          handler(value)
        }
        const abort = () => finish(reject, cancelled())
        signal?.addEventListener('abort', abort, { once: true })
        entry.promise.then(value => finish(resolve, value), error => finish(reject, error))
      })
    },
  }
}
