/**
 * Marmara Arşiv (tek_bilgisayar) — Google Form kurulumu (Apps Script)
 *
 * script.google.com → Yeni proje → bu dosyanın içeriğini yapıştır →
 * önce `kurulum` fonksiyonunu çalıştır (ilk seferde Google izin ister).
 *
 * Oluşturulanlar (YTÜ arşivindeki yapıyla aynı):
 *   - Hoca Yorumlama, Ders Yorumlama, Ders Özellikleri Oylama formları
 *   - Üç formun cevaplarını ayrı sayfalarda toplayan tek bir Google E-Tablo
 *   - Ders/hoca listelerini her gece repodan tazeleyen zamanlı tetikleyici
 *
 * Ders ve hoca listeleri repodaki ana README'den (ders kartları ve hoca
 * kartları) okunur. Repoya yeni ders/hoca eklenince formlar ertesi gün
 * kendiliğinden güncellenir.
 */

const REPO = 'MarmaraArsiv/tek_bilgisayar';
const LOGO_URL = 'https://www.marmara.edu.tr/_assets/marmara/custom/images/marmara_universitesi_logo.png';

// Soru başlıkları YTÜ'deki CSV sütun adlarıyla aynı tutuldu (README aracı bunları okuyacak).
const S = {
  DERS_SEC: 'Ders Seç',
  HOCA_SEC: 'Hoca seç',
  ISIM: 'İsmin nasıl gözüksün',
  DERS_YORUM: 'Ders hakkındaki yorumun',
  HOCA_YORUM: 'Hoca hakkındaki yorumun',
  GEREKLI: 'Ders mesleki açıdan gerekli mi?',
  KOLAY: 'Dersi geçmek ne kadar kolay?',
};

function kurulum() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('dersOylama')) {
    throw new Error('Formlar zaten kurulu. Listeleri tazelemek için secenekleriGuncelle çalıştır.');
  }

  // 1) Formlar (sıra: cevap tablosundaki sayfa sırası da bu olur)
  const formlar = {
    hocaYorumlama: hocaYorumlamaFormu_(),
    dersYorumlama: dersYorumlamaFormu_(),
    dersOylama: dersOylamaFormu_(),
  };
  for (const [anahtar, form] of Object.entries(formlar)) {
    props.setProperty(anahtar, form.getId());
  }

  // 2) Açılır listeler + her gece tazeleme
  secenekleriGuncelle();
  ScriptApp.newTrigger('secenekleriGuncelle').timeBased().everyDays(1).atHour(4).create();

  for (const [anahtar, form] of Object.entries(formlar)) {
    Logger.log(`${anahtar}: ${form.getPublishedUrl()}`);
  }

  // 3) Cevap tablosu — burada hata alınırsa formlar yine de hazırdır.
  cevapTablosuBagla();
  formAyarlari();
}

/** Üç formun cevaplarını tek E-Tablo'ya bağlar. kurulum'dan ayrı olarak da çalıştırılabilir. */
function cevapTablosuBagla() {
  const props = PropertiesService.getScriptProperties();
  let tablo;
  try {
    tablo = props.getProperty('tablo')
      ? SpreadsheetApp.openById(props.getProperty('tablo'))
      : SpreadsheetApp.create(`Marmara Arşiv (${REPO.split('/')[1]}) — Form Cevapları`);
  } catch (e) {
    Logger.log('⚠️ Cevap tablosu oluşturulamadı: ' + e);
    Logger.log('Çözüm: sheets.google.com\'u bu hesapla bir kez açıp boş bir tablo oluştur, ' +
               'sonra fonksiyon listesinden "cevapTablosuBagla"yı seçip tekrar çalıştır. ' +
               'İzin penceresi gelirse TÜM kutucukları işaretle.');
    return;
  }
  props.setProperty('tablo', tablo.getId());
  for (const anahtar of ['hocaYorumlama', 'dersYorumlama', 'dersOylama']) {
    const id = props.getProperty(anahtar);
    if (id) FormApp.openById(id).setDestination(FormApp.DestinationType.SPREADSHEET, tablo.getId());
  }
  Logger.log(`Cevap tablosu: ${tablo.getUrl()}`);
}

function yeniForm_(baslik, aciklama) {
  const form = FormApp.create(baslik);
  form.setDescription(aciklama)
    .setCollectEmail(false)
    .setLimitOneResponsePerUser(false)
    .setAllowResponseEdits(false)
    .setProgressBar(false);
  // Logo en üstte. (Formun büyük başlık görseli API ile ayarlanamıyor; istenirse
  // formda "Temayı özelleştir → Başlık → Resim seç" ile elle eklenebilir.)
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

function dersOylamaFormu_() {
  const f = yeniForm_('Ders Özellikleri Oylama', 'Ders özellikleri oylanır');
  f.addListItem().setTitle(S.DERS_SEC).setRequired(true);
  puan_(f, S.KOLAY);
  puan_(f, S.GEREKLI);
  return f;
}

function dersYorumlamaFormu_() {
  const f = yeniForm_('Ders Yorumlama',
    'Dersin içeriği, zorluğu, sınavları, ödev ve projeleri, çıkmış soruların işe yarayıp yaramadığı, kaynakları vb. hakkında olabilir. ' +
    'Dersi hangi yıl ve hangi hocadan aldığınızı belirtmeniz de iyi olabilir.');
  f.addListItem().setTitle(S.DERS_SEC).setRequired(true);
  isim_(f);
  f.addParagraphTextItem().setTitle(S.DERS_YORUM).setRequired(true);
  return f;
}

function hocaYorumlamaFormu_() {
  const f = yeniForm_('Hoca Yorumlama',
    'Hocanın ders anlatışı, dersi zorlaması, sınavları zamanında okuması, çıkmış sorup sormaması, derse zamanında gelmesi, ' +
    'derse geldikten sonra girmeye izin vermesi vb. hakkında olabilir. Hangi derslerini aldığınızı vs. belirtmeniz de iyi olabilir.');
  f.addListItem().setTitle(S.HOCA_SEC).setRequired(true);
  isim_(f);
  f.addParagraphTextItem().setTitle(S.HOCA_YORUM).setRequired(true);
  return f;
}

/** Ders ve hoca açılır listelerini repodaki güncel verilerle doldurur. */
function secenekleriGuncelle() {
  const props = PropertiesService.getScriptProperties();
  const dersler = dersListesi_();
  const hocalar = hocaListesi_();
  listeyiDoldur_(props.getProperty('dersOylama'), S.DERS_SEC, dersler);
  listeyiDoldur_(props.getProperty('dersYorumlama'), S.DERS_SEC, dersler);
  listeyiDoldur_(props.getProperty('hocaYorumlama'), S.HOCA_SEC, hocalar);
  Logger.log(`${dersler.length} ders, ${hocalar.length} hoca yüklendi.`);
}

function listeyiDoldur_(formId, baslik, secenekler) {
  if (!formId || secenekler.length === 0) return;  // repo okunamadıysa eski listeyi koru
  const oge = FormApp.openById(formId).getItems(FormApp.ItemType.LIST)
    .find(i => i.getTitle() === baslik);
  oge.asListItem().setChoiceValues(secenekler);
}

function dersListesi_() {
  // Ana README'deki "📂 [Ders Klasörü](./<dönem>/<ders>)" linklerinden okunur
  // (raw.githubusercontent.com'un API gibi saatlik istek limiti yok).
  const url = `https://raw.githubusercontent.com/${REPO}/main/README.md`;
  const yanit = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (yanit.getResponseCode() !== 200) return [];
  const dersler = [];
  const desen = /📂 \[Ders Klasörü\]\(\.\/([^)]+)\)/g;
  let m;
  while ((m = desen.exec(yanit.getContentText())) !== null) {
    const [klasor, ders] = decodeURIComponent(m[1]).split('/');
    if (klasor && ders && !dersler.includes(ders)) dersler.push(ders);
  }
  return dersler.sort((a, b) => a.localeCompare(b, 'tr'));
}

function hocaListesi_() {
  // Ana README'deki hoca kartı başlıklarından okunur ("#### 👨‍🏫 Prof. Dr. Ad Soyad "), ders listesi gibi:
  // repodaki JSON dosyalarının yeri değişse de etkilenmez. Sıra README'deki sıradır.
  const url = `https://raw.githubusercontent.com/${REPO}/main/README.md`;
  const yanit = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (yanit.getResponseCode() !== 200) return [];
  const hocalar = [];
  const desen = /^#### (\S+) (.+) $/gmu;
  let m;
  while ((m = desen.exec(yanit.getContentText())) !== null) {
    if (m[1] !== '📘' && !hocalar.includes(m[2])) hocalar.push(m[2]);
  }
  return hocalar;
}

/**
 * README aracının Konfigürasyon penceresine yapıştırılacak form ayarlarını günlüğe yazar:
 * form linkleri ve soruların "entry" kimlikleri. CSV linkleri elle eklenir (Dosya → Paylaş → Web'de yayınla).
 */
function formAyarlari() {
  const props = PropertiesService.getScriptProperties();
  const tanim = {
    hoca_yorumlama: ['hocaYorumlama', ['hoca_alani', 'isim_alani', 'yorum_alani']],
    ders_yorumlama: ['dersYorumlama', ['ders_alani', 'isim_alani', 'yorum_alani']],
    ders_oylama: ['dersOylama', ['ders_alani', 'kolaylik_alani', 'gereklilik_alani']],
  };
  const sonuc = {};
  for (const [anahtar, [ozellik, alanlar]] of Object.entries(tanim)) {
    const form = FormApp.openById(props.getProperty(ozellik));
    const yanit = form.createResponse();
    for (const oge of form.getItems()) {
      const t = oge.getType();
      if (t === FormApp.ItemType.LIST) yanit.withItemResponse(oge.asListItem().createResponse('x'));
      else if (t === FormApp.ItemType.SCALE) yanit.withItemResponse(oge.asScaleItem().createResponse(1));
      else if (t === FormApp.ItemType.TEXT) yanit.withItemResponse(oge.asTextItem().createResponse('x'));
      else if (t === FormApp.ItemType.PARAGRAPH_TEXT) yanit.withItemResponse(oge.asParagraphTextItem().createResponse('x'));
    }
    const kimlikler = [...yanit.toPrefilledUrl().matchAll(/entry\.(\d+)=/g)].map(m => m[1]);
    const ayar = { link: form.getPublishedUrl() };
    alanlar.forEach((alan, i) => { ayar[alan] = kimlikler[i] || ''; });
    ayar[anahtar + '_csv'] = '';
    sonuc[anahtar] = ayar;
  }
  Logger.log('README aracında Konfigürasyon → "Form ayarlarını yapıştır" kutusuna şunu yapıştır:\n'
             + JSON.stringify(sonuc, null, 2));
}
