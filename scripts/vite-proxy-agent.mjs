import dns from 'node:dns'
import { existsSync } from 'node:fs'
import http from 'node:http'
import https from 'node:https'

// Docker's service name is provided by DNS, so it does not need the OS
// getaddrinfo resolver. resolve4/resolve6 use network I/O rather than the
// libuv worker pool shared by Vite's file polling and source transforms.
export function createDockerLookup(resolver = dns) {
  return (hostname, options, callback) => {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }
    if (typeof options === 'number') options = { family: options }
    options ||= {}
    const families = options.family === 4 ? [4] : options.family === 6 ? [6] : [4, 6]

    Promise.all(families.map(family => new Promise(resolve => {
      resolver[family === 4 ? 'resolve4' : 'resolve6'](hostname, (error, addresses) => {
        resolve({ error, addresses: (addresses || []).map(address => ({ address, family })) })
      })
    }))).then(results => {
      const addresses = results.flatMap(result => result.addresses)
      if (!addresses.length) {
        const error = results.find(result => result.error)?.error
          || Object.assign(new Error(`No DNS addresses for ${hostname}`), { code: 'ENOTFOUND' })
        callback(error)
      } else if (options.all) {
        callback(null, addresses)
      } else {
        callback(null, addresses[0].address, addresses[0].family)
      }
    })
  }
}

export function createProxyAgent(target, {
  disableKeepAlive = false,
  isDocker = existsSync('/.dockerenv'),
  resolver = dns,
} = {}) {
  const url = new URL(target)
  // Preserve native host-file/DNS behavior for localhost, remote backends,
  // and host development. Only the Compose service uses Docker DNS directly.
  const useDockerLookup = isDocker && url.hostname === 'backend_local'
  if (!useDockerLookup && !disableKeepAlive) return undefined
  const Agent = url.protocol === 'https:' ? https.Agent : http.Agent
  return new Agent({
    keepAlive: false,
    ...(useDockerLookup ? { lookup: createDockerLookup(resolver) } : {}),
  })
}
