# ERP DAGING — Migration Validation Matrix (Draft)

**Status:** Draft QA gate; belum dijalankan terhadap database produksi.  
**Branch:** `plan-consolidation-draft`  
**Tujuan:** Menetapkan fixture, hasil yang wajib terjadi, kondisi gagal, dan bukti kelulusan sebelum schema lama dimigrasikan ke model Moving Average per SKU.

## 1. Aturan penggunaan

- Semua test migrasi dijalankan pada salinan snapshot anonim/representatif, bukan database aktif.
- Setiap fixture memiliki input tetap, expected result eksplisit, dan checksum sebelum/sesudah.
- Test harus deterministic: urutan event, pembulatan, largest remainder, dan tie-break ditetapkan.
- Migrasi harus idempotent: menjalankan migrasi dua kali tidak boleh menggandakan data atau saldo.
- Tidak ada auto-fix yang mengarang SKU, lot, biaya, histori reversal, atau idempotency key.
- Setiap exception harus menghasilkan laporan yang bisa ditindaklanjuti; exception kritis menghentikan cutover.
- Lulus unit test belum membuktikan kesiapan multi-device atau produksi.

## 2. Tingkat severity

| Severity | Arti | Dampak |
|---|---|---|
| BLOCKER | Berpotensi mengubah stok/nilai/histori atau menggandakan transaksi | Hentikan cutover terkait; tidak boleh di-waive tanpa keputusan tertulis dan rekonsiliasi |
| HIGH | Data tidak lengkap tetapi masih dapat diisolasi | SKU/perangkat terkait ditahan; cutover bagian lain hanya jika isolasi terbukti aman |
| MEDIUM | Ketidaksesuaian metadata/presentasi yang tidak mengubah saldo | Catat exception dan selesaikan sebelum fitur terkait aktif |
| INFO | Perbedaan yang diharapkan dan sudah diberi label | Dokumentasikan; tidak menghalangi cutover |

## 3. Validation matrix

| ID | Skenario / fixture | Expected result | Gagal jika | Severity |
|---|---|---|---|---|
| MV-001 | Produk dengan ID dan SKU unik, stok positif | ID produk tetap; master dan saldo target terhubung ke SKU yang sama | ID berubah atau relasi putus | BLOCKER |
| MV-002 | Dua produk memakai SKU sama | Duplikasi terdeteksi dan masuk exception | Sistem memilih salah satu secara diam-diam | BLOCKER |
| MV-003 | Lot memiliki `productId` valid | Lot terhubung ke SKU yang benar; ID lot tetap | Lot berpindah SKU atau ID berubah | BLOCKER |
| MV-004 | Lot hanya punya nama produk tanpa `productId` | Exception mapping; tidak otomatis menebak bila nama ambigu | Sistem menautkan ke SKU yang tidak terbukti | BLOCKER |
| MV-005 | Produk.stockGram sama dengan jumlah lot | `ownedOnHandGram` hasil migrasi sama dengan rekonsiliasi lot OWN | Saldo berbeda tanpa exception | BLOCKER |
| MV-006 | Produk.stockGram berbeda dari jumlah lot | Selisih dilaporkan per SKU dan cutover SKU ditahan | Selisih ditimpa/diabaikan | BLOCKER |
| MV-007 | Ada lot karantina yang masih dimiliki | Gram masuk owned balance, tidak masuk saleable balance; carrying value tetap dihitung | Karantina hilang dari nilai atau masuk stok jual | BLOCKER |
| MV-008 | Lot status non-OWN/consignment bila ada dalam legacy | Tidak dicampur ke saldo OWN atau nilai persediaan OWN | Barang titipan dianggap milik bisnis | BLOCKER |
| MV-009 | Dua lot satu SKU dengan HPP berbeda | Nilai awal dijumlahkan; MA dihitung dari total nilai / total Gram, bukan rata-rata HPP lot | MA berasal dari rata-rata sederhana HPP lot | BLOCKER |
| MV-010 | Nilai lot menghasilkan pecahan Rupiah | Pembulatan deterministik; jumlah hasil pembulatan sama dengan total opening value melalui largest remainder | Total Rupiah berubah karena pembulatan per baris | BLOCKER |
| MV-011 | SKU memiliki Gram nol dan nilai nol | MA tidak membagi nol; saldo nol valid | NaN/Infinity atau error runtime | BLOCKER |
| MV-012 | SKU memiliki Gram nol tetapi nilai tidak nol | Exception rekonsiliasi; tidak dipaksa menjadi nilai nol | Nilai dihapus atau HPP dibuat tak terbatas | BLOCKER |
| MV-013 | SKU punya stok negatif legacy | Masuk exception/provisional shortage; tidak menjadi stok saleable negatif | Nilai negatif dimasukkan ke saldo normal | BLOCKER |
| MV-014 | Stock ledger memiliki UUID duplikat | Duplikasi dideteksi; tidak diterapkan dua kali | Ledger ganda masuk target | BLOCKER |
| MV-015 | Ledger quantity delta per lot tidak sama dengan saldo lot | Rekonsiliasi gagal dan lot/SKU ditahan | Migrasi mengubah saldo agar terlihat cocok tanpa audit | BLOCKER |
| MV-016 | Ledger value lama berbasis HPP lot | Nilai lama dipertahankan sebagai histori legacy; opening balance target dibuat terpisah dan dapat direkonsiliasi | Nilai lama dianggap otomatis berbasis MA | BLOCKER |
| MV-017 | Penjualan COMPLETED dengan COGS legacy | Transaksi dipetakan ke POSTED; COGS historis tidak dihitung ulang | Laba historis berubah | BLOCKER |
| MV-018 | Penjualan VOIDED dengan reversal lengkap | Status reversal dipertahankan dan referensi reversal valid | Void hilang atau transaksi aktif kembali | BLOCKER |
| MV-019 | Penjualan VOIDED tanpa reversal yang dapat dibuktikan | Exception BLOCKER; tidak dibuat reversal otomatis | Sistem menebak reversal atau mengubah status diam-diam | BLOCKER |
| MV-020 | Penjualan memiliki beberapa baris SKU sama | Baris tetap terhubung; COGS target untuk transaksi baru diagregasi per SKU sebelum alokasi | COGS dihitung independen per baris hingga total berubah | BLOCKER |
| MV-021 | Lot allocation historis tersedia | Lot fisik historis tetap sama; ditandai sebagai alokasi FEFO historis | Migrasi mengganti lot historis berdasarkan FEFO hari ini | BLOCKER |
| MV-022 | COGS historis berbeda dari hitung ulang MA | COGS historis dipertahankan dan diberi `LEGACY_LOT` basis | Migrasi menimpa histori dengan angka MA baru | BLOCKER |
| MV-023 | Retur terhubung ke invoice dan item asal | Referensi dan berat retur tetap; provenance dipulihkan dari COGS asal sesuai batas | Nilai retur menjadi nol atau melebihi COGS asal | BLOCKER |
| MV-024 | Retur tidak memiliki referensi invoice/item valid | Exception; tidak menambah nilai persediaan otomatis | Sistem mengambil HPP saat ini sebagai tebakan | BLOCKER |
| MV-025 | Journal entry debit = kredit | UUID, key, referensi, dan jumlah dipertahankan | Jurnal berubah atau tidak balance | BLOCKER |
| MV-026 | Journal entry tidak balance | Exception dan cutover area keuangan terkait ditahan | Sistem menyeimbangkan otomatis tanpa jejak koreksi | BLOCKER |
| MV-027 | Audit actor role lama ADMIN | Histori tetap; role lama diberi label legacy, tidak menjadi role aktif | Aktor historis ditulis ulang menjadi Owner/Sales | HIGH |
| MV-028 | Approval request lama masih pending | Dipertahankan sebagai histori/exception; tidak otomatis mengubah hak akses baru | Approval lama otomatis memberi kewenangan baru | HIGH |
| MV-029 | Outbox PENDING | Event dan key tetap; retry setelah cutover aman terhadap dedupe | Event hilang atau diterapkan ganda | BLOCKER |
| MV-030 | Outbox SYNCED dengan serverSeq | Status dan sequence dipertahankan; tidak dikirim ulang sebagai event baru | Event synced dibuat ulang | BLOCKER |
| MV-031 | Idempotency key muncul di lebih dari satu sumber untuk event sama | Registry satu key ke satu event; duplikasi sumber direkonsiliasi | Satu key menghasilkan dua efek | BLOCKER |
| MV-032 | Event lama lebih dari 2.000 event dan key tidak ada di cache aktif | Registry/tombstone durable tetap mendeteksi replay bila bukti key tersedia | Replay lama diterima karena cache terpotong | BLOCKER |
| MV-033 | Key historis tidak ditemukan di semua sumber | Risiko replay dilaporkan; baseline registry dan prosedur cutover diperlukan | Sistem mengklaim proteksi penuh tanpa bukti | BLOCKER |
| MV-034 | Remote serverSeq berurutan | Sequence tertinggi dan event set cocok; gap terdeteksi | Gap diabaikan atau sequence mundur | BLOCKER |
| MV-035 | Remote serverSeq memiliki gap | Migrasi menandai gap dan menahan sinkronisasi yang bergantung pada urutan | Sistem melanjutkan seolah tidak ada gap | BLOCKER |
| MV-036 | Schema lama dimigrasi dua kali | Hasil kedua identik dengan hasil pertama; tidak ada saldo/event tambahan | Data atau nilai terduplikasi | BLOCKER |
| MV-037 | Migrasi terhenti di tengah proses | Restart melanjutkan dengan aman atau rollback ke snapshot valid | State campuran tidak terdeteksi | BLOCKER |
| MV-038 | Snapshot/checksum sebelum migrasi | Snapshot dapat dibaca dan checksum cocok | Tidak ada backup yang dapat dipulihkan | BLOCKER |
| MV-039 | Restore snapshot setelah migrasi gagal | Restore menghasilkan state konsisten sebelum migrasi | Restore tidak lengkap atau corrupt | BLOCKER |
| MV-040 | Provenance opening balance seluruh SKU | Total provenance awal = inventoryValueRupiah per SKU | Ada selisih tanpa exception terukur | BLOCKER |
| MV-041 | Provenance origin historis tidak diketahui | Gunakan origin migration opening balance dengan referensi snapshot; jangan mengarang supplier | Supplier/source fiktif dibuat | HIGH |
| MV-042 | Nilai origin berpindah lewat conversion Relative NRV | Total nilai provenance input = total nilai provenance output, setelah pembulatan deterministik | Nilai hilang/bertambah | BLOCKER |
| MV-043 | Provenance outbound dibagi ke beberapa transaksi | Atribusi kumulatif sama untuk satu transaksi besar maupun beberapa transaksi kecil dengan total kuantitas sama | Hasil bergantung pada pemecahan transaksi | BLOCKER |
| MV-044 | Late landed cost setelah sebagian barang terjual | Koreksi terbagi antara COGS terkonsumsi dan nilai inventory turunan tersisa sesuai provenance | Koreksi hanya dialokasikan berdasarkan Gram kasar atau hilang | BLOCKER |
| MV-045 | Cost provenance return berulang | Total nilai yang dipulihkan tidak melebihi nilai asal yang pernah dikonsumsi | Provenance over-restore | BLOCKER |
| MV-046 | Penjualan offline menyebabkan shortage sementara | Shortage tercatat terpisah; receipt menyelesaikan shortage tertua menurut serverSeq; sisa receipt baru saleable | Seluruh receipt langsung tersedia dijual sebelum settlement shortage | BLOCKER |
| MV-047 | Receipt hanya menyelesaikan sebagian shortage | Status shortage tetap partial; sisa kuantitas tercatat; saldo saleable hanya bertambah dari sisa receipt | Partial shortage ditandai selesai atau stok dihitung ganda | BLOCKER |
| MV-048 | Event duplicate dikirim dari dua perangkat | Unique idempotency backend hanya menerima satu dampak bisnis; respons konsisten | Dua perangkat menggandakan stok/penjualan/jurnal | BLOCKER |
| MV-049 | Event offline berbeda untuk SKU yang sama | Server serialize per SKU; hasil akhir mengikuti urutan server dan konflik eksplisit | Last-write-wins menghapus event salah satu perangkat | BLOCKER |
| MV-050 | Data tanggal/timestamp lama | Timestamp asli dipertahankan; zona waktu dan urutan server tidak ditebak ulang | Histori transaksi berpindah tanggal tanpa jejak | HIGH |
| MV-051 | Field optional/null/malformed | Normalisasi hanya memakai default yang sudah ditetapkan; nilai kritis malformed jadi exception | Field kritis diisi angka/default fiktif | HIGH |
| MV-052 | Lampiran media transaksi | Referensi media tetap; missing attachment terdeteksi; tidak menghapus transaksi | Bukti hilang tanpa laporan | HIGH |
| MV-053 | Perbandingan total setelah migrasi | Jumlah produk/lot/transaksi/ledger/jurnal/retur/outbox dan nilai agregat cocok atau seluruh selisih terjelaskan | Selisih agregat tidak dapat dijelaskan | BLOCKER |
| MV-054 | UI dan laporan membaca saldo target | Semua layar stok/nilai/COGS aktif membaca model kanonis; field lot HPP hanya legacy | Ada jalur aktif yang masih menghitung COGS dari HPP lot | BLOCKER |
| MV-055 | Migrasi lintas perangkat untuk satu toko | Snapshot/event dari semua perangkat digabung tanpa duplikasi; deviceId asal tetap terlacak | Event hilang, terduplikasi, atau asal perangkat hilang | BLOCKER |

## 4. Gate kelulusan

### Gate A — Aman secara struktural
Wajib lulus: MV-001 s.d. MV-016, MV-031 s.d. MV-039, MV-051 s.d. MV-053.

### Gate B — Aman secara transaksi dan keuangan
Wajib lulus: MV-017 s.d. MV-030, MV-040 s.d. MV-045.

### Gate C — Aman untuk offline dan multi-device
Wajib lulus: MV-032 s.d. MV-039 dan MV-046 s.d. MV-055, termasuk pengujian integrasi backend dengan sekurangnya dua device simulasi.

### Gate D — Siap cutover
Semua BLOCKER lulus, semua HIGH ditutup atau memiliki keputusan tertulis yang menyatakan ruang lingkup data terkait tidak ikut cutover, backup/restore teruji, dan hasil rekonsiliasi ditandatangani pihak berwenang.

**Tidak boleh menggunakan persentase kelulusan rata-rata.** Satu BLOCKER gagal berarti gate terkait gagal.

## 5. Bukti wajib per eksekusi

Simpan satu paket bukti dengan:
- ID build/commit dan schema version.
- Hash snapshot fixture input.
- Versi migration function.
- Output report per test ID (PASS/FAIL/BLOCKED/EXCEPTION).
- Rekonsiliasi jumlah record dan total Gram/Rupiah per SKU.
- Daftar event/ledger/journal yang tidak cocok.
- Checksum hasil dan snapshot rollback.
- Log tanpa PIN, token, atau data pelanggan sensitif.

## 6. Template hasil pengujian

| Field | Isi |
|---|---|
| Test run ID | Diisi saat eksekusi |
| Commit / build | Diisi saat eksekusi |
| Schema source → target | Diisi saat eksekusi |
| Fixture snapshot hash | Diisi saat eksekusi |
| Test ID | MV-xxx |
| Result | PASS / FAIL / BLOCKED / EXCEPTION |
| Expected | Salin expected result |
| Actual | Catat hasil aktual |
| Evidence | Log/report/checksum |
| Severity | BLOCKER / HIGH / MEDIUM / INFO |
| Disposition | Fix / isolate / approved exception |
| Reviewer | Diisi saat review |

## 7. Exit criteria sebelum coding migrasi produksi

1. Tim menyetujui model target dan definisi owned vs saleable stock.
2. Fixture representatif dibuat dari snapshot yang sudah dianonimkan.
3. Seluruh test matrix diimplementasikan sebagai automated test atau prosedur integrasi yang dapat diulang.
4. Migration function lulus idempotency, interruption/restart, dan restore test.
5. Perangkat dan backend lulus replay, duplicate, ordering, partial shortage, dan concurrent event tests.
6. Seluruh BLOCKER lulus; exception HIGH memiliki keputusan dan batas dampak tertulis.
7. Baru setelah itu implementasi cutover dapat dipertimbangkan.

**Status:** Matrix telah dirancang, belum dieksekusi. Tidak ada klaim test/build/migrasi lulus.
