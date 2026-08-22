/** ===== build_single_file.ts =====
 * 把 vite build 的產物壓成一個自足的 HTML 片段，用來發佈成 Artifact。
 * 用法：npm run build && node --experimental-strip-types tools/build_single_file.ts
 *
 * Artifact 的執行環境會自己包上 <!doctype html><head></head><body>，
 * 所以這裡只輸出 <title> + <style> + #root + <script>，不能有 html/head/body 標籤。
 * 而且它的 CSP 擋掉所有外部主機，所以 JS/CSS 一律內嵌，manifest 與 icon 直接拿掉。
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dist = new URL('../dist/', import.meta.url).pathname
const assets = join(dist, 'assets')

const files = readdirSync(assets)
const jsFile = files.find((f) => f.endsWith('.js'))
const cssFile = files.find((f) => f.endsWith('.css'))
if (!jsFile || !cssFile) throw new Error('dist/assets 裡找不到 js 或 css，先跑 npm run build')

const js = readFileSync(join(assets, jsFile), 'utf8')
const css = readFileSync(join(assets, cssFile), 'utf8')

// 內嵌的 script 裡如果出現字面上的 </script>，瀏覽器會提早結束標籤
const safeJs = js.replace(/<\/script>/gi, '<\\/script>')

const html = `<title>TennisPal 網球夥伴</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<style>
${css}

/* Artifact 是在桌面寬度的框裡看手機 App，給它一個手機外框比較好讀 */
body { display: flex; justify-content: center; }
.app { box-shadow: 0 0 0 1px var(--line); min-height: 100vh; }
</style>
<div id="root"></div>
<script type="module">
${safeJs}
</script>
`

const out = new URL('../dist/tennispal-prototype.html', import.meta.url).pathname
writeFileSync(out, html)
console.log('已產生 dist/tennispal-prototype.html（' + Math.round(html.length / 1024) + ' KB）')
