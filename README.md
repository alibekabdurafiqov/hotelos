# HotelOS — Real Vaqtli Mehmonxona Boshqaruv Tizimi

GrandStay Mehmonxonasi uchun mikroservislar arxitekturasida qurilgan demo tizim:
Qabul, Tozalash, Xona Xizmati va Texnik Xizmat servislari markaziy xabar
brokeri orqali bog'langan, natijalar WebSocket asosidagi operatsiyalar
panelida real vaqtda ko'rinadi.

Hujjatlar: [1_BRD_HotelOS.md](./1_BRD_HotelOS.md) (biznes talablar),
[2_SRS_HotelOS.md](./2_SRS_HotelOS.md) (dasturiy talablar),
[3_TZ_HotelOS.md](./3_TZ_HotelOS.md) (texnik topshiriq).

---

## 1. Texnologiya steki va asoslash

| Komponent | Tanlov | Nima uchun |
|---|---|---|
| Til | **Node.js (JavaScript), v18+** | Yagona til bilan ham server (servislar, broker), ham brauzer tomoni (panel) yoziladi; event-loop modeli WebSocket va pub/sub uchun tabiiy mos keladi. |
| Xabar brokeri | **O'z-o'zi qurgan WebSocket-asosli pub/sub broker** (`broker/broker.js`) | RabbitMQ/Redis o'rnatishni talab qilib, "yangi mashinada bitta buyruqda ishga tushishi" talabini (NFR-06) qiyinlashtirardi. O'z brokerimiz nol tashqi bog'liqlik bilan xuddi shu pub/sub semantikasini beradi va WebSocket protokolining o'zi ustida qurilgan - shu bilan birga FR-06/FR-07 ni bitta mexanizm orqali qondiradi. |
| WebSocket | **Node xom `http`+`crypto` moduli ustida qo'lda yozilgan server** (`shared/ws-server.js`) va **Node 18+ ning ichki global `WebSocket` mijozi** (servis va brauzer tomonida) | `ws` npm paketisiz ishlash uchun; loyiha butunlay **nol npm bog'liqligi** bilan ishlaydi (`package.json` da `dependencies: {}`). |
| Ma'lumotlar saqlash | **In-memory (JS Array/Map)** | Demo ko'lami (10 xona) uchun yetarli, o'rnatishni soddalashtiradi (NFR-06). Har bir servis qayta ishga tushganda holat tozalanadi - bu demo/o'quv loyihasi uchun qabul qilingan tanlov. |
| IDE | Har qanday (VS Code tavsiya etiladi) | Til-noaniq talabga mos. |

---

## 2. Ishga tushirish

Talab: **Node.js 18 yoki undan yuqori** (native `WebSocket` global uchun; 21+ da eng barqaror). Boshqa hech narsa o'rnatish shart emas.

```bash
cd HotelOS
npm start
```

Bitta buyruq (`npm start` → `node start.js`) broker va barcha 4 ta servisni alohida
processlar sifatida ishga tushiradi. Konsolda har bir servisning portda
ishga tushgani va brokerga ulanganini ko'rasiz.

Keyin brauzerda oching:

```
http://localhost:7000
```

Panel token so'raydi - standart demo tokeni **`hotelos-admin`** (matn
maydonida oldindan to'ldirilgan). O'zgartirish uchun brokerni
`HOTELOS_ADMIN_TOKEN=boshqa_token npm start` bilan ishga tushiring.

To'xtatish: `Ctrl+C` (barcha bola-processlarni ham to'xtatadi).

### Portlar
| Servis | Port |
|---|---|
| Broker (HTTP + WebSocket + Panel) | 7000 |
| Qabul (Reception) | 7001 |
| Tozalash (Housekeeping) | 7002 |
| Xona Xizmati (Room Service) | 7003 |
| Texnik Xizmat (Maintenance) | 7004 |

Har bir servis alohida ham ishga tushirilishi mumkin: `npm run reception` va h.k.

---

## 3. Arxitektura

```
        Reception(7001)  Housekeeping(7002)  RoomService(7003)  Maintenance(7004)
              |                 |                   |                  |
              └────────── faqat WebSocket pub/sub ───────────┘
                                   |
                          Broker (7000, WS + HTTP)
                                   |
                     Dashboard (brauzer, WS mijoz)
```

**Qat'iy qoida:** hech bir servis boshqasining portiga HTTP so'rov
yubormaydi va boshqasining kodini import qilmaydi. Yagona aloqa yo'li -
brokerga `publish` va undan `subscribe`. Har bir servis o'zining kichik
HTTP API'siga ega (check-in, buyurtma yaratish kabi tashqi amallar uchun) -
bu API faqat o'sha servisning o'z domenidagi amallarni bajaradi, boshqa
servisga signal berish uchun EMAS.

### Hodisalar jadvali (SRS 3.6, FR-06)

| Hodisa | Nashr etuvchi | Obunachi(lar) | Yuk (payload) |
|---|---|---|---|
| `room.checked_out` | Qabul | Tozalash | `roomNumber`, `time` |
| `room.status_changed` | Tozalash | **Qabul**, Panel | `roomNumber`, `newStatus` |
| `room_service.order_created` | Xona Xizmati | Panel | `orderId`, `roomNumber`, `items` |
| `room_service.status_changed` | Xona Xizmati | Panel, **Qabul** | `orderId`, `roomNumber`, `newStatus`, (`charge` - faqat "yetkazildi"da) |
| `maintenance.reported` | Texnik Xizmat | Panel, **Qabul** | `issueId`, `roomNumber`, `urgency`, `assignedTo` |
| `maintenance.resolved` | Texnik Xizmat | Panel, Qabul | `issueId`, `roomNumber` |

**Talqin eslatmalari (SRS'dan qasddan, hujjatlashtirilgan chetlanish):**
SRS 3.6-jadvalida `room_service.status_changed` va `maintenance.reported`
uchun Qabul obunachi sifatida ko'rsatilmagan edi. Amalda esa Qabul
Servisining hisob-kitob algoritmi (FR-02) xona xizmati to'lovlarini bilishi
SHART, va xona holatini "Texnik xizmatda" deb belgilashi kerak (FR-01,
"Texnik xizmatda" xonalar chiqarib tashlanadi). Shu sababli **Qabul
qo'shimcha ravishda shu ikki hodisaga ham obuna bo'ladi** - bu arxitektura
qoidasini (faqat broker orqali) buzmaydi, faqat jadvaldagi kichik
noaniqlikni ishlaydigan tizim uchun to'ldiradi. Bu qaror `services/reception.js`
faylining boshida ham izohlangan.

### Ma'lumotlar tuzilmalari (SRS 3.8, FR-08)
- **Array** — xona inventari (`data/rooms.js`)
- **Map** — mehmon yozuvlari, xona_raqami → mehmon (`services/reception.js`)
- **FIFO Queue** (o'zi yozilgan `Queue` klassi) — tozalash navbati va xona xizmati buyurtmalari (`shared/data-structures.js`)
- **Priority Queue** (binary min-heap, o'zi yozilgan) — texnik xizmat so'rovlari, ustuvorlik: Kritik(0) > Yuqori(1) > Normal(2) > Past(3), teng darajada FIFO

---

## 4. Xavfsizlik (NFR-01 — NFR-04)

- **Kiritishni tekshirish:** `shared/validate.js` — har bir HTTP endpoint
  tashqi ma'lumotni (mehmon ismi, xona raqami, summalar, enum qiymatlar)
  qabul qilishdan oldin tekshiradi; noto'g'ri bo'lsa `400` va aniq xabar.
- **Autentifikatsiya:** Panel WebSocket ulanishi `?token=` parametrisiz yoki
  noto'g'ri token bilan rad etiladi (`broker/broker.js`). Servislar broker
  bilan ichki (trusted) tarmoqda ishlaydi, token talab qilinmaydi.
- **Ma'lumotni oshkor qilmaslik:** Broker orqali yuboriladigan yuklarda hech
  qachon to'lov karta ma'lumoti yoki pasport raqami yo'q — masalan
  `room_service.order_created` faqat mahsulot nomi/sonini uzatadi, narxni
  emas; xona ro'yxati endpointi (`GET /rooms`) mehmon ismini qaytarmaydi.
- **Xatolarni boshqarish:** Har bir servisning HTTP qatlami (`shared/http-json.js`)
  kutilmagan xatoliklarni ushlaydi, serverda to'liq stackni logga yozadi,
  lekin foydalanuvchiga faqat umumiy xavfsiz xabar ("Ichki server xatosi...")
  qaytaradi — hech qachon xom stack trace chiqmaydi.

---

## 5. Test stsenariylari - qanday tekshirish kerak

Demo muhitida 2 qavat / 10 xona bor (TZ dagi 115/204/301 kabi raqamlar
o'rniga 101-105, 201-205 ishlatiladi). Har bir stsenariy uchun `curl`
misoli:

**TS-01 — Xona tayinlash + qavat afzalligi**
```bash
curl -X POST localhost:7001/checkin -H 'Content-Type: application/json' \
  -d '{"guestName":"Aziza","roomType":"ikki_kishilik","nights":2,"floorPreference":2}'
```
Agar 2-qavatda mos "toza" xona bo'lmasa, algoritm avtomatik boshqa mos
qavatga o'tadi (kodda sinovdan o'tgan).

**TS-02 — Check-out va hisob-kitob**
```bash
curl -X POST localhost:7001/checkout/103
```
Javobda `bill.jamiSumma` = (tunlik narx × tun) + xona xizmati + qo'shimcha − chegirma.

**TS-03 — Tozalash oqimi + panel yangilanishi**
```bash
curl -X POST localhost:7002/advance/103   # iflos -> tozalanmoqda
curl -X POST localhost:7002/advance/103   # tozalanmoqda -> toza
```
Dashboard'ni ochib turgan holda buni bajarsangiz, jadval WebSocket orqali
sahifani yangilamasdan o'zgaradi.

**TS-04 — Xona xizmati buyurtmasi**
```bash
curl -X POST localhost:7003/orders -H 'Content-Type: application/json' \
  -d '{"roomNumber":"103","items":[{"name":"Qahva","price":3,"qty":2},{"name":"Sendvich","price":6,"qty":1}]}'
curl -X POST localhost:7003/orders/1/advance   # 3 marta -> yetkazildi
```
Keyingi check-out'da bu summa (12) hisobga avtomatik qo'shiladi.

**TS-05 — Texnik xizmat ustuvorlik navbati**
```bash
curl -X POST localhost:7004/issues -H 'Content-Type: application/json' \
  -d '{"roomNumber":"105","description":"Singan dush","urgency":"kritik"}'
curl localhost:7004/issues     # kritik har doim ro'yxat boshida
```

**TS-06 — Parallel check-in (ikkilamchi bron yo'q)**
```bash
curl -X POST localhost:7001/checkin -d '{"guestName":"A","roomType":"bir_kishilik","nights":1}' -H 'Content-Type: application/json' &
curl -X POST localhost:7001/checkin -d '{"guestName":"B","roomType":"bir_kishilik","nights":1}' -H 'Content-Type: application/json' &
wait
```
`reception.js` dagi `Mutex` xona tayinlashni serializatsiya qiladi -
ikkalasiga har xil xona tegishi kafolatlangan (pastdagi debugging
bo'limiga qarang).

**TS-07 — Barcha mos xonalar band**
Barcha `lyuks` xonalarni band qilib, yana bir marta so'rang - `409` va
`alternative` maydonida muqobil xona turi taklifi qaytadi.

**TS-08 — Noto'g'ri kirish**
```bash
curl -X POST localhost:7001/checkin -d '{"guestName":"","roomType":"noto\u0027g\u0027ri"}' -H 'Content-Type: application/json'
```
Tizim `400` va aniq validatsiya xabari bilan javob beradi, ishdan chiqmaydi.

---

## 6. Disk raskadrovka (debugging) misoli — 4-Vazifa uchun

Loyihani sinovdan o'tkazishda quyidagi ikki muammo topildi va tuzatildi -
haqiqiy debugging jarayoni sifatida hujjatlashtirilmoqda:

**1. Race condition (BRD 8-bo'lim riski):** ikkita mehmon bir vaqtda bir xil
turdagi yagona bo'sh xonani so'rasa, `assignRoom()` funksiyasi ikkalasiga
ham bir xil xonani tanlashi mumkin edi, chunki xona tanlash va uni "band"
deb belgilash orasida boshqa so'rov kirib kelishi mumkin (`async` funksiya
ichida). Yechim: `shared/mutex.js` da oddiy async mutex yozildi;
`services/reception.js`dagi `/checkin` endpoint butun
tanlash+belgilash blokini `roomAssignmentLock.lock()` bilan o'raydi, shu
bilan ikkinchi so'rov birinchisi tugagunga qadar kutadi. `TS-06` bilan
tasdiqlandi (parallel so'rovlar - har doim har xil xona).

**2. Payload maydon nomining mos kelmasligi:** dastlabki testda check-out
paytida xona xizmati to'lovi hisobga qo'shilmayotgani aniqlandi. Sabab:
`roomservice.js` `room_service.status_changed` hodisasini `newStatus`
maydoni bilan nashr etardi, lekin `reception.js`dagi obunachi uni `status`
nomi bilan kutayotgan edi - shunchaki tinch qolib, hech qanday xatolik
chiqarmasdi (chunki JS da mavjud bo'lmagan maydon shunchaki `undefined`
bo'ladi). Bu broker orqali erkin (loosely-typed) JSON almashinuvining
tipik xatosi - kelajakda buning oldini olish uchun har bir hodisaning
maydon nomlari ushbu README dagi 3-bo'limdagi jadvalga qat'iy mos
kelishi kerak. Console loglar (`[reception] INFO 103 xonasiga xona
xizmati to'lovi qo'shildi`) yordamida aniqlandi va maydon nomini
to'g'rilash bilan tuzatildi.

---

## 7. Ma'lum cheklovlar (demo ko'lami)

- Ma'lumotlar xotirada saqlanadi - server qayta ishga tushirilsa barcha
  holat (band xonalar, buyurtmalar) tozalanadi.
- 10 xonalik soddalashtirilgan inventar (BRD 5-bo'lim ruxsat beradi).
- Xona xizmati buyurtmasi berishda xona hozir band-emasligi tekshirilmaydi
  (servislar orasida faqat hodisalar orqali aloqa qoidasiga qat'iy rioya
  qilingani uchun - room-service o'z holicha reception'ning bandlik
  holatini so'ramaydi).
- To'lov tizimlari, mobil ilova - ko'lamdan tashqarida (BRD 5-bo'lim).
