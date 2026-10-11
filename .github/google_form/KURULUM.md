# 🛠 Arşivin GitHub ve Google Form Kurulumu

Bu klasördeki betikler, README'lerdeki ⭐ yıldızları ve 💬 öğrenci görüşlerini besleyen Google Formlarını kurar.
Formlar kurulana kadar arşiv sorunsuz çalışır; README'lerde sadece form linkleri yerine "Henüz yorum yok." yazar.

## 1. GitHub

1. Arşivi [MarmaraArsiv](https://github.com/MarmaraArsiv) altında yeni bir repo olarak aç ve README aracının **Git İşlemleri** penceresinden pushla.
2. **Settings → Actions → General → Workflow permissions:** "Read and write permissions" seç.
3. **Settings → Environments → New environment:** adı `form-bekleme`, **Wait timer** 5 dakika.
   Onaylanan yorumları README'ye taşıyan "Form Yorum Takibi" iş akışı bu bekleme ile 5–6 dakikada bir çalışır.

## 2. Google Formları (`form_olustur.gs`)

1. [script.google.com](https://script.google.com) → **Yeni proje**, bu klasördeki `form_olustur.gs` içeriğini `Kod.gs`'e yapıştır ve kaydet.
2. Fonksiyon listesinden `kurulum`'u seçip **▶ Çalıştır**. İzin isterse tüm kutucukları işaretle.
   Üç form, ortak bir cevap tablosu ve her gece ders/hoca listelerini README'den tazeleyen zamanlayıcı kurulur.
3. Yürütme günlüğünün sonunda bir JSON bloğu çıkar. README aracında **Konfigürasyon Düzenle → Form ayarlarını yapıştır**
   kutusuna yapıştır.
4. Cevap tablosunda üç sayfanın her biri için **Dosya → Paylaş → Web'de yayınla** → sayfayı ve **CSV**'yi seç → linki
   Konfigürasyon penceresindeki ilgili **CSV** alanına yapıştır.
5. Araçta **📝 Readme Güncelle** de ve pushla. README'ler form linkleriyle yeniden üretilir.

Ders ya da hoca ekledikten sonra listelerin hemen güncellenmesi için `secenekleriGuncelle`'yi elle de çalıştırabilirsin.

Yorumlar sadece cevap tablosundaki **Onay** sütunu işaretliyse README'ye girer.

## 3. Telegram onay botu (isteğe bağlı, `telegram_bot.gs`)

Her sabah onay bekleyen yorumları Telegram'dan gönderir, tek tuşla onaylanır.

1. Aynı Apps Script projesine **+ → Komut dosyası** ile ikinci dosya ekle, `telegram_bot.gs` içeriğini yapıştır.
2. Telegram'da @BotFather → `/newbot`. **Her bölümün kendi botu olmalı**; iki proje aynı botu dinlerse tuş basışlarını birbirinden kapar.
3. **Proje Ayarları (⚙️) → Komut dosyası özellikleri:** `TG_TOKEN` adıyla BotFather'ın verdiği token'ı ekle.
   Token'ı asla bu dosyaya ya da repoya yazma. Aynı sayfada saat dilimini **(GMT+03:00) İstanbul** yap.
4. Botuna Telegram'dan `/start` yaz, sonra `telegramKur`'u çalıştır.

## Güncellemeler

Bu klasör, `.github/scripts` ve `.github/workflows` tüm bölüm arşivlerinde aynıdır ve README aracından gelir.
Araçta **Git İşlemleri → 🧰 Altyapıyı Güncelle** bunları aracın sürümüyle eşitler. Burada elle değişiklik yaparsan bir
sonraki güncellemede üzerine yazılır; kalıcı değişiklikleri README aracının reposunda yap.
Apps Script'e yapıştırılmış kod kendiliğinden güncellenmez; bu dosyalar değişirse yeniden yapıştırman gerekir.
