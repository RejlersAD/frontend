import { defineConfig } from '@playwright/test'
import registerConfig from './playwright.sales-proposal-register.config.js'

export default defineConfig({ ...registerConfig, testMatch: 'proposal-preparation.spec.js', outputDir: 'artifacts/proposal-preparation/results' })
