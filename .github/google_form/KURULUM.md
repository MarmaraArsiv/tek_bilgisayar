# 🛠 Google Formları ve Telegram Onay Botu

README'lerdeki ⭐ yıldızlar ve 💬 öğrenci görüşleri Google Formlarından gelir. **Bütün bölüm arşivlerinin formları tek
bir Apps Script projesinden, onayları tek bir Telegram botundan yönetilir.** Bu klasördeki iki dosya bütün arşivlerde
aynıdır:

| Dosya | Nereye | Ne yapar |
|---|---|---|
| `form_olustur.gs` | Form projesi (`Kod.gs`) | Her bölüme Hoca Yorumlama, Ders Yorumlama, Ders Özellikleri Oylama formlarını açar; listeleri her gece README'lerden tazeler |
| `telegram_bot.gs` | Bot projesi | Bütün bölümlerin onay bekleyen yorumlarını her sabah Telegram'dan gönderir; tek tuşla onay/red |

Formlar kurulana kadar arşiv sorunsuz çalışır; README'lerde form linkleri yerine "Henüz yorum yok." yazar.
Yorumlar yalnızca cevap tablosundaki **Onay** sütunu "Onay" ise README'ye girer.

## Yeni bölüm eklemek

1. `form_olustur.gs` içindeki `ARSIVLER` listesine bölümün repo adını ekle (README aracının şablonunda değiştirip
   **Altyapıyı Güncelle** ile bütün arşivlere dağıt).
2. Form projesinde kodu güncelle, **kurulum**'u çalıştır ("Süre doldu" derse bir kez daha), sonra **formAyarlari**.
3. Günlükteki bölüm bloğunu README aracında **Konfigürasyon Düzenle → Form ayarlarını yapıştır** kutusuna yapıştır,
   kaydet, **📝 Readme Güncelle** ve pushla.
4. Arşivin GitHub reposunda **Settings → Environments → New environment:** adı `form-bekleme`, **Wait timer** 5 dakika.
   Onaylanan yorumları README'ye taşıyan "Form Yorum Takibi" iş akışı bu bekleme ile 5–6 dakikada bir çalışır.

## İlk kurulum (sıfırdan)

1. [script.google.com](https://script.google.com) → **Yeni proje** (form projesi) → `form_olustur.gs`'i `Kod.gs`'e yapıştır →
   **kurulum** → **formAyarlari**. Cevaplar "Marmara Arşiv — Bölümlerin Form Cevapları" tablosunda toplanır; tablo
   bağlantıyla görüntülenebilir yapılır, GitHub sayfaları CSV olarak buradan okur.
2. Ayrı bir proje (bot projesi) → `telegram_bot.gs`'i yapıştır → **Proje Ayarları (⚙️) → Komut dosyası özellikleri:**
   `TG_TOKEN` (@BotFather → `/newbot` token'ı; koda ya da repoya asla yazma) ve `TABLOLAR` (formAyarlari günlüğe yazar).
   Saat dilimi: **(GMT+03:00) İstanbul**. Botuna `/start` yaz, **telegramKur**'u çalıştır.

Apps Script'e yapıştırılmış kod kendiliğinden güncellenmez; bu dosyalar değişirse yeniden yapıştırman gerekir.
