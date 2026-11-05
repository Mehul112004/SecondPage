import { copyFileSync } from 'node:fs'
const paths = ['market.ts', 'trading/quote-rules.ts']
for (const path of paths) {
  copyFileSync(new URL(`../../SecondPage-Web/src/lib/${path}`, import.meta.url), new URL(`../src/lib/${path}`, import.meta.url))
}
console.log('Synced trading logic from SecondPage-Web.')
