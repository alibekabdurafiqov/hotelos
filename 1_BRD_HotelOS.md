# BIZNES TALABLARI HUJJATI (BRD)
## Loyiha: HotelOS — Real Vaqtli Mehmonxona Boshqaruv Tizimi

**Hujjat versiyasi:** 1.0
**Modul:** 4-Modul — Dasturlash (H/618/7388, 4-daraja, 15 kredit)
**Muallif:** [Talaba ismi]
**Sana:** [sana kiriting]

---

## 1. Loyiha maqsadi

GrandStay Mehmonxonasi (6 qavat, 120 xona, 4 yulduzli) uchun barcha operatsion bo'limlarni — Qabul, Tozalash, Xona Xizmati va Texnik Xizmat — bitta real vaqtli platformaga bog'laydigan **HotelOS** tizimini loyihalash, qurish va hujjatlashtirish. Tizim mikroservislar arxitekturasi, markaziy xabar brokeri va WebSocket orqali jonli yangilanishlar asosida ishlaydi.

## 2. Biznes muammo (joriy holat)

Hozirda GrandStay'da bo'limlar bir-biridan ajralgan holda ishlaydi:

| Bo'lim | Joriy usul | Muammo |
|---|---|---|
| Qabul | Qog'oz jurnalga xona tayinlash | Xato va kechikishlar |
| Tozalash | Doska-jadval | Qabul bilan real vaqtda sinxron emas |
| Xona xizmati | Telefon orqali buyurtma, oshxonaga qichqirib yetkazish | Band telefon → buyurtma yo'qoladi |
| Texnik xizmat | Mehmon → Qabul → texnikka qo'ng'iroq | Xabar soatlab yetib bormaydi |

**Natija:** Mehmon tozalanmagan xonaga joylashtiriladi, buyurtmalar yo'qoladi, texnik muammolar kechikadi, check-out jarayoni qo'lda hisob-kitob tufayli sekinlashadi.

## 3. Manfaatdor tomonlar (Stakeholders)

- **Bosh menejer** — loyihani buyurtma qiluvchi, yakuniy qaror qabul qiluvchi.
- **Qabul xodimlari** — check-in/check-out, xona tayinlash.
- **Tozalash nazoratchisi va xodimlari** — xona holatini yangilash.
- **Xona xizmati (room service) xodimlari va oshxona** — buyurtmalarni qabul qilish va yetkazish.
- **Texnik xizmat brigadasi** — muammolarni hal qilish.
- **Mehmonlar** — bilvosita manfaatdor, xizmat sifatidan foydalanuvchi.
- **Dasturchi (siz)** — tizimni loyihalovchi, quruvchi va hujjatlashtiruvchi.

## 4. Biznes maqsadlari va kutilayotgan foydalar

1. Barcha bo'limlarni bitta markazlashgan platformaga bog'lash orqali ma'lumot yo'qolishini yo'qotish.
2. Xona tayinlashni avtomatlashtirish orqali mehmonni tozalanmagan xonaga joylashtirish xavfini bartaraf etish.
3. Xona xizmati va texnik xizmat so'rovlarini real vaqtda kuzatish imkonini berish.
4. Check-out jarayonini tezlashtirish — barcha xarajatlar avtomatik hisoblanadi.
5. Operatsiyalar panelida barcha bo'limlar bo'yicha jonli umumiy manzara berish.

## 5. Loyiha ko'lami (Scope)

**Ko'lamga kiradi:**
- To'rtta mustaqil mikroservis: Qabul, Tozalash, Xona, Texnik Xizmat.
- Markaziy xabar brokeri (nashr/obuna modeli).
- WebSocket asosidagi operatsiyalar paneli (brauzer yoki terminal).
- Xona tayinlash algoritmi, hisob-kitob algoritmi, texnik xizmat ustuvorlik navbati algoritmi.
- Kamida 2 qavat, 10 xonalik soddalashtirilgan namoyish muhiti (120 xona shart emas).
- Asosiy xavfsizlik choralari: kiritishni tekshirish, autentifikatsiya, ma'lumotlarni oshkor qilmaslik, xatolarni boshqarish.

**Ko'lamdan tashqarida:**
- To'liq tijorat darajasidagi, sayqallangan foydalanuvchi interfeysi.
- To'lov tizimlari bilan haqiqiy integratsiya.
- Mobil ilova.
- 120 ta xonaning to'liq amalga oshirilishi (soddalashtirilgan versiya yetarli).

## 6. Muvaffaqiyat mezonlari

- Tizim 8 ta test stsenariysining (TS-01–TS-08) barchasini to'g'ri bajaradi.
- Barcha to'rtta servis bir-birini to'g'ridan-to'g'ri chaqirmasdan, faqat broker orqali muloqot qiladi.
- Panel WebSocket orqali sahifani yangilamasdan real vaqtda yangilanadi.
- Kod bitta buyruq bilan (yoki README'dagi aniq bosqichlar bilan) yangi mashinada ishga tushadi.
- Hisobot va kod baholash mezonlariga (P1–P6, M1–M4, D1–D4) mos keladi.

## 7. Cheklovlar va taxminlar

- **Cheklov:** Til-noaniq (language-agnostic) topshiriq — istalgan til/freymvork ishlatilishi mumkin, lekin tanlov 1-Vazifada asoslanishi kerak.
- **Cheklov:** So'z soni yozma tahlil bo'limlariga tegishli (kod, diagramma, jadval, skrinshut hisobga kirmaydi).
- **Taxmin:** Baholovchi kodni yangi mashinada ishga tushirishi kerak — shuning uchun README hal qiluvchi ahamiyatga ega.
- **Taxmin:** Barcha ish talabaning o'zi tomonidan yozilgan va tushunilgan bo'lishi kerak (akademik halollik talabi).

## 8. Yuqori darajadagi risklar

| Risk | Ta'siri | Yumshatish |
|---|---|---|
| Broker/servislar orasidagi murakkab sozlash | Baholovchi kodni ishga tushira olmaydi | Aniq README, minimal tashqi bog'liqlik |
| Vaqt yetishmasligi (4 ta teng og'irlikdagi vazifa) | Bitta zaif vazifa umumiy bahoga ta'sir qiladi | Har bir vazifaga teng vaqt ajratish |
| Race condition (bir vaqtda xona holatini yangilash) | Ma'lumot nomuvofiqligi | 4-Vazifada махсус disk raskadrovka misoli sifatida hujjatlashtirish |
