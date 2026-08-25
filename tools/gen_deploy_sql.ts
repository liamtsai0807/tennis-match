/** ===== gen_deploy_sql.ts =====
 * 產生 supabase/deploy_cloud.sql：一份可以直接貼進雲端專案 SQL Editor 的完整安裝檔。
 *
 *   node --experimental-strip-types tools/gen_deploy_sql.ts
 *
 * 為什麼不直接用 supabase db push：那需要先 supabase login 拿 access token
 * 再 link 專案。貼一份 SQL 進 Dashboard 是零安裝的路，第一次上線用這個最快。
 * 之後要持續改 schema 再走 CLI。
 *
 * **跟 seed.sql 最大的差別：不帶那 14 個示範球友。**
 * 本機開發需要假球友，媒合畫面才有東西可看；但雲端是真人在用的，把假人放進去
 * 等於讓使用者被媒合給不存在的對象、送出永遠不會有人回的邀約。
 * 球場與場地是參考資料（政府開放資料），那個要帶。
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'

const root = new URL('../supabase/', import.meta.url)

const migrationDir = new URL('migrations/', root)
const files = readdirSync(migrationDir).filter((f) => f.endsWith('.sql')).sort()

const parts: string[] = [
  `-- ===== deploy_cloud.sql =====
-- 由 tools/gen_deploy_sql.ts 產生，不要手改。
--
-- 用法：Supabase Dashboard → SQL Editor → New query → 整份貼上 → Run。
-- 可以重複執行（migration 都是 if not exists / on conflict do nothing）。
--
-- 內容：${files.length} 份 migration + 球場與場地的參考資料。
-- **不含示範球友**——雲端是真人在用的，放假人進去會讓使用者被媒合給
-- 不存在的對象。本機開發要的假球友在 supabase/seed.sql，那一份 db reset 會自動跑。
`,
]

for (const f of files) {
  parts.push(`\n-- ─────────────────────────────────────────────\n-- migrations/${f}\n-- ─────────────────────────────────────────────\n`)
  parts.push(readFileSync(new URL('migrations/' + f, root), 'utf8').trimEnd() + '\n')
}

// seed.sql 只取球場與場地那兩段，players 整段丟掉
const seed = readFileSync(new URL('seed.sql', root), 'utf8')
const kept: string[] = []
let skipped = 0
for (const stmt of seed.split(/;\s*\n/)) {
  // 檔頭的註解會跟第一段 insert 黏在同一塊（註解裡沒有分號可以切），
  // 所以要逐行剝掉開頭的註解，不能看到 -- 開頭就把整塊丟掉——
  // 那樣會連 clubs 一起丟掉，而且產物看起來還很正常
  const body = stmt.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n').trim()
  if (!body) continue
  if (/^insert into players\b/i.test(body)) { skipped++; continue }
  kept.push(body + ';')
}

parts.push(`\n-- ─────────────────────────────────────────────
-- 參考資料：球場與場地
-- 來源：全國運動場館資訊（iPlay），運動部
--       https://data.gov.tw/dataset/22849
--       政府資料開放授權條款第 1 版
-- ─────────────────────────────────────────────\n`)
parts.push(kept.join('\n\n') + '\n')

writeFileSync(new URL('deploy_cloud.sql', root), parts.join(''))

console.log(`已產生 supabase/deploy_cloud.sql`)
console.log(`  migration：${files.length} 份`)
console.log(`  參考資料：${kept.length} 段 insert`)
console.log(`  刻意排除：${skipped} 段示範球友`)
