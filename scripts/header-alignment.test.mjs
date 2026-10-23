import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8')

assert.match(css, /\.header-inner \{ width: 100%; height: 68px; padding: 0 22px;/, 'desktop header must span the viewport with symmetric edge padding')
assert.doesNotMatch(css, /\.header-inner \{[^}]*max-width:/, 'header content must not remain constrained to a centered maximum width')
assert.match(css, /@media \(max-width: 1100px\) \{[\s\S]*?\.header-inner \{ padding: 0 20px; \}/, 'narrow screens must keep safe edge spacing')

console.log('header alignment tests passed')
