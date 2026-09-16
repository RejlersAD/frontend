import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { execFile } from 'node:child_process'
import { pbkdf2 } from 'node:crypto'
import dgram from 'node:dgram'
import dns from 'node:dns'
import { once } from 'node:events'
import http from 'node:http'
import https from 'node:https'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import test from 'node:test'
import { createServer } from 'vite'
import { createDockerLookup, createProxyAgent } from '../scripts/vite-proxy-agent.mjs'

const lookup = (resolver, options) => new Promise((resolve, reject) => {
  createDockerLookup(resolver)('backend_local', options, (error, address, family) => {
    if (error) reject(error)
    else resolve({ address, family })
  })
})

async function probeSaturatedPool() {
  // A tiny local DNS server makes this test independent of Docker, public DNS,
  // and network access. Return a loopback A record and no IPv6 records.
  const dnsServer = dgram.createSocket('udp4')
  dnsServer.on('message', (query, remote) => {
    let end = 12
    while (query[end]) end += query[end] + 1
    const type = query.readUInt16BE(end + 1)
    end += 5
    const header = Buffer.from(query.subarray(0, 12))
    header.writeUInt16BE(0x8180, 2)
    header.writeUInt16BE(type === 1 ? 1 : 0, 6)
    header.writeUInt16BE(0, 8)
    header.writeUInt16BE(0, 10)
    const answer = type === 1
      ? Buffer.from([0xc0, 0x0c, 0, 1, 0, 1, 0, 0, 0, 0, 0, 4, 127, 0, 0, 1])
      : Buffer.alloc(0)
    dnsServer.send(Buffer.concat([header, query.subarray(12, end), answer]), remote.port, remote.address)
  })
  dnsServer.bind(0, '127.0.0.1')
  await once(dnsServer, 'listening')
  const resolver = new dns.Resolver()
  resolver.setServers([`127.0.0.1:${dnsServer.address().port}`])
  const upstream = http.createServer((req, res) => res.end('purchase orders loaded'))
  upstream.listen(0, '127.0.0.1')
  await once(upstream, 'listening')
  const target = `http://backend_local:${upstream.address().port}`
  const agent = createProxyAgent(target, { isDocker: true, resolver })
  let proxyRequests = 0
  const vite = await createServer({
    configFile: false,
    logLevel: 'silent',
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: {
      middlewareMode: true,
      watch: null,
      proxy: {
        '/api': {
          target,
          agent,
          configure: proxy => proxy.on('proxyReq', () => { proxyRequests += 1 }),
        },
      },
    },
  })
  const frontend = http.createServer(vite.middlewares)
  frontend.listen(0, '127.0.0.1')
  await once(frontend, 'listening')
  let poolTaskComplete = false
  const poolTask = promisify(pbkdf2)('pool-test', 'salt', 2_000_000, 32, 'sha512')
    .then(() => { poolTaskComplete = true })
  let nativeLookupComplete = false
  const nativeLookup = dns.promises.lookup('localhost').then(() => { nativeLookupComplete = true })
  try {
    const start = performance.now()
    const body = await new Promise((resolve, reject) => {
      const request = http.get(`http://127.0.0.1:${frontend.address().port}/api/orders/`, response => {
        let result = ''
        response.on('data', chunk => { result += chunk })
        response.on('end', () => resolve(result))
      })
      request.setTimeout(5000, () => request.destroy(new Error('Proxy did not bypass the busy worker pool')))
      request.on('error', reject)
    })
    assert.equal(body, 'purchase orders loaded')
    assert.equal(proxyRequests, 1, 'Vite must forward the request through the custom agent')
    assert.equal(poolTaskComplete, false, 'The libuv pool must still be occupied')
    assert.equal(nativeLookupComplete, false, 'Native DNS must still be queued behind the occupied pool')
    console.log(`Vite proxy replied in ${Math.round(performance.now() - start)} ms while native DNS was blocked`)
  } finally {
    await Promise.all([poolTask, nativeLookup])
    agent.destroy()
    await vite.close()
    await Promise.all([new Promise(resolve => frontend.close(resolve)), new Promise(resolve => upstream.close(resolve))])
    dnsServer.close()
  }
}

if (process.argv.includes('--pool-probe')) {
  await probeSaturatedPool()
} else {
  test('Docker DNS supports IPv4, IPv6, and Node connection all-address callbacks', async () => {
    const resolver = {
      resolve4: (_, callback) => callback(null, ['172.19.0.5', '172.19.0.6']),
      resolve6: (_, callback) => callback(null, ['::1']),
    }
    assert.deepEqual(await lookup(resolver, 4), { address: '172.19.0.5', family: 4 })
    assert.deepEqual(await lookup(resolver, { family: 6 }), { address: '::1', family: 6 })
    assert.deepEqual(await lookup(resolver, { all: true }), {
      address: [{ address: '172.19.0.5', family: 4 }, { address: '172.19.0.6', family: 4 }, { address: '::1', family: 6 }],
      family: undefined,
    })
  })

  test('Docker DNS tolerates one missing family, re-resolves changed addresses, and reports lookup errors', async () => {
    let address = '172.19.0.5'
    const missing = Object.assign(new Error('DNS record not found'), { code: 'ENOTFOUND' })
    const resolver = {
      resolve4: (_, callback) => callback(null, [address]),
      resolve6: (_, callback) => callback(missing),
    }
    assert.equal((await lookup(resolver, {})).address, address)
    address = '172.19.0.9'
    assert.equal((await lookup(resolver, {})).address, address)
    await assert.rejects(lookup(resolver, { family: 6 }), { code: 'ENOTFOUND' })
    resolver.resolve4 = (_, callback) => callback(missing)
    await assert.rejects(lookup(resolver, {}), { code: 'ENOTFOUND' })
    resolver.resolve6 = (_, callback) => callback(null, ['::1'])
    assert.deepEqual(await lookup(resolver, {}), { address: '::1', family: 6 })
  })

  test('only the Compose backend inside Docker replaces native resolution; explicit keep-alive opt-out remains supported', () => {
    for (const target of ['http://localhost:8000', 'http://host.docker.internal:8000', 'https://example.com']) {
      assert.equal(createProxyAgent(target, { isDocker: true }), undefined)
    }
    assert.equal(createProxyAgent('http://backend_local:8000', { isDocker: false }), undefined)
    const dockerAgent = createProxyAgent('http://backend_local:8000', { isDocker: true })
    assert.ok(dockerAgent instanceof http.Agent)
    assert.equal(typeof dockerAgent.options.lookup, 'function')
    assert.equal(dockerAgent.keepAlive, false)
    dockerAgent.destroy()
    const explicit = createProxyAgent('https://example.com', { isDocker: false, disableKeepAlive: true })
    assert.ok(explicit instanceof https.Agent)
    assert.equal(explicit.options.lookup, undefined)
    assert.equal(explicit.keepAlive, false)
    explicit.destroy()
  })

  test('Vite forwards a Docker API request while the libuv pool and native DNS are blocked', { timeout: 30000 }, async () => {
    const { stdout } = await promisify(execFile)(process.execPath, [fileURLToPath(import.meta.url), '--pool-probe'], {
      env: { ...process.env, UV_THREADPOOL_SIZE: '1' },
      timeout: 25000,
    })
    assert.match(stdout, /Vite proxy replied in \d+ ms while native DNS was blocked/)
  })
}
