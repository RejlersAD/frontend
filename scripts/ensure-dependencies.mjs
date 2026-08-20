import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const lockfilePath = 'package-lock.json'
const markerPath = 'node_modules/.radai-package-lock.sha256'
const lockHash = createHash('sha256')
  .update(readFileSync(lockfilePath))
  .digest('hex')
const installedHash = existsSync(markerPath)
  ? readFileSync(markerPath, 'utf8').trim().split(/\s+/)[0]
  : ''

if (installedHash === lockHash) {
  process.exit(0)
}

console.log('Dependency lock changed; installing the committed dependency graph...')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const install = spawnSync(npmCommand, ['ci'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (install.status !== 0) {
  process.exit(install.status || 1)
}

mkdirSync('node_modules', { recursive: true })
writeFileSync(markerPath, `${lockHash}\n`)
