/** ===== geo.ts ===== */
import type { LatLng } from './types.ts'

const EARTH_KM = 6371

const rad = (deg: number) => (deg * Math.PI) / 180

/**
 * 兩點之間的直線距離（公里）。
 * 用直線而不是實際路程，是因為要接路網 API 才算得出路程，
 * 而排序球場「誰比較近」用直線距離的結果幾乎一樣。
 */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** 近距離講到小數點一位才有意義，遠了就取整數。 */
export function km(v: number): string {
  if (v < 1) return Math.round(v * 1000) + ' 公尺'
  if (v < 10) return v.toFixed(1) + ' 公里'
  return Math.round(v) + ' 公里'
}
