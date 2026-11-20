# PawSync – Mobile (Capacitor)

เว็บแอป React + Vite ที่ห่อด้วย Capacitor เป็นแอป Android / iOS

## ติดตั้งครั้งแรก
- Node.js 22, pnpm (`npm i -g pnpm`)
- Android: Android Studio (มี JDK 21 มาให้ในตัว) + Android SDK
- iOS: ต้องใช้ Mac + Xcode เท่านั้น

```bash
pnpm install
```

## คำสั่ง
| คำสั่ง | ทำอะไร |
|---|---|
| `pnpm dev` | รันเป็นเว็บ http://localhost:8443 |
| `pnpm android` | build + sync + เปิด Android Studio |
| `pnpm android:run` | build + รันบนมือถือ/emulator ที่ต่อไว้ |
| `pnpm ios` | build + sync + เปิด Xcode (Mac เท่านั้น) |
| `pnpm cap:sync` | build แล้ว sync เข้าทั้งสอง platform |

ทุกครั้งที่แก้โค้ดใน `src/` ต้องรัน `pnpm android` / `pnpm ios` (หรือ `pnpm cap:sync`) ใหม่ เพื่อ copy เว็บล่าสุดเข้าแอป

## ตั้งค่าแอป
แก้ใน `capacitor.config.ts` : `appId` (ตอนนี้ `com.pawsync.app` เปลี่ยนก่อนขึ้น Store), `appName`

## ก่อนขึ้น Store
- ไอคอน/Splash: ใช้ `@capacitor/assets` สร้างจากรูป 1024x1024
- Android: สร้าง keystore แล้ว Build > Generate Signed Bundle
- iOS: ต้องมี Apple Developer Account

## เปลี่ยนไอคอน / Splash
แก้รูปในโฟลเดอร์ `resources/` (icon-only.png, icon-foreground.png, icon-background.png, splash.png, splash-dark.png) แล้วรัน
```bash
npx @capacitor/assets generate --ios --android --iconBackgroundColor '#ffffff' --splashBackgroundColor '#e8f2ff' --splashBackgroundColorDark '#0f172a'
```
(ถ้า pnpm ฟ้อง sharp ให้ใช้ `npm i -D @capacitor/assets` หรือ `pnpm approve-builds` แล้วเลือก sharp)
