/**
 * Marmara Arşiv — Telegram onay botu (form_olustur.gs ile AYNI Apps Script projesine ikinci dosya olarak eklenir)
 *
 * Her sabah onay bekleyen form yorumlarını Telegram'dan gönderir; "✅ Onayla / ❌ Reddet" tuşlarına
 * basınca cevap tablosundaki "Onay" sütununa "Onay" ya da "Red" yazar.
 * README'yi GitHub tarafı günceller: "README Otomatik Güncelleme" iş akışı 5 dakikada bir tabloya bakar,
 * yeni onay varsa işleyip kapanır. Bu yüzden burada GitHub anahtarı yok.
 *
 * Kurulum:
 *   1. Telegram'da @BotFather → /newbot → verdiği token'ı Proje Ayarları (⚙️) → Komut dosyası
 *      özellikleri'ne TG_TOKEN adıyla ekle. Her bölümün kendi botu olmalı (iki proje aynı botu
 *      dinlerse tuş basışlarını birbirinden kapar).
 *   2. Kendi botuna Telegram'dan /start yaz.
 *   3. Proje Ayarları (⚙️) → Saat dilimi: "(GMT+03:00) İstanbul" seç.
 *   4. Fonksiyon listesinden telegramKur'u seçip ▶ Çalıştır.
 */

// Token koda yazılmaz: Proje Ayarları (⚙️) → Komut dosyası özellikleri → TG_TOKEN
const TELEGRAM_TOKEN = PropertiesService.getScriptProperties().getProperty('TG_TOKEN') || '';
const BILDIRIM_SAATI = 9;    // her sabah kaçta mesaj gelsin
const CEVAP_TABLOSU_ID = '';  // form_olustur.gs ile aynı projedeyse boş kalır ("tablo" özelliği kullanılır)
const ARSIV_ADI = 'tek_bilgisayar';

function tg_(metod, veri) {
  const yanit = UrlFetchApp.fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${metod}`, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(veri || {}),
    muteHttpExceptions: true,
  });
  return JSON.parse(yanit.getContentText());
}

/** Bir kez çalıştırılır: sahibin sohbetini kaydeder ve zamanlayıcıları kurar. */
function telegramKur() {
  if (!TELEGRAM_TOKEN) throw new Error('Önce Proje Ayarları → Komut dosyası özellikleri\'ne TG_TOKEN ekle.');
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

/** Cevap tablosundaki yorum sayfaları: [{sayfa, tur, sutun}] */
function yorumSayfalari_() {
  const id = PropertiesService.getScriptProperties().getProperty('tablo') || CEVAP_TABLOSU_ID;
  const sonuc = [];
  for (const sayfa of SpreadsheetApp.openById(id).getSheets()) {
    const baslik = sayfa.getRange(1, 1, 1, Math.max(1, sayfa.getLastColumn())).getValues()[0].map(String);
    const yorum = baslik.findIndex(b => /hakkındaki yorumun/.test(b));
    if (yorum < 0) continue;
    let onay = baslik.findIndex(b => b.trim().toLowerCase() === 'onay');
    if (onay < 0) {  // "Onay" sütunu yoksa ekle
      onay = baslik.filter(b => b !== '').length;
      sayfa.getRange(1, onay + 1).setValue('Onay');
    }
    sonuc.push({
      sayfa, onay, yorum,
      konu: baslik.findIndex(b => /seç$/i.test(b.trim())),
      isim: baslik.findIndex(b => /İsmin/.test(b)),
      tur: /Hoca/.test(baslik[yorum]) ? '🎓 Hoca' : '📘 Ders',
    });
  }
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
  const chat = PropertiesService.getScriptProperties().getProperty('TG_CHAT');
  if (!chat) return;
  const bekleyen = bekleyenler_();
  if (!bekleyen.length) return;
  tg_('sendMessage', { chat_id: chat, text: `☀️ Günaydın! ${ARSIV_ADI} arşivinde onay bekleyen ${bekleyen.length} yorum var:` });
  for (const b of bekleyen) {
    const tarih = b.zaman instanceof Date ? Utilities.formatDate(b.zaman, 'Europe/Istanbul', 'dd.MM.yyyy HH:mm') : b.zaman;
    tg_('sendMessage', {
      chat_id: chat,
      text: `${b.s.tur}: ${b.konu}\n👤 ${b.isim}   📅 ${tarih}\n\n${b.yorum.slice(0, 3500)}`,
      reply_markup: { inline_keyboard: [[
        { text: '✅ Onayla', callback_data: `o|${b.s.sayfa.getSheetId()}|${b.satir}` },
        { text: '❌ Reddet', callback_data: `r|${b.s.sayfa.getSheetId()}|${b.satir}` },
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
    for (const u of guncellemeler) {
      props.setProperty('TG_OFFSET', String(u.update_id + 1));
      if (u.message && String(u.message.chat.id) === chat && u.message.text === '/bekleyen') {
        if (!bekleyenler_().length) tg_('sendMessage', { chat_id: chat, text: '👌 Onay bekleyen yorum yok.' });
        gunlukBildirim();
      }
      const c = u.callback_query;
      if (!c || String(c.message.chat.id) !== chat) continue;
      const [islem, sayfaId, satir] = c.data.split('|');
      const s = yorumSayfalari_().find(x => String(x.sayfa.getSheetId()) === sayfaId);
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
