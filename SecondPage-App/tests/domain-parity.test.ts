import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
test('native accounting and quote execution rules match the web exactly', () => {
  for (const path of ['market.ts', 'trading/quote-rules.ts']) {
    assert.equal(readFileSync(new URL(`../src/lib/${path}`, import.meta.url), 'utf8'), readFileSync(new URL(`../../SecondPage-Web/src/lib/${path}`, import.meta.url), 'utf8'))
  }
})
