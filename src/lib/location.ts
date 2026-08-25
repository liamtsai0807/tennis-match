/** ===== location.ts =====
 * 取得使用者目前的位置。
 *
 * 為什麼需要：球場列表原本是用登錄時選的「行政區中心」算距離。人在內湖，
 * App 還在說大安的場最近——對「找附近有空的球場」這件事來說，那個距離是錯的。
 *
 * 兩個刻意的選擇：
 *
 * 1. **不在進畫面時就要權限。** 一開 App 就跳系統對話框是最快讓人按「不允許」
 *    的方式，而一旦按了，之後要再問就得叫使用者自己去改系統設定。改成使用者
 *    主動按「用目前位置」才問。
 * 2. **只留在記憶體。** 座標不寫進資料庫也不寫 localStorage。球友資料裡存的
 *    一直只有行政區，不是精確位置——這是登入畫面對使用者的承諾。
 */
import type { LatLng } from './types.ts'

export type LocationError =
  | 'unsupported'   // 瀏覽器沒有這個 API
  | 'denied'        // 使用者拒絕
  | 'unavailable'   // 定位不到（室內、關掉定位服務）
  | 'timeout'

export function locationErrorMessage(e: LocationError): string {
  switch (e) {
    case 'unsupported': return '這個瀏覽器不支援定位'
    case 'denied': return '你拒絕了定位權限，改用設定的行政區排序'
    case 'unavailable': return '定位不到，可能在室內或關掉了定位服務'
    case 'timeout': return '定位太久沒有回應，改用設定的行政區排序'
  }
}

/**
 * 問一次目前位置。
 *
 * enableHighAccuracy 刻意關掉：找球場只要知道在哪一區，
 * 開了會多耗電、在室內還更慢，精度對這個用途沒有意義。
 */
export function getMyLocation(timeoutMs = 8000): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject('unsupported' as LocationError)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject('denied' as LocationError)
        else if (err.code === err.TIMEOUT) reject('timeout' as LocationError)
        else reject('unavailable' as LocationError)
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 },
    )
  })
}
