/**
 * Marmara Arşiv — Telegram onay botu (bütün bölümler için TEK bot)
 *
 * Her sabah bütün bölümlerin onay bekleyen form yorumlarını Telegram'dan gönderir; "✅ Onayla / ❌ Reddet"
 * tuşlarına basınca cevap tablosundaki "Onay" sütununa "Onay" ya da "Red" yazar. README'leri GitHub tarafı
 * günceller (her repodaki "Form Yorum Takibi" iş akışı tabloları birkaç dakikada bir okur), burada GitHub anahtarı yok.
 *
 * Kurulum (form projesinden ayrı bir Apps Script projesi olabilir):
 *   1. Proje Ayarları (⚙️) → Komut dosyası özellikleri:
 *        TG_TOKEN  = @BotFather'ın verdiği token (koda ya da repoya ASLA yazma)
 *        TABLOLAR  = cevap tablolarının kimlikleri, virgülle (form projesindeki formAyarlari günlüğe yazar)
 *      Aynı sayfada saat dilimi: "(GMT+03:00) İstanbul".
 *   2. Botuna Telegram'dan /start yaz, sonra telegramKur'u bir kez çalıştır.
 * Eski tek bölümlü bottan geçerken telegramKur'u yeniden çalıştırmaya gerek yok: fonksiyon adları ve kayıtlar aynı.
 */

const BILDIRIM_SAATI = 9;    // her sabah kaçta mesaj gelsin
const VARSAYILAN_ARSIV = 'tek_bilgisayar';  // sayfa adında bölüm yazmayan (ilk kurulumun) tablosu

function ozellik_(ad) {
  return PropertiesService.getScriptProperties().getProperty(ad);
}

function tg_(metod, veri) {
  const token = ozellik_('TG_TOKEN');
  if (!token) throw new Error('Proje Ayarları → Komut dosyası özellikleri\'ne TG_TOKEN ekle.');
  const yanit = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/${metod}`, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(veri || {}),
    muteHttpExceptions: true,
  });
  return JSON.parse(yanit.getContentText());
}

/** Bir kez çalıştırılır: sahibin sohbetini kaydeder ve zamanlayıcıları kurar. */
function telegramKur() {
  const props = PropertiesService.getScriptProperties();
  tg_('deleteWebhook', {});
  const guncellemeler = tg_('getUpdates', { timeout: 0 }).result || [];
  const start = guncellemeler.filter(u => u.message && u.message.text === '/start').pop();
  if (start) props.setProperty('TG_CHAT', String(start.message.chat.id));
  else if (!props.getProperty('TG_CHAT')) throw new Error('Botuna Telegram\'dan /start yazıp tekrar çalıştır.');
  const chat = props.getProperty('TG_CHAT');
  if (guncellemeler.length) props.setProperty('TG_OFFSET', String(guncellemeler[guncellemeler.length - 1].update_id + 1));

  for (const t of ScriptApp.getProjectTriggers()) {
    if (['gunlukBildirim', 'tgYokla'].includes(t.getHandlerFunction())) ScriptApp.deleteTrigger(t);
  }
  ScriptApp.newTrigger('gunlukBildirim').timeBased().everyDays(1).atHour(BILDIRIM_SAATI).nearMinute(0).create();
  ScriptApp.newTrigger('tgYokla').timeBased().everyMinutes(1).create();

  tg_('sendMessage', {
    chat_id: chat,
    text: `✅ Bağlantı kuruldu. Her sabah ${BILDIRIM_SAATI}:00'da onay bekleyen yorumlar gelecek.\n` +
          'İstediğin an /bekleyen yazarak hemen görebilirsin.',
  });
  Logger.log('Saat dilimi: ' + Session.getScriptTimeZone() + ' (İstanbul değilse Proje Ayarları\'ndan değiştir)');
  gunlukBildirim();
}

/** TABLOLAR özelliğindeki cevap tablolarının kimlikleri (eski kurulumda "tablo" özelliği). */
function tablolar_() {
  const liste = (ozellik_('TABLOLAR') || ozellik_('tablo') || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!liste.length) throw new Error('Proje Ayarları → Komut dosyası özellikleri\'ne TABLOLAR ekle.');
  return liste;
}

/** Yorum sayfaları: [{sayfa, tablo (sıra no), arsiv, tur, onay, yorum, konu, isim}] */
function yorumSayfalari_() {
  const sonuc = [];
  tablolar_().forEach((id, tablo) => {
    for (const sayfa of SpreadsheetApp.openById(id).getSheets()) {
      const baslik = sayfa.getRange(1, 1, 1, Math.max(1, sayfa.getLastColumn())).getValues()[0].map(String);
      const yorum = baslik.findIndex(b => /hakkındaki yorumun/.test(b));
      if (yorum < 0) continue;
      let onay = baslik.findIndex(b => b.trim().toLowerCase() === 'onay');
      if (onay < 0) {  // "Onay" sütunu yoksa ekle
        onay = baslik.filter(b => b !== '').length;
        sayfa.getRange(1, onay + 1).setValue('Onay');
      }
      // Ortak tablonun sayfaları "tek_siber • Hoca Yorumlama" diye adlandırılır.
      const ad = sayfa.getName();
      sonuc.push({
        sayfa, tablo, onay, yorum,
        arsiv: ad.indexOf('•') >= 0 ? ad.split('•')[0].trim() : VARSAYILAN_ARSIV,
        konu: baslik.findIndex(b => /seç$/i.test(b.trim())),
        isim: baslik.findIndex(b => /İsmin/.test(b)),
        tur: /Hoca/.test(baslik[yorum]) ? '🎓 Hoca' : '📘 Ders',
      });
    }
  });
  return sonuc;
}

function bekleyenler_() {
  const liste = [];
  for (const s of yorumSayfalari_()) {
    const son = s.sayfa.getLastRow();
    if (son < 2) continue;
    const veri = s.sayfa.getRange(2, 1, son - 1, s.sayfa.getLastColumn()).getValues();
    veri.forEach((r, i) => {
      if (String(r[s.yorum]).trim() && !String(r[s.onay]).trim()) {
        liste.push({ s, satir: i + 2, konu: r[s.konu], isim: r[s.isim], yorum: String(r[s.yorum]), zaman: r[0] });
      }
    });
  }
  return liste;
}

/** Her sabah: onay bekleyen yorumları tek tek gönderir (bekleyen yoksa mesaj atmaz). */
function gunlukBildirim() {
  const chat = ozellik_('TG_CHAT');
  if (!chat) return;
  const bekleyen = bekleyenler_();
  if (!bekleyen.length) return;
  tg_('sendMessage', { chat_id: chat, text: `☀️ Günaydın! Onay bekleyen ${bekleyen.length} yorum var:` });
  for (const b of bekleyen) {
    const tarih = b.zaman instanceof Date ? Utilities.formatDate(b.zaman, 'Europe/Istanbul', 'dd.MM.yyyy HH:mm') : b.zaman;
    const kimlik = `${b.s.tablo}|${b.s.sayfa.getSheetId()}|${b.satir}`;
    tg_('sendMessage', {
      chat_id: chat,
      text: `🏛 ${b.s.arsiv}\n${b.s.tur}: ${b.konu}\n👤 ${b.isim}   📅 ${tarih}\n\n${b.yorum.slice(0, 3500)}`,
      reply_markup: { inline_keyboard: [[
        { text: '✅ Onayla', callback_data: `o|${kimlik}` },
        { text: '❌ Reddet', callback_data: `r|${kimlik}` },
      ]] },
    });
  }
}

/** Dakikada bir: tuşlara basılmış mı bakar ve tabloya işler. */
function tgYokla() {
  const kilit = LockService.getScriptLock();
  if (!kilit.tryLock(5000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const chat = props.getProperty('TG_CHAT');
    const guncellemeler = tg_('getUpdates', {
      offset: Number(props.getProperty('TG_OFFSET') || 0), timeout: 0,
      allowed_updates: ['callback_query', 'message'],
    }).result || [];
    let sayfalar = null;
    for (const u of guncellemeler) {
      props.setProperty('TG_OFFSET', String(u.update_id + 1));
      if (u.message && String(u.message.chat.id) === chat && u.message.text === '/bekleyen') {
        if (!bekleyenler_().length) tg_('sendMessage', { chat_id: chat, text: '👌 Onay bekleyen yorum yok.' });
        gunlukBildirim();
      }
      const c = u.callback_query;
      if (!c || String(c.message.chat.id) !== chat) continue;
      // "o|tablo|sayfa|satır"; eski tek tablolu bottan kalan mesajlar "o|sayfa|satır"
      const p = c.data.split('|');
      const [islem, tablo, sayfaId, satir] = p.length === 3 ? [p[0], '0', p[1], p[2]] : p;
      sayfalar = sayfalar || yorumSayfalari_();
      const s = sayfalar.find(x => String(x.tablo) === tablo && String(x.sayfa.getSheetId()) === sayfaId);
      if (!s) continue;
      s.sayfa.getRange(Number(satir), s.onay + 1).setValue(islem === 'o' ? 'Onay' : 'Red');
      tg_('answerCallbackQuery', { callback_query_id: c.id, text: islem === 'o' ? 'Onaylandı' : 'Reddedildi' });
      tg_('editMessageText', {
        chat_id: chat, message_id: c.message.message_id,
        text: c.message.text + (islem === 'o'
          ? '\n\n✅ Onaylandı — README\'ye ~10-15 dk içinde eklenir'
          : '\n\n❌ Reddedildi'),
      });
    }
  } finally {
    kilit.releaseLock();
  }
}
