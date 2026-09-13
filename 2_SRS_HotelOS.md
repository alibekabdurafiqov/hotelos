# DASTURIY TALABLAR SPETSIFIKATSIYASI (SRS)
## Loyiha: HotelOS — Real Vaqtli Mehmonxona Boshqaruv Tizimi

**Hujjat versiyasi:** 1.0 | **Standart:** IEEE 830 uslubiga moslashtirilgan
**Muallif:** [Talaba ismi] | **Sana:** [sana kiriting]

---

## 1. Kirish

### 1.1 Maqsad
Ushbu hujjat HotelOS tizimining funktsional va funktsional bo'lmagan talablarini belgilaydi. U [[BRD]]da qayd etilgan biznes maqsadlarni aniq, tekshiriladigan texnik talablarga aylantiradi va 3-Vazifada (kod yozish) hamda baholovchi tomonidan tekshirish uchun asos bo'lib xizmat qiladi.

### 1.2 Ko'lam
HotelOS — GrandStay mehmonxonasi uchun 4 mikroservis (Qabul, Tozalash, Xona, Texnik Xizmat), markaziy xabar brokeri va WebSocket operatsiyalar panelidan iborat tizim. Soddalashtirilgan namoyish uchun 2 qavat / 10 xona ishlatiladi.

### 1.3 Ta'riflar va qisqartmalar
| Atama | Ta'rif |
|---|---|
| Servis | Mustaqil ravishda ishlaydigan, faqat o'z sohasini boshqaradigan komponent |
| Broker | Servislar orasida nashr/obuna (pub/sub) modeli orqali xabar yetkazuvchi markaziy vosita |
| Hodisa (event) | Brokerga nashr etilgan, holat o'zgarishini bildiruvchi xabar (masalan, "xona bo'shatildi") |
| Panel (Dashboard) | WebSocket orqali jonli yangilanadigan operatsiyalar interfeysi |
| TS | Test Stsenariysi (TS-01 dan TS-08 gacha) |

### 1.4 Havolalar
- Vazifa Topshirig'i: HotelOS Assignment Brief (4-Modul: Dasturlash)
- draw.io, Lucidchart — blok-sxema vositalari
- RabbitMQ / Redis Pub-Sub / WebSocket (MDN) hujjatlari

---

## 2. Umumiy tavsif

### 2.1 Mahsulot istiqboli
HotelOS mustaqil tizim bo'lib, oldingi qog'oz/telefon asosidagi jarayonlarni almashtiradi. U to'rtta ichki servis va bitta tashqi ko'rinadigan panel (brauzer yoki terminal)dan iborat.

### 2.2 Asosiy funksiyalar (yuqori darajada)
1. Mehmonni check-in/check-out qilish va xona avtomatik tayinlash.
2. Xona tozalash holatini kuzatish va yangilash.
3. Xona xizmati (room service) buyurtmalarini qabul qilish va holatini kuzatish.
4. Texnik xizmat so'rovlarini ustuvorlik bo'yicha navbatga qo'yish va tayinlash.
5. Barcha holatlarni real vaqtda operatsiyalar panelida ko'rsatish.

### 2.3 Foydalanuvchi xususiyatlari
| Foydalanuvchi turi | Tizim bilan aloqasi |
|---|---|
| Qabul xodimi | Check-in/check-out, xona inventarini ko'rish |
| Tozalash xodimi | Xona holatini "Tozalanmoqda" → "Toza" ga o'zgartirish |
| Xona xizmati xodimi | Buyurtma holatini yangilash |
| Texnik | O'ziga tayinlangan muammolarni ko'rish va yopish |
| Bosh menejer | Operatsiyalar panelini kuzatish (autentifikatsiya talab qilinadi) |

### 2.4 Umumiy cheklovlar
- Til-noaniq: istalgan dasturlash tili/freymvork, lekin asoslash 1-Vazifada berilishi shart.
- Servislar bir-birini to'g'ridan-to'g'ri chaqira olmaydi — faqat broker orqali.
- Tizim standart mashinada, litsenziyalanmagan dasturiy ta'minotsiz ishga tushishi kerak.

### 2.5 Taxminlar va bog'liqliklar
- Xabar brokeri sifatida RabbitMQ, Redis Pub/Sub yoki o'z-o'zi qurgan soddalashtirilgan broker ishlatilishi mumkin.
- WebSocket kutubxonasi tanlangan tilga mos ravishda tanlanadi (masalan, Node.js uchun `ws`, Python uchun `websockets`).

---

## 3. Funktsional talablar

### 3.1 FR-01 — Xona tayinlash algoritmi (Qabul Servisi)
Mehmon check-in qilganda tizim quyidagi tartibda (kamayish tartibida ustuvorlik bilan) xona tanlaydi:
1. **Xona turi mosligi** — qat'iy filtr (bir kishilik/ikki kishilik/lyuks/nogironlarga moslashtirilgan).
2. **Tozalik holati** — faqat "Toza" xonalar; "Iflos", "Tozalanmoqda", "Texnik xizmatda" chiqarib tashlanadi.
3. **Eng uzoq toza** — mos xonalar orasida eng uzoq vaqt "Toza" holatida turgan xona ustunlik oladi.
4. **Qavat afzalligi** (ixtiyoriy, ikkinchi darajali filtr) — agar shu qavatda mos xona bo'lmasa, boshqa mos qavatga o'tiladi.
5. **Yaqinlik afzalligi** (lift/zinapoya, ixtiyoriy, yakuniy hal qiluvchi omil).

*Chegaraviy holat:* hech qanday xona mos kelmasa → "xonalar mavjud emas" xabari + muqobil xona turi yoki kutish ro'yxati taklifi (TS-07).

### 3.2 FR-02 — Hisob-kitob algoritmi (Qabul Servisi, check-out)
Umumiy hisob = (tunlik narx × tunlar soni) + xonaga bog'liq xona xizmati to'lovlari + qo'shimcha to'lovlar (minibar, kech check-out).
*Chegaraviy holatlar:* erta check-out, nol to'lovlar, chegirma qo'llash — barchasi to'g'ri hisoblanishi kerak.

### 3.3 FR-03 — Texnik xizmat ustuvorlik navbati (Texnik Xizmat Servisi)
So'rovlar shoshilinchlik bo'yicha reytinglanadi: Kritik > Yuqori > Normal > Past. Bir xil shoshilinchlikda — avval topshirilgani ustunlik oladi (FIFO teng darajada). Keyingi mavjud texnikka avtomatik tayinlanadi.

### 3.4 FR-04 — Tozalash oqimi (Tozalash Servisi)
"Xona bo'shatildi" hodisasiga obuna bo'ladi → xonani tozalash navbatiga qo'shadi → holat "Iflos" → "Tozalanmoqda" → "Toza" tartibida o'zgaradi → har bir o'zgarish brokerga nashr etiladi.

### 3.5 FR-05 — Xona xizmati oqimi (Xona Servisi)
Buyurtma holatlari: Qabul qilindi → Tayyorlanmoqda → Yetkazilmoqda → Yetkazildi. Har bir o'zgarish brokerga nashr etiladi va to'lov xona hisobiga qo'shiladi.

### 3.6 FR-06 — Xabar brokeri
Barcha servislararo aloqa faqat nashr/obuna orqali. Hujjatlashtirilishi kerak bo'lgan minimal hodisalar jadvali:

| Hodisa nomi | Nashr etuvchi | Obunachi(lar) | Yuk (payload) |
|---|---|---|---|
| room.checked_out | Qabul | Tozalash | xona_raqami, vaqt |
| room.status_changed | Tozalash | Qabul, Panel | xona_raqami, yangi_holat |
| room_service.order_created | Xona | Panel | buyurtma_id, xona_raqami, mahsulotlar |
| room_service.status_changed | Xona | Panel | buyurtma_id, yangi_holat |
| maintenance.reported | Texnik Xizmat | Panel | muammo_id, xona_raqami, shoshilinchlik |
| maintenance.resolved | Texnik Xizmat | Panel, Qabul | muammo_id, xona_raqami |

### 3.7 FR-07 — Operatsiyalar paneli (WebSocket)
Panel quyidagilarni real vaqtda ko'rsatadi: barcha xonalarning joriy holati, faol xona xizmati buyurtmalari, ochiq texnik muammolar va ularning ustuvorligi, har bir band xonadagi joriy mehmon. Yangilanish qo'lda sahifani yangilashsiz WebSocket orqali yetadi.

### 3.8 FR-08 — Ma'lumotlar tuzilmalari
| Tuzilma | Ishlatilishi |
|---|---|
| Massiv/ro'yxat | Xona inventari |
| Ustuvorlik navbati (priority queue) | Texnik xizmat so'rovlari |
| Navbat (queue, FIFO) | Xona xizmati buyurtmalari |
| Lug'at/xarita (dictionary/map) | Mehmon yozuvlari (xona_raqami → mehmon ma'lumoti) |

---

## 4. Funktsional bo'lmagan talablar

### 4.1 NFR-01 — Xavfsizlik: Kiritishni tekshirish
Tashqaridan kelgan har bir ma'lumot (mehmon ismi, xona raqami, buyurtma tafsilotlari) qayta ishlanishidan oldin tekshirilishi kerak (masalan, xona raqami mavjud diapazonda, bo'sh maydonlar yo'q).

### 4.2 NFR-02 — Xavfsizlik: Autentifikatsiya
Operatsiyalar paneli maxfiy ma'lumotni ko'rsatishdan oldin parol yoki token talab qiladi.

### 4.3 NFR-03 — Xavfsizlik: Ma'lumotlarni oshkor qilmaslik
WebSocket orqali uzatiladigan xabarlar to'liq to'lov tafsilotlari yoki pasport raqamlarini o'z ichiga olmaydi — faqat operatsion jarayon uchun zarur maydonlar.

### 4.4 NFR-04 — Ishonchlilik: Xatolarni boshqarish
Tizim hech qachon xom stek izi bilan foydalanuvchiga ko'rinmasligi kerak. Barcha xatolar ushlanadi, ichki jihatdan qayd etiladi (log) va xavfsiz umumiy xabar sifatida qaytariladi.

### 4.5 NFR-05 — Ishlash (Performance)
Panel yangilanishlari hodisa yuz berganidan keyin foydalanuvchi tomonidan "real vaqtli" deb qabul qilinadigan tezlikda (soniyalar ichida) yetib borishi kerak.

### 4.6 NFR-06 — Ko'chirilishi mumkinlik / O'rnatish
Tizim yangi mashinada README'dagi bosqichlarga rioya qilib, litsenziyalanmagan yoki og'ir tijorat dasturisiz ishga tushirilishi mumkin bo'lishi kerak.

### 4.7 NFR-07 — Texnik xizmat ko'rsatilishi
Kod loyihada belgilangan kodlash standartiga (nomlash, izohlar, chekinish, funksiya uzunligi, xatolarni boshqarish, sehrli raqamlar) izchil rioya qilishi kerak (4-Vazifa bilan bog'liq).

---

## 5. Tashqi interfeys talablari

- **Foydalanuvchi interfeysi:** brauzer yoki terminal asosidagi panel, WebSocket ulanishi orqali.
- **Dasturiy interfeys:** servislar broker orqali nashr/obuna API'sidan foydalanadi (RabbitMQ AMQP yoki Redis Pub/Sub protokoli).
- **Aloqa protokoli:** WebSocket (server → brauzer bir tomonlama yoki ikki tomonlama push).

## 6. Talablarning kuzatuvchanlik jadvali (Traceability, qisqacha)

| Talab ID | Bog'liq O'quv Natijasi | Bog'liq test stsenariysi |
|---|---|---|
| FR-01 | LO1, LO3 | TS-01, TS-06, TS-07, TS-08 |
| FR-02 | LO1 | TS-02 |
| FR-03 | LO1 | TS-05 |
| FR-04 | LO2 | TS-02, TS-03 |
| FR-05 | LO2 | TS-04 |
| FR-06 | LO3 | TS-02, TS-03, TS-04, TS-05 |
| FR-07 | LO3 | TS-03, TS-04, TS-05 |
| NFR-01–04 | LO3 (3.2-bo'lim: Xavfsizlik) | TS-08 |
