#!/usr/bin/env python3
"""README'deki otomatik görsel bölümleri üretir:

- 📊 Arşiv Doluluk Durumu: her dönemde materyali olan ders oranı + boş ders listesi.
  DOLULUK_AKTIF = False yapılırsa bölüm README'den kaldırılır.

Bölümler README'de <!-- X_BASLANGIC --> / <!-- X_BITIS --> işaretleri arasına yazılır.
Sadece Python standart kütüphanesi kullanılır.
"""
import json
import os
import re
import sys

DOLULUK_AKTIF = True

README_YOLU = "README.md"
DONEMLER_JSON = ".github/json_dosyalari/donemler.json"
MATERYAL_SAYILMAYANLAR = {"readme.md", "readme.txt", ".gitkeep"}


TR_ALFABE = "abcçdefgğhıijklmnoöprsştuüvyz"


def tr_sirala(metin):
    kucuk = metin.replace("I", "ı").replace("İ", "i").lower()
    return [-1 if c == " " else TR_ALFABE.index(c) if c in TR_ALFABE else 100 + ord(c) for c in kucuk]


def dersler(klasor):
    if not os.path.isdir(klasor):
        return []
    return sorted((d for d in os.listdir(klasor)
                   if os.path.isdir(os.path.join(klasor, d)) and not d.startswith(".")),
                  key=tr_sirala)


def materyal_sayisi(ders_yolu):
    return sum(1 for _, _, dosyalar in os.walk(ders_yolu)
               for d in dosyalar if d.lower() not in MATERYAL_SAYILMAYANLAR)


def donem_ve_havuzlar():
    """(klasör, tablodaki ad) çiftleri: önce dönemler, sonra seçmeli havuzları (donemler.json sırasıyla)."""
    with open(DONEMLER_JSON, encoding="utf-8") as f:
        d = json.load(f)
    return ([(x["klasor"], f"{x['yil']}. Yıl {x['donem']}") for x in d["donemler"]]
            + [(h["klasor"], h["klasor"]) for h in d.get("havuzlar", [])])


def cubuk(oran, uzunluk=10):
    dolu = round(oran * uzunluk)
    return "🟩" * dolu + "⬜" * (uzunluk - dolu)


def doluluk():
    satirlar = ["| Dönem | Doluluk | Materyali olan ders |", "|---|---|---|"]
    bos_listeleri = []
    toplam_dolu = toplam = 0
    for klasor, ad in donem_ve_havuzlar():
        liste = dersler(klasor)
        if not liste:
            continue
        dolu = [d for d in liste if materyal_sayisi(os.path.join(klasor, d)) > 0]
        bos = [d for d in liste if d not in dolu]
        toplam_dolu += len(dolu)
        toplam += len(liste)
        oran = len(dolu) / len(liste)
        satirlar.append(f"| [{ad}](./{klasor.replace(' ', '%20')}/) | {cubuk(oran)} %{round(oran * 100)} "
                        f"| {len(dolu)} / {len(liste)} |")
        if bos:
            bos_listeleri.append(f"- **{ad}:** " + ", ".join(bos))
    genel = toplam_dolu / toplam if toplam else 0
    govde = [
        f"Arşivdeki **{toplam}** dersin **{toplam_dolu}** tanesinde en az bir materyal var "
        f"(genel doluluk **%{round(genel * 100)}**).",
        "",
        "```mermaid",
        "pie showData",
        f'  "Materyali olan" : {toplam_dolu}',
        f'  "Henüz boş" : {toplam - toplam_dolu}',
        "```",
        "",
        *satirlar,
    ]
    if bos_listeleri:
        govde += ["", "### 🙋 Bu dersler katkını bekliyor",
                  "Elinde bu derslerden materyal varsa yukarıdaki **🤝 Katkıda Bulunun** bölümüne göz at.", "",
                  *bos_listeleri]
    return ("<details>\n<summary><b>📊 Arşiv Doluluk Durumu</b></summary>\n\n"
            "## 📊 Arşiv Doluluk Durumu\n\n" + "\n".join(govde) + "\n\n</details>")


def bolum_yaz(metin, isim, icerik, once_gelecek):
    """İşaretli bölümü günceller; yoksa `once_gelecek` metninden hemen önce ekler; icerik None ise siler."""
    bas, son = f"<!-- {isim}_BASLANGIC -->", f"<!-- {isim}_BITIS -->"
    desen = re.compile(re.escape(bas) + r".*?" + re.escape(son) + r"\n*", re.S)
    blok = f"{bas}\n{icerik}\n{son}\n\n" if icerik is not None else ""
    if desen.search(metin):
        return desen.sub(lambda _: blok, metin, count=1)
    if icerik is None:
        return metin
    i = metin.find(once_gelecek)
    if i < 0:
        sys.exit(f"README'de '{once_gelecek}' bulunamadı")
    return metin[:i] + blok + metin[i:]


def main():
    with open(README_YOLU, encoding="utf-8") as f:
        metin = f.read()
    dersler_bolumu = "<details>\n<summary><b>📖 Dersler</b></summary>"
    metin = bolum_yaz(metin, "DOLULUK", doluluk() if DOLULUK_AKTIF else None, dersler_bolumu)
    with open(README_YOLU, "w", encoding="utf-8") as f:
        f.write(metin)


if __name__ == "__main__":
    main()
