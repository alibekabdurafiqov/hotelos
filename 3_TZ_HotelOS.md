# TEXNIK TOPSHIRIQ (TZ)
## Loyiha: HotelOS — Real Vaqtli Mehmonxona Boshqaruv Tizimi

**Hujjat versiyasi:** 1.0
**Muallif:** [Talaba ismi] | **Sana:** [sana kiriting]

> Ushbu hujjat [[BRD]] va [[SRS]]da belgilangan talablarni bevosita amalga oshirish (implementatsiya) darajasiga tushiradi — 3-Vazifa (kod yozish) uchun amaliy qo'llanma sifatida ishlaydi.

---

## 1. Arxitektura umumiy ko'rinishi

```
                    ┌─────────────────────┐
                    │   XABAR BROKERI      │
                    │ (RabbitMQ/Redis/     │
                    │  o'z broker)         │
                    └──────────┬───────────┘
        ┌──────────┬───────────┼───────────┬──────────┐
        │           │           │           │          │
  ┌─────▼────┐ ┌────▼─────┐┌────▼─────┐┌────▼──────┐   │
  │  Qabul   │ │ Tozalash ││   Xona   ││  Texnik   │   │
  │ Servisi  │ │ Servisi  ││ Servisi  ││  Xizmat   │   │
  └──────────┘ └──────────┘└──────────┘└───────────┘   │
                                                          │
                    ┌─────────────────────┐              │
                    │  Operatsiyalar       │◄─────────────┘
                    │  Paneli (WebSocket)  │
                    └─────────────────────┘
```

**Asosiy qoida:** servislar bir-birini to'g'ridan-to'g'ri chaqirmaydi (HTTP so'rov, funksiya chaqiruvi va h.k. yo'q) — faqat brokerga nashr etish / brokerdan obuna bo'lish orqali.

## 2. Texnologiya steki (to'ldirish uchun shablon)

| Komponent | Tanlov | Asoslash (qisqacha) |
|---|---|---|
| Dasturlash tili | [tanlang] | [nima uchun] |
| Backend freymvork | [tanlang] | [nima uchun] |
| Xabar brokeri | [RabbitMQ / Redis Pub-Sub / o'z broker] | [nima uchun] |
| WebSocket kutubxonasi | [tanlang] | [nima uchun] |
| Ma'lumotlar saqlash | [in-memory / SQLite / boshqa] | [nima uchun] |
| IDE | [tanlang] | [nima uchun] |

*Eslatma: bu jadvalni 1-Vazifadagi "Texnologiya Stekini Asoslash" (1.4-bo'lim) bilan bir xil qiling.*

## 3. Servislar spetsifikatsiyasi

### 3.1 Qabul Servisi
**Mas'uliyat:** check-in, check-out, xona inventar so'rovlari.
**Ishga tushiradi:** Xona tayinlash algoritmi (check-in), Hisob-kitob algoritmi (check-out).
**Nashr etadi:** `room.checked_out`
**Obuna bo'ladi:** `maintenance.resolved` (agar xona holatini yangilash kerak bo'lsa)

### 3.2 Tozalash Servisi
**Mas'uliyat:** tozalash navbatini boshqarish, xona holatini yangilash.
**Obuna bo'ladi:** `room.checked_out`
**Nashr etadi:** `room.status_changed` (har bir holat o'zgarishida: Iflos → Tozalanmoqda → Toza)

### 3.3 Xona Servisi (Room Service)
**Mas'uliyat:** ovqat/ichimlik buyurtmalarini qabul qilish va holatini kuzatish.
**Nashr etadi:** `room_service.order_created`, `room_service.status_changed`
**Holatlar ketma-ketligi:** Qabul qilindi → Tayyorlanmoqda → Yetkazilmoqda → Yetkazildi

### 3.4 Texnik Xizmat Servisi
**Mas'uliyat:** muammo hisobotlarini qabul qilish, ustuvorlik navbati orqali texnikka tayinlash.
**Nashr etadi:** `maintenance.reported`, `maintenance.resolved`
**Ma'lumotlar tuzilmasi:** ustuvorlik navbati (Kritik > Yuqori > Normal > Past; teng darajada — FIFO)

### 3.5 Operatsiyalar Paneli
**Mas'uliyat:** barcha hodisalarga obuna bo'lib, WebSocket orqali brauzerga/terminalga jonli uzatish.
**Ko'rsatishi shart:** xonalar holati (kamida 10 ta), faol xona xizmati buyurtmalari, ochiq texnik muammolar + ustuvorlik, har bir band xonadagi mehmon.
**Xavfsizlik:** autentifikatsiyadan keyingina ma'lumot ko'rsatiladi; maxfiy maydonlar (to'lov, pasport) filtrlanadi.

## 4. Algoritmlar (qisqa psevdokod)

### 4.1 Xona tayinlash
```
FUNKSIYA tayinlaXona(bron_turi, qavat_afzalligi, yaqinlik_afzalligi):
    mos_xonalar = FILTR(barcha_xonalar, xona.turi == bron_turi VA xona.holati == "Toza")
    AGAR mos_xonalar bo'sh:
        QAYTAR xato("xonalar mavjud emas")
    mos_xonalar = SARALASH(mos_xonalar, eng_uzoq_toza_vaqt bo'yicha o'sish tartibida)
    AGAR qavat_afzalligi berilgan:
        filtr_natija = FILTR(mos_xonalar, xona.qavat == qavat_afzalligi)
        AGAR filtr_natija bo'sh EMAS:
            mos_xonalar = filtr_natija
    AGAR yaqinlik_afzalligi berilgan VA bir nechta nomzod qolgan:
        mos_xonalar = SARALASH(mos_xonalar, yaqinlik bo'yicha)
    QAYTAR mos_xonalar[0]
```

### 4.2 Hisob-kitob
```
FUNKSIYA hisoblaHisob(xona, tunlar_soni, xizmat_tolovlari[], qoshimcha_tolovlar[]):
    asosiy = xona.tunlik_narx * tunlar_soni
    xizmat_jami = YIGINDI(xizmat_tolovlari)
    qoshimcha_jami = YIGINDI(qoshimcha_tolovlar)
    jami = asosiy + xizmat_jami + qoshimcha_jami
    AGAR chegirma mavjud: jami = jami - chegirma
    QAYTAR jami
```

### 4.3 Texnik xizmat ustuvorlik navbati
```
FUNKSIYA qoshMuammo(muammo, shoshilinchlik, vaqt):
    navbat.QOSH(muammo, prioritet_kaliti=(shoshilinchlik, vaqt))
    # Kritik=0, Yuqori=1, Normal=2, Past=3 — kichik son = yuqori ustuvorlik
    # Teng shoshilinchlikda vaqt (FIFO) hal qiluvchi

FUNKSIYA tayinlaKeyingiTexnik():
    muammo = navbat.OLDIN_CHIQAR()  # eng past prioritet_kaliti
    texnik = TOP_BOSH_TEXNIK(mavjud_texniklar)
    QAYTAR tayinla(muammo, texnik)
```

## 5. Xavfsizlik amalga oshirish talablari

| Talab | Amalga oshirish joyi |
|---|---|
| Kiritishni tekshirish | Har bir servisning API/hodisa qabul qiluvchi qatlamida (validatsiya funksiyalari) |
| Autentifikatsiya | Panelga ulanishda (token/parol tekshiruvi WebSocket handshake vaqtida) |
| Ma'lumotni oshkor qilmaslik | Hodisa payload'ini shakllantiruvchi serializatsiya qatlamida (maxfiy maydonlar chiqarib tashlanadi) |
| Xatolarni boshqarish | Har bir servisda global try/catch + markazlashgan log + foydalanuvchiga umumiy xabar |

## 6. Test stsenariylari (qabul qilish mezonlari)

| ID | Stsenariy | Kutilgan natija |
|---|---|---|
| TS-01 | Mehmon 3-qavatda 2 kishilik xona so'raydi | Eng uzoq toza mos xona tayinlanadi; qavat topilmasa — istalgan mos qavat |
| TS-02 | Mehmon 204-xonadan check-out qiladi | Hisob hisoblanadi; xona "Iflos"ga o'tadi; `room.checked_out` nashr etiladi |
| TS-03 | Tozalovchi 204-xonani toza belgilaydi | Iflos→Tozalanmoqda→Toza; panel WebSocket orqali yangilanadi |
| TS-04 | 301-xona 2 qahva + sandvich buyurtma qiladi | Buyurtma holatlari ketma-ket o'zgaradi; to'lov hisobga qo'shiladi |
| TS-05 | 115-xona, singan dush, Kritik | Navbat boshiga kiradi; keyingi texnikka tayinlanadi |
| TS-06 | Ikki mehmon bir vaqtda bir xil turdagi xona so'raydi | Ikkalasiga har xil xona; ikki marta bron qilish yo'q |
| TS-07 | So'ralgan turdagi barcha xonalar band | Aniq "mavjud emas" xabari + muqobil taklif; ishdan chiqish yo'q |
| TS-08 | Check-in'da noto'g'ri xona raqami | Tekshiruv xatosi bilan rad etiladi; tizim barqaror qoladi |

## 7. Topshirish paketi talablari

- **Kod:** `Familya_Ism_TalabaID_HotelOS_Kod.zip` — README.md (o'rnatish + ishga tushirish buyruqlari), kamida 10 ta mazmunli git majburiyati (`git log --oneline` eksporti bilan).
- **Hisobot:** `Familya_Ism_TalabaID_HotelOS_Hisobot.docx` — A4, Times New Roman 12pt, 1.5 qator oralig'i, chegaralar (Chap 3sm, O'ng 1.5sm, Yuqori/Pastki 2sm), tekis hizalash, 1.25sm birinchi qator chekinishi, Harvard formatida kamida 8 manba.
