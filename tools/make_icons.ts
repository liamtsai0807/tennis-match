/** ===== make_icons.ts =====
 * 產生 PWA 安裝用的 PNG 圖示。
 * 用法：node --experimental-strip-types tools/make_icons.ts
 *
 * 為什麼不是直接用 SVG：Android Chrome 的「安裝應用程式」看的是 manifest 裡
 * 192 與 512 的點陣圖示，只給 SVG 有些機型不會出現安裝提示。
 *
 * 為什麼自己畫而不是拉繪圖套件：只為了兩張圖示多一個相依不划算，
 * 而且 zlib 是 Node 標準庫，PNG 自己編碼並不難。
 */
import { writeFileSync } from 'node:fs'
import { encodePng } from './png.ts'

// ---------- 畫圖示 ----------

type RGB = [number, number, number]

const BLUE_LIGHT: RGB = [0x4d, 0xab, 0xff]
const BLUE_DEEP: RGB = [0x00, 0x55, 0xd4]
const BALL: RGB = [0xe8, 0xff, 0x5a]
const WHITE: RGB = [0xff, 0xff, 0xff]

const mix = (a: RGB, b: RGB, t: number): RGB =>
  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/**
 * 回傳某個取樣點的顏色，或 null 表示透明。
 * 座標用 0..1 的比例，跟實際尺寸脫鉤，放大縮小都一致。
 */
function sample(u: number, v: number, maskable: boolean): RGB | null {
  // maskable 圖示會被系統裁成圓形／圓角，安全區只有中央 80%，所以內容要縮小
  const pad = maskable ? 0.14 : 0
  const cornerR = maskable ? 0 : 0.22

  if (!maskable) {
    // 圓角矩形：只有四個角要判斷
    const dx = Math.max(cornerR - u, u - (1 - cornerR), 0)
    const dy = Math.max(cornerR - v, v - (1 - cornerR), 0)
    if (dx * dx + dy * dy > cornerR * cornerR) return null
  }

  const bg = mix(BLUE_LIGHT, BLUE_DEEP, Math.min(1, (u + v) / 2))

  // 球
  const cx = 0.5
  const cy = 0.5
  const r = (0.5 - pad) * 0.62
  const dx = u - cx
  const dy = v - cy
  const d = Math.hypot(dx, dy)
  if (d > r) return bg

  // 縫線：兩段通過球正上、正下方的圓弧，赤道處落在 ±0.62r。
  // 試過 0.85（太貼邊，整顆變成一個圈）也試過更內側（中間夾成葉子形），
  // 0.62 是兩側月牙與中間黃色都看得出來的位置。
  // 由 (0,±r) 與赤道交點 (±bulge·r, 0) 反推圓心與半徑：
  const bulge = 0.62
  const off = r * (1 - bulge * bulge) / (2 * bulge)
  const seamR = off + bulge * r
  const stroke = r * 0.09
  for (const s of [1, -1]) {
    const sd = Math.hypot(dx - s * off, dy)
    if (Math.abs(sd - seamR) < stroke / 2) return WHITE
  }
  return BALL
}

/** 每個像素取 4x4 個樣本再平均，邊緣才不會鋸齒。 */
function render(size: number, maskable: boolean): Uint8Array {
  const SS = 4
  const out = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = sample((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size, maskable)
          if (c) { r += c[0]; g += c[1]; b += c[2]; a += 255 }
        }
      }
      const n = SS * SS
      const i = (y * size + x) * 4
      // 顏色要用「有顏色的樣本數」平均，否則透明區會把邊緣洗成黑色
      const opaque = a / 255 || 1
      out[i] = Math.round(r / opaque)
      out[i + 1] = Math.round(g / opaque)
      out[i + 2] = Math.round(b / opaque)
      out[i + 3] = Math.round(a / n)
    }
  }
  return out
}

const targets: Array<{ file: string; size: number; maskable: boolean }> = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
]

for (const t of targets) {
  const png = encodePng(t.size, t.size, render(t.size, t.maskable))
  writeFileSync(new URL('../public/' + t.file, import.meta.url), png)
  console.log('  ' + t.file + '  ' + t.size + '×' + t.size + '  ' + Math.round(png.length / 1024) + ' KB')
}
console.log('圖示產生完成')
