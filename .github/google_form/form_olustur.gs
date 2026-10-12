/**
 * Marmara Arşiv — bütün bölümlerin Google Formları (TEK Apps Script projesi)
 *
 * Her bölüm arşivi (MarmaraArsiv/<repo>) için üç form: Hoca Yorumlama, Ders Yorumlama, Ders Özellikleri Oylama.
 * Açılır listeler her gece o bölümün ana README'sinden (ders ve hoca kartları) tazelenir.
 * Cevaplar ortak bir Google E-Tablo'da, her form ayrı sayfada toplanır; GitHub her sayfayı CSV olarak okur.
 * İlk kurulan bölümün (tek_bilgisayar) formları ve tablosu eski kurulumdan aynen kullanılır.
 *
 * Kullanım (script.google.com, form projesi):
 *   1. Bu dosyanın içeriğini Kod.gs'e yapıştır, kaydet.
 *   2. kurulum → yeni bölümlerin formlarını açar. "Süre doldu" yazarsa tekrar çalıştır, kaldığı yerden sürer.
 *   3. formAyarlari → günlükteki bloğu README aracına (ya da arşivlerin bakımını yapana) ver.
 * Yeni bölüm eklemek: ARSIVLER'e bir satır ekle, kurulum ve formAyarlari'nı yeniden çalıştır.
 */

const LOGO_URL = 'https://www.marmara.edu.tr/_assets/marmara/custom/images/marmara_universitesi_logo.png';
const ORG = 'MarmaraArsiv';

// Repo adı → form başlıklarında görünen bölüm adı
const ARSIVLER = {
  tek_bilgisayar: 'Bilgisayar Müh. (Teknoloji Fak.)',
  tek_siber: 'Siber Güvenlik Müh. (Teknoloji Fak.)',
  tek_eee: 'Elektrik-Elektronik Müh. (Teknoloji Fak.)',
  tek_makine: 'Makine Müh. (Teknoloji Fak.)',
  tek_mekatronik: 'Mekatronik Müh. (Teknoloji Fak.)',
  muh_bilgisayar: 'Bilgisayar Müh. (Mühendislik Fak.)',
  muh_eee: 'Elektrik-Elektronik Müh. (Mühendislik Fak.)',
  muh_makine: 'Makine Müh. (Mühendislik Fak.)',
};
// İlk kurulumun özellik adları öneksizdi (hocaYorumlama, dersYorumlama, dersOylama, tablo).
const ESKI_KURULUM = 'tek_bilgisayar';

const FORMLAR = ['hocaYorumlama', 'dersYorumlama', 'dersOylama'];
const FORM_ADI = { hocaYorumlama: 'Hoca Yorumlama', dersYorumlama: 'Ders Yorumlama', dersOylama: 'Ders Özellikleri Oylama' };
// README aracındaki adlar ve sorulara göre alan adları (soru sırasıyla)
const ARAC_ADI = { hocaYorumlama: 'hoca_yorumlama', dersYorumlama: 'ders_yorumlama', dersOylama: 'ders_oylama' };
const ALANLAR = {
  hocaYorumlama: ['hoca_alani', 'isim_alani', 'yorum_alani'],
  dersYorumlama: ['ders_alani', 'isim_alani', 'yorum_alani'],
  dersOylama: ['ders_alani', 'kolaylik_alani', 'gereklilik_alani'],
};

// Soru başlıkları GitHub betiğinin okuduğu CSV sütun adlarıdır; değiştirme.
const S = {
  DERS_SEC: 'Ders Seç',
  HOCA_SEC: 'Hoca seç',
  ISIM: 'İsmin nasıl gözüksün',
  DERS_YORUM: 'Ders hakkındaki yorumun',
  HOCA_YORUM: 'Hoca hakkındaki yorumun',
  GEREKLI: 'Ders mesleki açıdan gerekli mi?',
  KOLAY: 'Dersi geçmek ne kadar kolay?',
};

function props_() {
  return PropertiesService.getScriptProperties();
}

function ozellik_(arsiv, tur) {
  return arsiv === ESKI_KURULUM ? tur : arsiv + '.' + tur;
}

// ------------------------------------------------------------------ kurulum

function kurulum() {
  const p = props_();
  const baslangic = Date.now();
  for (const arsiv of Object.keys(ARSIVLER)) {
    let yeni = false;
    for (const tur of FORMLAR) {
      if (p.getProperty(ozellik_(arsiv, tur))) continue;
      if (Date.now() - baslangic > 4.5 * 60 * 1000) {
        Logger.log('⏳ Süre doldu. kurulum fonksiyonunu tekrar çalıştır, kaldığı yerden devam eder.');
        return;
      }
      const form = formOlustur_(arsiv, tur);
      p.setProperty(ozellik_(arsiv, tur), form.getId());
      tabloyaBagla_(form, arsiv, tur);
      Logger.log(`${arsiv} — ${FORM_ADI[tur]}: ${form.getPublishedUrl()}`);
      yeni = true;
    }
    if (yeni) secenekleriDoldur_(arsiv);
  }
  gunlukTetikleyici_();
  Logger.log('✅ Bütün bölümlerin formları hazır. Şimdi formAyarlari fonksiyonunu çalıştır.');
}

/** Yeni bölümlerin cevaplarının toplandığı ortak tablo (ilk çağrıda oluşur, bağlantıyla görüntülenebilir). */
function ortakTablo_() {
  const p = props_();
  const id = p.getProperty('ortakTablo');
  if (id) return SpreadsheetApp.openById(id);
  const tablo = SpreadsheetApp.create('Marmara Arşiv — Bölümlerin Form Cevapları');
  p.setProperty('ortakTablo', tablo.getId());
  // GitHub'daki betik sayfaları CSV olarak bağlantıyla okur (eski kurulumdaki "Web'de yayınla" yerine).
  try {
    DriveApp.getFileById(tablo.getId()).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log('⚠️ Tablo bağlantıyla paylaşılamadı (' + e + '). Tabloyu aç → Paylaş → "Bağlantıya sahip olan herkes: Görüntüleyen".');
  }
  return tablo;
}

function tabloyaBagla_(form, arsiv, tur) {
  const eskiTablo = arsiv === ESKI_KURULUM ? props_().getProperty('tablo') : null;
  const tablo = eskiTablo ? SpreadsheetApp.openById(eskiTablo) : ortakTablo_();
  form.setDestination(FormApp.DestinationType.SPREADSHEET, tablo.getId());
  SpreadsheetApp.flush();
  const sayfa = formSayfasi_(SpreadsheetApp.openById(tablo.getId()), form);
  if (sayfa && !eskiTablo) sayfa.setName(`${arsiv} • ${FORM_ADI[tur]}`);
}

/** Formun cevaplarının yazıldığı sayfa. */
function formSayfasi_(tablo, form) {
  return tablo.getSheets().find(s => (s.getFormUrl() || '').indexOf(form.getId()) >= 0) || null;
}

function formOlustur_(arsiv, tur) {
  const bolum = ARSIVLER[arsiv];
  if (tur === 'dersOylama') {
    const f = yeniForm_(`Ders Özellikleri Oylama — ${bolum}`, 'Ders özellikleri oylanır');
    f.addListItem().setTitle(S.DERS_SEC).setRequired(true);
    puan_(f, S.KOLAY);
    puan_(f, S.GEREKLI);
    return f;
  }
  if (tur === 'dersYorumlama') {
    const f = yeniForm_(`Ders Yorumlama — ${bolum}`,
      'Dersin içeriği, zorluğu, sınavları, ödev ve projeleri, çıkmış soruların işe yarayıp yaramadığı, kaynakları vb. hakkında olabilir. ' +
      'Dersi hangi yıl ve hangi hocadan aldığınızı belirtmeniz de iyi olabilir.');
    f.addListItem().setTitle(S.DERS_SEC).setRequired(true);
    isim_(f);
    f.addParagraphTextItem().setTitle(S.DERS_YORUM).setRequired(true);
    return f;
  }
  const f = yeniForm_(`Hoca Yorumlama — ${bolum}`,
    'Hocanın ders anlatışı, dersi zorlaması, sınavları zamanında okuması, çıkmış sorup sormaması, derse zamanında gelmesi, ' +
    'derse geldikten sonra girmeye izin vermesi vb. hakkında olabilir. Hangi derslerini aldığınızı vs. belirtmeniz de iyi olabilir.');
  f.addListItem().setTitle(S.HOCA_SEC).setRequired(true);
  isim_(f);
  f.addParagraphTextItem().setTitle(S.HOCA_YORUM).setRequired(true);
  return f;
}

function yeniForm_(baslik, aciklama) {
  const form = FormApp.create(baslik);
  form.setDescription(aciklama)
    .setCollectEmail(false)
    .setLimitOneResponsePerUser(false)
    .setAllowResponseEdits(false)
    .setProgressBar(false);
  try {
    form.addImageItem()
      .setImage(UrlFetchApp.fetch(LOGO_URL).getBlob())
      .setAlignment(FormApp.Alignment.CENTER)
      .setWidth(368);
  } catch (e) {
    Logger.log('Logo eklenemedi: ' + e);
  }
  return form;
}

function puan_(form, baslik) {
  form.addScaleItem().setTitle(baslik).setBounds(1, 10).setRequired(true);
}

function isim_(form) {
  form.addTextItem().setTitle(S.ISIM).setHelpText('Mahlas, nick vb.').setRequired(true);
}

function gunlukTetikleyici_() {
  const mevcut = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'secenekleriGuncelle');
  mevcut.slice(1).forEach(t => ScriptApp.deleteTrigger(t));
  if (!mevcut.length) ScriptApp.newTrigger('secenekleriGuncelle').timeBased().everyDays(1).atHour(4).create();
}

// ------------------------------------------------------------------ açılır listeler

/** Bütün bölümlerin ders ve hoca listelerini repolarındaki README'lerden tazeler (her gece kendiliğinden çalışır). */
function secenekleriGuncelle() {
  for (const arsiv of Object.keys(ARSIVLER)) secenekleriDoldur_(arsiv);
}

function secenekleriDoldur_(arsiv) {
  const p = props_();
  const readme = readme_(arsiv);
  if (!readme) {
    Logger.log(`${arsiv}: README okunamadı, listeler değiştirilmedi.`);
    return;
  }
  const dersler = dersListesi_(readme);
  const hocalar = hocaListesi_(readme);
  listeyiDoldur_(p.getProperty(ozellik_(arsiv, 'dersOylama')), S.DERS_SEC, dersler);
  listeyiDoldur_(p.getProperty(ozellik_(arsiv, 'dersYorumlama')), S.DERS_SEC, dersler);
  listeyiDoldur_(p.getProperty(ozellik_(arsiv, 'hocaYorumlama')), S.HOCA_SEC, hocalar);
  Logger.log(`${arsiv}: ${dersler.length} ders, ${hocalar.length} hoca yüklendi.`);
}

function readme_(arsiv) {
  // raw.githubusercontent.com'un API gibi saatlik istek sınırı yok.
  const yanit = UrlFetchApp.fetch(`https://raw.githubusercontent.com/${ORG}/${arsiv}/main/README.md`, { muteHttpExceptions: true });
  return yanit.getResponseCode() === 200 ? yanit.getContentText() : null;
}

function listeyiDoldur_(formId, baslik, secenekler) {
  if (!formId || secenekler.length === 0) return;  // README boşsa eski liste korunur
  const oge = FormApp.openById(formId).getItems(FormApp.ItemType.LIST).find(i => i.getTitle() === baslik);
  if (oge) oge.asListItem().setChoiceValues(secenekler);
}

/** Ana README'deki "📂 [Ders Klasörü](./<dönem>/<ders>)" linklerinden ders adları. */
function dersListesi_(readme) {
  const dersler = [];
  const desen = /📂 \[Ders Klasörü\]\(\.\/([^)]+)\)/g;
  let m;
  while ((m = desen.exec(readme)) !== null) {
    const [klasor, ders] = decodeURIComponent(m[1]).split('/');
    if (klasor && ders && !dersler.includes(ders)) dersler.push(ders);
  }
  return dersler.sort((a, b) => a.localeCompare(b, 'tr'));
}

/** Ana README'deki hoca kartı başlıklarından ("#### 👨‍🏫 Prof. Dr. Ad Soyad ") hoca adları, README sırasıyla. */
function hocaListesi_(readme) {
  const hocalar = [];
  const desen = /^#### (\S+) (.+) $/gmu;
  let m;
  while ((m = desen.exec(readme)) !== null) {
    if (m[1] !== '📘' && !hocalar.includes(m[2])) hocalar.push(m[2]);
  }
  return hocalar;
}

// ------------------------------------------------------------------ README aracına verilecek ayarlar

/**
 * Her bölümün form linklerini, soruların "entry" kimliklerini ve cevapların CSV adreslerini günlüğe yazar
 * (konfigurasyon.json "formlar" alanı). Telegram bot projesine girilecek TABLOLAR değerini de yazar.
 */
function formAyarlari() {
  const p = props_();
  const sonuc = {};
  for (const arsiv of Object.keys(ARSIVLER)) {
    if (arsiv === ESKI_KURULUM && p.getProperty('tablo')) continue;  // eski kurulumun ayarları README aracında zaten var
    const ayar = {};
    for (const tur of FORMLAR) {
      const id = p.getProperty(ozellik_(arsiv, tur));
      if (!id) continue;
      ayar[ARAC_ADI[tur]] = formAyari_(FormApp.openById(id), tur);
    }
    if (Object.keys(ayar).length) sonuc[arsiv] = ayar;
  }
  const tablolar = [p.getProperty('tablo'), p.getProperty('ortakTablo')].filter(Boolean).join(',');
  Logger.log('Telegram bot projesinde Komut dosyası özellikleri → TABLOLAR = ' + tablolar);
  Logger.log('README araçları için form ayarları (hepsini kopyala):\n' + JSON.stringify(sonuc, null, 1));
}

function formAyari_(form, tur) {
  const yanit = form.createResponse();
  for (const oge of form.getItems()) {
    const t = oge.getType();
    if (t === FormApp.ItemType.LIST) {
      const secenek = oge.asListItem().getChoices();
      // Boş listede soru atlanır ve kimlikler kayar: önce listeler dolmalı.
      if (!secenek.length) throw new Error(form.getTitle() + ': açılır liste boş. Önce secenekleriGuncelle çalıştır.');
      yanit.withItemResponse(oge.asListItem().createResponse(secenek[0].getValue()));
    } else if (t === FormApp.ItemType.SCALE) {
      yanit.withItemResponse(oge.asScaleItem().createResponse(1));
    } else if (t === FormApp.ItemType.TEXT) {
      yanit.withItemResponse(oge.asTextItem().createResponse('x'));
    } else if (t === FormApp.ItemType.PARAGRAPH_TEXT) {
      yanit.withItemResponse(oge.asParagraphTextItem().createResponse('x'));
    }
  }
  const kimlikler = [...yanit.toPrefilledUrl().matchAll(/entry\.(\d+)=/g)].map(m => m[1]);
  const ayar = { link: form.getPublishedUrl() };
  ALANLAR[tur].forEach((alan, i) => { ayar[alan] = kimlikler[i] || ''; });
  let tabloId = null;
  try {
    tabloId = form.getDestinationId();
  } catch (e) {
    Logger.log(form.getTitle() + ': cevap tablosuna bağlı değil.');
  }
  const sayfa = tabloId ? formSayfasi_(SpreadsheetApp.openById(tabloId), form) : null;
  ayar[ARAC_ADI[tur] + '_csv'] = sayfa
    ? `https://docs.google.com/spreadsheets/d/${tabloId}/export?format=csv&gid=${sayfa.getSheetId()}`
    : '';
  return ayar;
}
