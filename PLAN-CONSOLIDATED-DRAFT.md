# PLAN ERP DAGING
## Spesifikasi Produk dan Teknis — Draft Konsolidasi

**Nama proyek:** ERP DAGING  
**Platform aktif:** Progressive Web App (PWA)  
**Status dokumen:** Draft konsolidasi untuk audit dan persetujuan  
**Status implementasi:** Tidak ditentukan oleh dokumen ini; setiap fitur wajib diverifikasi terhadap source code dan hasil pengujian aktual.  
**Tujuan dokumen:** Menjadi spesifikasi mandiri bagi pemilik usaha, perancang, dan pengembang. Seluruh aturan aktif, definisi, batas scope, serta keputusan terbuka yang diperlukan untuk memahami produk dijelaskan di dalam dokumen ini.

> Dokumen ini adalah draft baru. Dokumen ini tidak menyatakan bahwa semua fitur telah selesai dibuat, diuji, atau siap produksi. Keputusan yang masih terbuka ditandai secara eksplisit dan tidak boleh diisi dengan asumsi oleh implementasi.

---

## Daftar Isi

1. Identitas, Tujuan, dan Prinsip Produk
2. Pengguna, Role, dan Hak Akses
3. Data Master dan Model Kepemilikan Barang
4. Harga dan Pricing Engine
5. Penjualan, Pembayaran, Pengiriman, Void, dan Retur
6. Pembelian, Penerimaan, Landed Cost, dan Utang
7. Persediaan, Lot, FEFO, Konversi, dan Stock Opname
8. Kas, Bank, Piutang, OPEX, dan Keuangan
9. Laporan dan Pajak
10. Saldo Awal dan Go-Live
11. Arsitektur PWA dan Penyimpanan Lokal
12. Backend, Sinkronisasi, dan Konflik
13. Keamanan, Backup, dan Restore
14. Audit Trail dan Integritas Data
15. Modul dan Batas Scope
16. AI, OCR, dan Voice Order
17. Standar UI/UX
18. Pengujian, Deployment, dan Kriteria Rilis
19. Glosarium dan Keputusan Terbuka

---

## 1. Identitas, Tujuan, dan Prinsip Produk

### 1.1 Tujuan
ERP DAGING adalah sistem operasional untuk bisnis distribusi dan penjualan daging skala UMKM. Sistem mendukung pembelian, penerimaan, persediaan, pengaturan harga, penjualan, pembayaran, piutang, utang, pengeluaran, pelaporan, dan pengawasan usaha.

Dokumen ini menjadi acuan utama aturan produk dan bisnis. Dokumen desain UI/UX terpisah boleh menjelaskan detail visual dan tata letak, tetapi tidak boleh mengubah aturan bisnis dalam dokumen ini.

### 1.2 Platform dan teknologi aktif
- Aplikasi aktif adalah installable Progressive Web App.
- Fondasi aplikasi: React 18, TypeScript, Vite, vite-plugin-pwa/Workbox, Tailwind CSS, dan IndexedDB.
- Nama database lokal yang digunakan saat ini: `karkasia_erp_offline_db`.
- Flutter dan APK bukan target implementasi aktif.
- Database PostgreSQL tidak boleh diakses langsung dari bundle PWA menggunakan kredensial istimewa atau secret server.

### 1.3 Prinsip operasional
1. **Local-first:** transaksi inti harus dapat dicatat secara lokal tanpa internet.
2. **Business Engine sebagai otoritas:** aturan bisnis, validasi, perhitungan, dan perubahan status harus dijalankan oleh Business Engine, bukan hanya UI.
3. **Multi-device:** target maksimal 8 perangkat aktif untuk satu operasional toko. Batas ini adalah batas perangkat, bukan batas jumlah akun per role.
4. **Skala target:** sampai 500 SKU dan target operasional sampai 200 transaksi per hari.
5. **Gudang pusat:** stok berada di gudang pusat. Tidak ada stok kendaraan sebagai gudang tersendiri.
6. **Zero-float ledger:** uang disimpan sebagai integer Rupiah dan berat sebagai integer Gram.
7. **UUID dan append-only ledger:** entitas/event memakai identitas stabil; histori tidak dihapus untuk koreksi.
8. **Offline tidak boleh menghilangkan data:** kegagalan jaringan tidak membatalkan transaksi yang sudah tersimpan lokal.
9. **Sederhana di depan, kuat di belakang:** aplikasi harus terasa seperti POS dan Stock yang mudah dipakai, sedangkan mesin ERP menjaga valuasi, kontrol, audit, dan laporan.
10. **Minim birokrasi:** aktivitas rutin berjalan tanpa approval; otorisasi Owner digunakan untuk pengecualian berisiko.
11. **Lengkap bagi Owner:** laporan dan rekonsiliasi tetap profesional meskipun workflow Sales sederhana.
12. **Tidak ada bypass:** kesederhanaan UI tidak boleh menghilangkan validasi, otorisasi, atau audit trail.
### 1.4 Satuan dan pembulatan
- Mata uang utama: Rupiah dalam integer.
- Berat utama: Gram dalam integer; 1 kg = 1.000 gram.
- Konversi tampilan ke kg boleh menggunakan desimal, tetapi nilai dasar yang disimpan dan dihitung tetap integer Gram.
- Aturan pembulatan untuk pembagian biaya, pajak, atau alokasi yang menghasilkan pecahan harus ditentukan secara deterministik dan diuji. Implementasi tidak boleh memilih aturan pembulatan secara berbeda antarfitur.

---

## 2. Pengguna, Role, dan Hak Akses

### 2.1 Role aktif
Hanya ada dua role aktif:
- **Owner:** pemilik usaha, pemegang kebijakan, dan penanggung jawab keputusan berisiko.
- **Sales:** pelaksana operasional harian, termasuk fungsi kasir, penerimaan barang, persiapan, gudang, dan penagihan.

Tidak ada role Admin, Kasir, Gudang, atau Staff terpisah. Pembagian pekerjaan antarpegawai Sales dapat dilakukan melalui penugasan/atribusi, bukan dengan menambah role sistem. Maksimal 8 perangkat adalah batas perangkat aktif, bukan batas jumlah akun.

### 2.2 Prinsip kewenangan
1. Sales dapat menyelesaikan aktivitas rutin tanpa menunggu Owner selama berada dalam kebijakan dan batas yang berlaku.
2. Aktivitas rutin menggunakan validasi otomatis dan pencatatan, bukan approval.
3. Owner mengatur kebijakan, harga, akses, dan pengecualian berisiko tinggi; Owner tidak menjadi bottleneck transaksi harian.
4. Hak akses diperiksa oleh Business Engine dan backend. Menyembunyikan tombol UI bukan kontrol keamanan.
5. PIN Owner hanya diminta untuk tindakan sensitif yang memang memerlukannya, bukan untuk membuka setiap menu.
6. Jika Owner offline, aktivitas rutin tetap berjalan. Tindakan yang memerlukan otorisasi ditahan sebagai permintaan tertunda dan tidak boleh diloloskan diam-diam.

### 2.3 Matriks hak akses

| Aktivitas | Sales | Owner | Kontrol |
|---|---|---|---|
| Membuat dan memproses penjualan | Ya | Ya | Validasi otomatis |
| Mengubah item sebelum penjualan diposting | Ya | Ya | Selama belum diserahkan/diposting |
| Mencatat pembayaran, DP, dan cicilan | Ya | Ya | Wajib referensi, nominal, metode, waktu, penerima |
| Melihat stok dan harga jual aktif | Ya | Ya | Sesuai kebutuhan operasional |
| Mengubah harga master, promo, kontrak, tempo | Tidak | Ya | Owner saja |
| Owner Price Override | Tidak | Ya | Alasan dan audit; di bawah HPP perlu konfirmasi khusus |
| Membuat draft pembelian/permintaan pembelian | Ya | Ya | Tidak otomatis menjadi komitmen ke supplier |
| Mengubah supplier master dan syarat pembelian | Tidak | Ya | Owner saja |
| Menerima barang berdasarkan PO/izin pembelian | Ya | Ya | Berat aktual, kondisi, selisih, dan bukti dicatat |
| Mencatat biaya OPEX | Ya | Ya | Dalam batas operasional yang ditetapkan Owner |
| Stock opname/penghitungan fisik | Ya | Ya | Selisih dihitung sistem |
| Adjustment stok dalam ambang normal | Ya | Ya | Alasan wajib dan audit |
| Adjustment stok di atas ambang | Ajukan | Otorisasi | Tidak boleh diposting sebelum otorisasi |
| Mencatat barang rusak/karantina | Ya | Ya | Sales boleh mengarantina langsung; write-off mengikuti ambang |
| Retur pelanggan dalam kebijakan normal | Ya | Ya | Bukti, alasan, dan status karantina |
| Retur/kompensasi di luar kebijakan atau di atas ambang | Ajukan | Otorisasi | Owner memutuskan pengecualian |
| Pembatalan sebelum penjualan diposting | Ya | Ya | Alasan; pembayaran yang sudah diterima direkonsiliasi |
| Reversal transaksi yang sudah diposting | Ajukan | Otorisasi | Tidak menghapus histori |
| Mencatat penerimaan uang dan mengajukan setoran | Ya | Ya | Sales tidak memverifikasi setoran sendiri |
| Memverifikasi penerimaan setoran | Tidak | Ya | Owner mencocokkan uang fisik/bank |
| Mengubah saldo awal dan kebijakan sistem | Tidak | Ya | Owner saja |
| Mengelola akun/perangkat, backup, dan full restore | Tidak | Ya | Owner saja |
| Melihat laporan operasional | Ya, terbatas | Ya, lengkap | Sales hanya data yang diperlukan untuk tugas |
| Melihat laporan keuangan lengkap dan audit seluruh toko | Tidak | Ya | Owner saja |

### 2.4 Aturan otorisasi dan ambang
- Owner menetapkan batas diskon Sales, batas OPEX, batas pembelian tanpa persetujuan, serta ambang tindakan stok/retur.
- Ambang harus disimpan sebagai konfigurasi berversi dan snapshot nilai yang berlaku pada saat tindakan.
- Untuk stock adjustment, selisih yang melebihi **2% dari kuantitas lot atau 5 kg per lot** (mana yang tercapai lebih dahulu) memerlukan otorisasi Owner sebelum adjustment diposting. Sales tetap boleh mencatat hasil hitung dan mengarantina barang yang diragukan.
- Retur pelanggan dalam waktu **1 × 24 jam sejak serah-terima** dan total nilai retur sampai **Rp500.000 per transaksi retur** dapat diproses Sales sesuai validasi. Retur di luar jangka waktu atau di atas ambang tersebut memerlukan pemeriksaan/otorisasi Owner. Pencatatan awal retur tidak boleh ditolak; yang ditahan adalah penyelesaian kompensasi/adjustment di luar kewenangan.
- Penjualan di bawah HPP, diskon melampaui batas Sales, penghapusan piutang/utang, write-off material, dan reversal transaksi yang sudah diposting memerlukan otorisasi Owner.
- Batas kas Sales Rp3.000.000 atau uang tertua lebih dari 48 jam adalah **soft limit** dan menghasilkan peringatan, bukan pemblokiran penjualan.
- Nilai batas yang belum ditentukan tidak boleh diisi dengan angka buatan. Sampai Owner mengatur batas diskon, OPEX, atau pembelian, sistem menggunakan kebijakan konservatif: pencatatan/draft tetap boleh dibuat, tetapi komitmen atau pengeluaran di luar batas tidak boleh diposting sebagai transaksi final.

### 2.5 PIN dan permintaan otorisasi
Permintaan otorisasi menyimpan tindakan, nilai/objek yang diminta, alasan, pengguna pemohon, waktu, perangkat, dan hasil. Otorisasi Owner hanya berlaku untuk tindakan dan snapshot yang diminta; perubahan nominal/objek setelah disetujui memerlukan otorisasi baru. PIN tidak boleh dipakai sebagai pengganti akun Owner atau dibagikan kepada Sales.

### 2.6 Akses laporan
Sales dapat melihat data yang diperlukan untuk melayani pelanggan dan menjalankan tugas, seperti harga aktif, stok tersedia, transaksi yang ditanganinya, pembayaran yang diterima, dan status setoran miliknya. Sales tidak mendapat akses otomatis ke seluruh laba bersih, saldo kas seluruh toko, penghasilan Owner, audit seluruh pengguna, atau konfigurasi sensitif. Owner dapat melihat seluruh data dan laporan.

### 2.7 Prinsip saat offline
Sales tetap dapat melakukan aktivitas rutin yang aturan dan data lokalnya tersedia. Tindakan yang memerlukan otorisasi Owner tidak boleh disetujui dengan PIN lama/cache yang tidak memiliki masa berlaku dan konteks yang jelas. Sistem menyimpan permintaan lokal sebagai pending authorization; setelah Owner mengotorisasi, event diproses secara idempoten. Jika otorisasi belum tersedia, tindakan sensitif tetap tertahan.

### 2.8 Batas perangkat dan akun
Maksimal 8 perangkat aktif adalah batas perangkat operasional. Tidak ada batas akun Sales yang diturunkan otomatis dari angka tersebut. Penambahan/pencabutan akun dan perangkat dilakukan Owner.

---

## 3. Data Master dan Model Kepemilikan Barang

### 3.1 Data master
Data inti mencakup:
- Toko dan konfigurasi operasional.
- Pengguna dan perangkat.
- Produk, SKU, kategori, barcode, satuan.
- Lot dan batch barang.
- Pelanggan dan kelompok pelanggan.
- Supplier.
- Aturan harga dan promo.
- Purchase Order dan penerimaan.
- Transaksi dan rincian transaksi.
- Pembayaran, piutang, utang, kas, dan bank.
- Stock ledger, audit trail, event sinkronisasi, dan lampiran.

### 3.2 Model kepemilikan
Setiap barang/penawaran harus memiliki model kepemilikan yang jelas.

**OWN**
- Barang fisik dimiliki bisnis.
- Memiliki persediaan dan HPP.
- Pergerakan dicatat dalam stock ledger.
- Penjualan mengurangi stok dan membentuk HPP penjualan.

**CONSIGNMENT**
- Barang fisik tersedia tetapi kepemilikannya tetap pada pihak penitip sampai terjual atau sesuai kontrak.
- Tidak diperlakukan sebagai persediaan OWN.
- Kewajiban kepada penitip terbentuk berdasarkan barang yang benar-benar terjual.
- Nilai kewajiban mengikuti kesepakatan setor per kg, per unit, atau dasar lain yang disetujui dan disimpan sebagai snapshot.

**AFFILIATE**
- Tidak memiliki persediaan fisik bisnis dan tidak membentuk stock ledger barang.
- Bisnis memperoleh pendapatan/komisi sesuai kesepakatan affiliate.
- Dasar komisi dapat berupa persentase, nominal per kg, atau nominal per pcs sesuai konfigurasi kesepakatan.
- Komisi affiliate berbeda dari komisi internal Sales.

### 3.3 Pemisahan atribut
Pelanggan adalah aset data bisnis, bukan milik pribadi Sales. Sistem membedakan:
- Penanggung jawab pelanggan.
- Sales attribution/pemilik transaksi.
- Petugas operasional.
- Petugas penerima pembayaran.

Aktivitas operasional atau penerimaan uang tidak otomatis memberikan hak komisi internal.

---

## 4. Harga dan Pricing Engine

### 4.1 Prinsip
Satu Pricing Engine memilih tepat satu sumber harga dasar untuk setiap item transaksi. Harga dari beberapa sumber tidak dijumlahkan atau ditumpuk secara otomatis.

### 4.2 Urutan prioritas harga dasar
1. **Owner Price Override:** pengecualian satu kali untuk transaksi/item tertentu, hanya Owner, wajib alasan dan audit. Tidak mengubah master price atau kesepakatan berulang.
2. **Lot Clearance Offer:** penawaran khusus lot yang eligible dan pelanggan/segmen penerimanya memenuhi syarat.
3. **Contract Price:** harga berdasarkan kontrak.
4. **Customer Deal:** harga khusus berdasarkan kesepakatan pelanggan.
5. **Volume Price:** harga berdasarkan berat aktual SKU yang sama dalam satu transaksi.
6. **Customer Tier Price:** harga berdasarkan kelompok pelanggan.
7. **Default Price:** harga standar produk.

### 4.3 Owner Price Override
- Hanya Owner yang dapat membuat override.
- Override berlaku hanya pada transaksi/item yang ditentukan.
- Wajib menyimpan alasan, aktor, waktu, nilai sebelum/sesudah, dan snapshot transaksi.
- Jika harga override di bawah HPP, Owner harus memberi konfirmasi khusus dan alasan.
- Sales tidak dapat membuat atau menyetujui override.

### 4.4 Clearance
- Owner menetapkan lot, produk, harga, kuota, periode, dan cakupan penerima.
- Lot kedaluwarsa, karantina, tidak aman, atau tidak layak jual tidak boleh mengikuti clearance.
- Clearance dapat mengesampingkan Contract Price, Customer Deal, dan Volume Price untuk pelanggan/segmen yang memang menjadi sasaran program.
- Harga clearance di bawah HPP menampilkan estimasi kerugian per kg dan total serta memerlukan konfirmasi dan alasan Owner.
- Kuota dikonsumsi berdasarkan berat aktual yang benar-benar terjual, bukan berat pesanan.
- Transaksi batal tidak mengonsumsi kuota.
- Retur valid yang diterima memulihkan kuota sebesar kuantitas yang benar-benar dikembalikan dan diterima; perubahan kuota dicatat sebagai event koreksi, bukan menghapus konsumsi sebelumnya.

### 4.5 Volume Price
- Dihitung dari berat aktual, bukan estimasi berat pesanan.
- Agregasi hanya untuk SKU/produk yang sama dalam satu transaksi.
- Berat SKU berbeda tidak boleh digabung untuk memenuhi ambang.
- Ambang dan harga ditentukan Owner.
- Harga final dan sumber aturan disimpan sebagai snapshot transaksi.

### 4.6 Payment Term Pricing
- Penyesuaian tempo terpisah dari pemilihan sumber harga dasar.
- Owner dapat mengatur tenor dan persentase.
- CASH dan TRANSFER langsung menggunakan tambahan tempo 0% kecuali kebijakan eksplisit Owner menyatakan lain.
- Penyesuaian tempo tidak boleh dikenakan dua kali jika sumber harga telah ditandai termasuk biaya/penyesuaian tempo.
- Perhitungan untuk pembayaran parsial, perubahan metode pembayaran setelah transaksi, dan urutan tempo terhadap clearance masih harus ditetapkan sebelum implementasi.

### 4.7 Snapshot dan perubahan harga
Setiap transaksi selesai menyimpan harga final, sumber harga, versi aturan, kuantitas/berat aktual, lot bila relevan, ketentuan tempo, aktor, dan otorisasi. Perubahan harga master berlaku untuk transaksi berikutnya dan tidak mengubah transaksi historis.

### 4.8 UI pengaturan harga
Owner menggunakan satu pintu menu **Atur Harga**, dengan label sederhana:
- Harga Produk.
- Harga Grosir.
- Harga Khusus.
- Harga Kontrak.
- Harga Tempo.
- Harga Flash Sale.

Perubahan massal disimpan sebagai **Belum Aktif**. Owner memeriksa ringkasan sebelum/sesudah, cakupan, waktu berlaku, dan peringatan sebelum memilih **Aktifkan Harga**. Draft yang belum aktif tidak boleh dipakai Pricing Engine.

---

## 5. Penjualan, Pembayaran, Pengiriman, Void, dan Retur

### 5.1 Prinsip transaksi
- Sales membuat transaksi dan menyimpannya lebih dahulu ke IndexedDB lokal.
- Pelanggan dapat berupa pelanggan terdaftar atau pelanggan umum.
- Pricing Engine memilih satu sumber harga dasar sesuai prioritas dan menyimpan snapshot harga/aturan.
- Berat aktual menjadi dasar kuantitas dan nilai final.
- Status penjualan, pemenuhan barang, dan pembayaran adalah tiga status berbeda; pelunasan bukan syarat agar penjualan dianggap telah diserahkan.

### 5.2 Siklus transaksi
Status transaksi, pemenuhan, dan pembayaran dipisahkan agar penyerahan barang tidak disamakan dengan pelunasan.

**Status transaksi**
- `DRAFT`: transaksi masih dapat diedit; belum mem-posting stok, pendapatan, COGS, atau piutang final.
- `POSTED`: transaksi telah diserahkan kepada pelanggan/penerima yang sah dan dampak bisnis final telah diposting satu kali.
- `CANCELLED`: draft dibatalkan sebelum posting. Histori pembatalan dan alasannya tetap tersimpan.

Transaksi `POSTED` tidak memiliki status VOIDED yang menghapus atau membatalkan histori. Kesalahan setelah posting hanya dikoreksi melalui reversal, retur, refund, atau adjustment yang merujuk transaksi asal.

**Status pemenuhan**
- `NOT_STARTED`: barang belum disiapkan.
- `PREPARING`: barang sedang diambil, ditimbang, atau dikemas.
- `READY`: barang siap diserahkan.
- `DELIVERED`: barang telah diserahkan; waktu, petugas, penerima, dan bukti dicatat sesuai kebutuhan.

**Status pembayaran**
- `UNPAID`: belum ada pembayaran valid yang diterima.
- `PARTIAL`: pembayaran valid diterima sebagian.
- `PAID`: seluruh tagihan telah dibayar dengan pembayaran valid.
- `OVERDUE`: masih ada saldo yang melewati jatuh tempo.

Status pembayaran dihitung dari tagihan dikurangi pembayaran valid dan kredit yang telah dialokasikan. Transfer berstatus `PENDING_VERIFICATION` tidak dihitung sebagai pembayaran valid sampai diverifikasi.

**Aturan posting:** pencatatan serah-terima yang sah menghasilkan event `DELIVERED` dan memicu posting transaksi satu kali. Implementasi boleh memakai satu aksi “Selesaikan Penjualan”, tetapi event serah-terima dan event posting harus dapat dibedakan, idempoten, dan tidak boleh mem-posting stok/COGS/pendapatan dua kali. `POSTED` tidak otomatis berarti `PAID`.

### 5.3 Sebelum penjualan diposting
- Sales dapat menambah/menghapus item, mengubah pelanggan, berat, metode pengiriman, dan metode pembayaran selama validasi terpenuhi.
- Harga final dihitung ulang berdasarkan aturan aktif dan berat aktual.
- Sistem dapat menandai stok untuk persiapan/reservasi lokal, tetapi reservasi tidak boleh dianggap sebagai pengurangan stok final.
- Jika pesanan tidak jadi, Sales membatalkan draft dengan alasan. Tidak ada COGS atau pendapatan final dari draft yang belum diposting.
- Uang yang diterima sebelum penyerahan dicatat sebagai **DP/customer deposit**, bukan langsung sebagai pendapatan penjualan. Ketika penjualan diposting, DP dialokasikan ke tagihan.

### 5.4 Posting penjualan dan stok
Pada saat barang diserahkan dan penjualan diposting:
- Kuantitas final dan harga final dikunci sebagai snapshot.
- Lot fisik eligible dialokasikan menggunakan FEFO.
- Stok fisik berkurang dan stock ledger mencatat event penjualan.
- COGS menggunakan Moving Average per SKU tepat sebelum posting, bukan HPP asal lot FEFO.
- Pendapatan dan kewajiban pembayaran/piutang dicatat.
- Pembayaran yang telah diterima dialokasikan ke transaksi.
- Bukti serah-terima dan petugas dicatat jika relevan.
- Transaksi yang sudah diposting tidak diedit langsung.

### 5.5 Stok minus saat offline
Penjualan saat stok lokal minus hanya boleh melalui kontrol pengecualian:
- Alasan wajib dicatat.
- Pengguna wajib mengakui tanggung jawab operasional sesuai kebijakan.
- Jika kebijakan mensyaratkan otorisasi Owner, transaksi sensitif ditahan sampai otorisasi diperoleh; tidak boleh menggunakan otorisasi palsu atau bypass offline.
- Saat sinkronisasi menemukan stok/lot negatif atau konflik urutan event, sistem membuat conflict case. Sistem tidak boleh diam-diam menghapus transaksi atau mengubah COGS historis.
- Perlakuan COGS provisional dan rekonsiliasi setelah stok masuk tetap harus mengikuti kebijakan valuasi khusus stok minus pada Bagian 7 sebelum fitur dinyatakan production-ready.

### 5.6 Pembayaran
Metode pembayaran:
- CASH.
- TRANSFER.
- TEMPO.
- Kombinasi beberapa metode.

Aturan:
- DP yang diterima sebelum penyerahan dicatat sebagai customer deposit/liabilitas, bukan pendapatan penjualan.
- DP harus ditautkan ke draft/order atau akun Customer. Jika belum ditautkan ke invoice tertentu, nominalnya disimpan sebagai saldo deposit belum dialokasikan.
- Saat penjualan diposting, deposit dialokasikan ke invoice yang dirujuk. Deposit yang belum dialokasikan tidak otomatis dipakai untuk invoice lain; Sales/Owner harus memilih invoice tujuan secara eksplisit. Tidak ada auto-FIFO lintas invoice.
- Kelebihan pembayaran tetap menjadi customer credit/deposit belum dialokasikan, bukan pendapatan tambahan.
- Pembayaran parsial setelah penjualan diposting mengurangi piutang hanya sebesar pembayaran valid yang diterima.
- Setiap pembayaran menyimpan nominal, metode, waktu, penerima, kanal kas/bank, referensi transaksi, dan bukti/referensi transfer bila tersedia.
- Transfer yang baru dilaporkan pelanggan tetapi belum diverifikasi dapat berstatus `PENDING_VERIFICATION`. Status ini tidak menambah saldo kas/bank final dan tidak mengurangi piutang final.
- Setelah transfer diverifikasi, pembayaran diposting ke kanal bank yang sesuai dan dialokasikan ke invoice/deposit yang dirujuk.
- Sisa tagihan membentuk piutang jika transaksi mengizinkan tempo.
- Pelunasan adalah status hasil perhitungan saldo, bukan tindakan yang menghapus histori pembayaran.
- Perubahan metode pembayaran setelah posting dilakukan melalui event pembayaran/koreksi baru, bukan mengedit snapshot pembayaran lama.
- Refund, customer credit, dan deposit belum terpakai adalah tiga posisi berbeda; refund hanya mengurangi kas/bank saat benar-benar dibayarkan.

### 5.7 Piutang dan batas kredit
- Batas kredit pelanggan bersifat peringatan, bukan pemblokiran otomatis.
- Melebihi plafon tidak otomatis membatalkan checkout atau meminta Owner menyetujui setiap transaksi.
- Owner/Sales melihat saldo dan umur piutang sesuai hak akses.
- Jadwal pengingat jatuh tempo: H-1, H, H+1, H+3, dan H+7. Pengingat tidak berarti pengiriman WhatsApp otomatis.

### 5.8 Void, reversal, dan koreksi
- Draft sebelum posting dapat dibatalkan oleh Sales dengan alasan; pembatalan tidak menghapus histori.
- Penjualan yang sudah `POSTED` tidak boleh di-void dengan menghapus data. Kesalahan setelah posting dikoreksi melalui reversal/adjustment yang merujuk transaksi asal dan memerlukan otorisasi Owner.
- Reversal harus membalik dampak yang relevan pada stok, COGS, pendapatan, pembayaran, piutang, kas/bank, dan ledger secara eksplisit.
- Jika uang sudah diterima, pembatalan tidak otomatis menghilangkan kewajiban refund. Refund dicatat sebagai transaksi pembayaran keluar atau saldo kredit pelanggan sesuai keputusan yang tercatat.
- Koreksi tidak boleh mengubah snapshot transaksi asal.

### 5.9 Retur pelanggan
- Retur berbeda dari pembatalan/void karena barang telah diserahkan.
- Batas standar pengajuan retur adalah **1 × 24 jam sejak serah-terima**, dengan bukti foto dan alasan.
- Sales dapat mencatat retur dalam kebijakan normal sampai **Rp500.000 per transaksi retur**. Nilai di atas batas atau pengajuan di luar 1 × 24 jam tetap dicatat sebagai permintaan, tetapi penyelesaian kompensasi memerlukan Owner.
- Barang yang kembali selalu masuk karantina terlebih dahulu. Barang tidak langsung menambah stok tersedia dijual.
- Jika barang dinyatakan layak jual, nilai persediaan dipulihkan menggunakan COGS historis transaksi asal, bukan Moving Average terbaru. Jika tidak layak, dicatat sebagai rusak/write-off sesuai kewenangan.
- Retur mengurangi piutang atau membentuk kewajiban refund/customer credit sesuai kondisi pembayaran. Refund tunai/transfer harus memiliki event pembayaran keluar dan penerima.
- Retur parsial hanya mengoreksi item/kuantitas yang benar-benar dikembalikan. Riwayat transaksi asal tetap utuh.
- Kuota Flash Sale dipulihkan hanya sebesar kuantitas yang diretur dan diterima sebagai retur valid; pembatalan sebelum posting tidak mengonsumsi kuota.

### 5.10 Pengiriman dan serah-terima
- Status pemenuhan dan status pembayaran tidak boleh digabung.
- Serah-terima mencatat waktu, petugas, penerima, dan bukti jika diwajibkan oleh metode pengiriman.
- Penjualan COD tetap menjadi penjualan saat barang diserahkan; uang yang belum diterima menjadi piutang/collection due sampai pembayaran dicatat.
- Pengiriman gagal sebelum serah-terima tidak mem-posting penjualan; draft dapat dijadwalkan ulang atau dibatalkan.

### 5.11 Snapshot dan histori
Setiap penjualan yang diposting menyimpan item, berat aktual, harga, sumber harga, diskon, pajak jika aktif, HPP Moving Average, COGS, lot fisik, Sales attribution, petugas, serah-terima, pembayaran, dan otorisasi. Perubahan master setelah posting tidak mengubah histori.

---

## 6. Pembelian, Penerimaan, Landed Cost, dan Utang

### 6.1 Pembelian
Siklus pembelian menggunakan alur sederhana:
1. Sales membuat draft permintaan pembelian berisi supplier, SKU, estimasi jumlah/berat, kebutuhan waktu, dan alasan.
2. Owner meninjau dan mengonfirmasi PO jika pembelian berada di luar batas kewenangan Sales, supplier baru, harga/syarat berubah material, atau komitmen pembayaran berisiko.
3. Sales boleh menerbitkan/mengonfirmasi PO sendiri hanya jika supplier, item, dan total komitmen masih dalam batas pembelian yang telah dikonfigurasi Owner.
4. PO yang sudah disetujui menyimpan snapshot supplier, harga, jumlah, syarat pembayaran, dan batas penerimaan.
5. Pembatalan/perubahan PO setelah dikonfirmasi harus tercatat; perubahan harga, kuantitas, atau syarat yang melewati toleransi memerlukan konfirmasi ulang.

Status PO minimal: DRAFT, APPROVED, PARTIALLY_RECEIVED, RECEIVED, dan CANCELLED. Draft tidak membentuk utang atau komitmen final ke supplier. Penerimaan aktual dan invoice supplier dicatat sebagai event terpisah agar selisih dapat ditelusuri.

### 6.2 Penerimaan barang
- Sales dapat menerima barang berdasarkan PO yang valid atau izin pembelian yang masih berlaku.
- Penerimaan berdasarkan kondisi fisik aktual dan dapat dilakukan parsial.
- Berat aktual dapat berbeda dari PO; sistem mencatat jumlah dipesan, diterima, ditolak, dan selisih.
- Penerimaan membentuk lot/batch sesuai identitas penerimaan dan kebijakan lot.
- Barang yang belum memenuhi pemeriksaan, rusak, suhu/kondisi meragukan, atau tidak sesuai pesanan dapat langsung ditempatkan Sales dalam karantina. Karantina tidak memerlukan approval karena mencegah barang tidak layak masuk stok jual.
- Selisih harga, jumlah, atau kualitas yang material ditandai untuk Owner; barang yang diterima secara fisik tetap tercatat agar stok dan kewajiban tidak hilang.
- **Barang diterima tetapi invoice belum ada (GRNI):** jika PO memiliki harga yang telah disetujui, penerimaan membentuk nilai persediaan sementara dan kewajiban sementara kepada supplier berdasarkan kuantitas aktual diterima × harga PO. Posisi ini diberi status Goods Received Not Invoiced (GRNI), bukan utang invoice final. Saat invoice diterima, sistem mencocokkan PO, penerimaan, dan invoice; selisih harga/biaya yang material memerlukan persetujuan Owner dan dicatat sebagai koreksi bernilai, bukan mengubah penerimaan asal.
- Jika tidak ada harga PO/izin pembelian yang disetujui, barang tetap dicatat secara fisik dengan status `PENDING_COST`. Barang tidak boleh menambah stok OWN tersedia untuk dijual atau nilai persediaan final sampai Owner menetapkan dasar biaya yang dapat diaudit.
- Invoice/tagihan supplier membentuk utang final setelah diverifikasi terhadap PO dan penerimaan. Pembayaran supplier mengurangi utang sesuai invoice yang dibayar.
- Retur pembelian ke supplier dicatat sebagai transaksi terpisah yang merujuk penerimaan/lot asal; stok, nilai persediaan, GRNI/utang, dan ledger dikoreksi melalui event yang dapat ditelusuri.

### 6.3 Landed Cost
Biaya perolehan tambahan dapat mencakup freight, bea masuk, handling cold storage, dan biaya lain yang memenuhi definisi biaya perolehan.

- Biaya pembelian yang memenuhi definisi biaya perolehan dikapitalisasi ke nilai persediaan, bukan langsung dibebankan sebagai OPEX.
- Nilai landed cost yang sudah dialokasikan ke penerimaan menambah nilai persediaan SKU dan ikut membentuk HPP Moving Average.
- HPP asal lot tetap mencatat biaya yang dapat ditelusuri ke batch tersebut. Nilai ini merupakan informasi biaya asal, bukan formula COGS keuangan.
- Biaya tambahan yang baru diketahui setelah barang diterima harus ditautkan ke penerimaan/lot asal dan menyesuaikan nilai persediaan yang masih tersisa serta COGS yang sudah terjual secara proporsional. Mekanisme koreksi historis wajib berupa event penyesuaian yang dapat diaudit, bukan mengubah transaksi lama secara diam-diam.
- Biaya yang telah dikapitalisasi tidak boleh dibebankan lagi sebagai OPEX.

**Keputusan terbuka:** formula alokasi landed cost ke produk/lot (misalnya berdasarkan berat, nilai, volume, atau kombinasi), perlakuan biaya yang datang terlambat, serta aturan pembulatan belum ditetapkan secara final.

### 6.4 Mata uang dan kurs
Jika pembelian menggunakan mata uang asing, nilai transaksi dan kurs harus dicatat. Penggunaan kurs manual hanya boleh dilakukan sesuai kebijakan yang disetujui Owner. Sistem harus menyimpan kurs yang digunakan sebagai snapshot.

### 6.5 Tagihan dan pembayaran supplier
- Supplier invoice membentuk utang.
- Status utang minimal membedakan belum lunas, cicilan, dan lunas.
- Pembayaran dapat parsial atau penuh.
- Setiap pembayaran menyimpan metode, nominal, tanggal, kanal kas/bank, dan referensi tagihan.
- Saldo utang harus dapat direkonsiliasi.

---

## 7. Persediaan, Lot, FEFO, Konversi, dan Stock Opname

### 7.1 Lot dan stok
Lot menyimpan identitas penerimaan, produk, berat/jumlah awal, sisa, tanggal terkait, status kelayakan, nilai biaya asal, dan referensi dokumen sumber.

Di tingkat SKU, sistem juga wajib menyimpan kuantitas persediaan OWN yang dinilai (gram) dan total nilai tercatat persediaan (Rupiah) sebagai dasar Moving Average. Total nilai tercatat harus menjadi sumber perhitungan yang konsisten dan dapat direkonsiliasi ke stock ledger serta nilai lot. Jangan menghitung ulang nilai persediaan hanya dari HPP rata-rata yang sudah dibulatkan berulang kali karena dapat menimbulkan akumulasi selisih pembulatan.

HPP Moving Average SKU adalah total nilai tercatat persediaan SKU dibagi total gram persediaan SKU, dikonversi ke Rupiah/kg dan dibulatkan sesuai aturan deterministik. Lot tetap menyimpan biaya asal masing-masing batch untuk traceability; nilai lot tidak boleh dijumlahkan lagi di luar total nilai tercatat SKU.

### 7.2 FEFO
Pengeluaran stok otomatis memprioritaskan lot eligible dengan tanggal kedaluwarsa paling dekat. Lot karantina, kedaluwarsa, atau tidak layak tidak dapat dialokasikan untuk penjualan normal maupun clearance.

### 7.3 Konversi dan yield
Pemotongan/primal conversion dapat mengeluarkan stok bahan asal dan membentuk stok produk turunan. Contoh: daging asal menjadi tetelan atau daging cincang.

Setiap proses harus mencatat:
- Lot asal dan kuantitas yang digunakan.
- Produk/lot hasil.
- Berat hasil.
- Limbah atau cutting loss.
- Pelaku, waktu, dan alasan.
- Nilai biaya persediaan yang dipindahkan dari SKU bahan asal ke hasil konversi.
- Metode alokasi biaya/HPP dan dasar pembagiannya.

Biaya konversi tidak boleh menciptakan atau menghilangkan nilai persediaan tanpa pencatatan. Untuk persediaan OWN, nilai tercatat bahan asal yang diproses dialokasikan ke seluruh output yang layak dijual menggunakan metode **Relative Net Realizable Value (Relative NRV / nilai jual bersih relatif)**.

Aturan alokasi wajib:
1. **Output yang dapat dijual:** setiap SKU hasil yang memang dapat dijual sebagai produk atau produk samping, termasuk tetelan yang dijual rutin, menerima alokasi biaya berdasarkan proporsi NRV terhadap total NRV seluruh output yang dapat dijual.
2. **Dasar NRV:** NRV setiap output dihitung dari kuantitas hasil dikalikan estimasi harga jual normal per satuan, dikurangi estimasi biaya penyelesaian dan biaya penjualan yang relevan. Harga, kuantitas, dan komponen biaya yang dipakai harus disimpan sebagai snapshot pada saat konversi.
3. **Rumus alokasi:** biaya bahan yang dialokasikan ke suatu output = total nilai tercatat bahan asal yang diproses × NRV output tersebut ÷ total NRV seluruh output yang dapat dijual.
4. **Limbah tidak bernilai jual:** bagian yang tidak dapat dijual dan tidak memiliki NRV positif tidak membentuk SKU persediaan atau nilai persediaan. Biaya bahan tetap dialokasikan ke output yang dapat dijual; biaya pembuangan atau penanganan limbah, jika ada dan memenuhi kriteria biaya terkait, dicatat terpisah sesuai kebijakan biaya yang berlaku.
5. **Output sampingan yang dapat dijual:** tulang, lemak, tetelan, atau hasil sampingan lain tidak otomatis dianggap limbah. Jika hasil tersebut memang dijual dan dikelola sebagai produk, hasilnya dicatat sebagai SKU output dan ikut menerima alokasi Relative NRV.
6. **NRV tidak valid:** jika tidak ada output yang memiliki total NRV positif, konversi tidak boleh diposting sebagai transaksi normal. Proses harus ditahan untuk pemeriksaan dan keputusan Owner; sistem tidak boleh membuat HPP nol atau memakai nilai fallback tetap.
7. **Rekonsiliasi nilai:** total alokasi biaya ke seluruh output yang dapat dijual wajib sama persis dengan nilai tercatat bahan asal yang diproses. Selisih pembulatan Rupiah diberikan secara deterministik kepada baris output yang ditentukan oleh aturan pembulatan bersama, sehingga tidak ada nilai yang hilang atau tercipta.
8. **Rekonsiliasi berat:** berat input harus dapat direkonsiliasi terhadap total berat output yang dapat dijual, berat limbah/cutting loss, dan selisih proses yang dicatat dengan alasan. Selisih berat tidak boleh disamarkan sebagai biaya atau stok.
9. **Moving Average output:** nilai alokasi dan berat output yang diterima menambah nilai tercatat serta kuantitas SKU hasil, kemudian Moving Average SKU hasil dihitung ulang. Lot hasil tetap menyimpan referensi proses konversi dan rincian asalnya untuk traceability.
10. **Tidak ada konstanta tersembunyi:** sistem dilarang memakai HPP tetap per kg atau fallback seperti angka default tetelan. Perubahan estimasi harga jual dan biaya tidak mengubah konversi historis yang sudah diposting; koreksi dilakukan melalui event penyesuaian yang dapat diaudit.

Biaya tenaga kerja atau biaya proses tambahan, bila kelak akan dikapitalisasi ke hasil konversi, harus memiliki kebijakan terpisah yang disetujui dan tidak boleh otomatis ditambahkan tanpa definisi serta dasar alokasi yang terdokumentasi.

### 7.4 Susut dan stock opname
- Sales dapat memulai dan melakukan penghitungan fisik stok kapan pun tanpa approval Owner.
- Hasil hitung fisik disimpan sebagai draft opname; sistem membandingkan jumlah fisik dengan stok buku per SKU/lot dan menampilkan selisih.
- Ambang otorisasi dihitung per lot menggunakan kuantitas buku sebelum opname sebagai pembagi persentase: `persentase selisih = |kuantitas fisik − kuantitas buku| ÷ kuantitas buku × 100%`.
- Jika selisih melebihi **2% dari kuantitas buku lot ATAU 5 kg (5.000 gram) per lot**, mana pun yang tercapai lebih dahulu, adjustment memerlukan otorisasi Owner sebelum diposting.
- Jika kuantitas buku lot nol, persentase tidak dihitung; penambahan stok lebih dari 5 kg memerlukan otorisasi Owner. Penambahan sampai 5 kg tetap wajib memiliki alasan dan bukti/referensi sumber yang wajar.
- Sales tetap dapat mencatat hasil hitung dan mengarantina barang rusak/meragukan meskipun adjustment menunggu Owner.
- Susut seperti drip loss atau thawing dicatat sebagai adjustment dengan alasan khusus; tidak boleh dipakai sebagai alasan generik untuk menutup selisih yang tidak diketahui.
- Penambahan stok hasil temuan fisik tidak otomatis menambah nilai persediaan tanpa dasar biaya.
- Penyesuaian nilai persediaan memakai Moving Average yang berlaku pada saat adjustment; perubahan kuantitas/nilai dicatat dalam stock ledger.
- Penyesuaian tidak menghapus pergerakan sebelumnya. Riwayat hitung, selisih, keputusan Owner, dan event adjustment tetap tersimpan.

### 7.5 Karantina
- Sales dapat langsung memindahkan barang retur, rusak, diragukan kualitasnya, atau tidak memenuhi syarat jual ke status karantina.
- Barang karantina tidak dapat dipilih FEFO, dijual normal, atau dimasukkan Flash Sale.
- Pemeriksaan dan keputusan akhir dicatat: RELEASE_TO_STOCK (layak jual kembali), RETURN_TO_SUPPLIER, atau WRITE_OFF.
- Sales dapat melakukan pemeriksaan rutin dan melepaskan barang jika sesuai checklist/kebijakan yang ditetapkan Owner. Barang rusak permanen atau write-off di atas ambang memerlukan otorisasi Owner.
- Setiap perubahan status menyimpan lot, kuantitas, alasan, petugas, waktu, bukti, dan keputusan.
- Karantina adalah kontrol keselamatan stok, bukan pengurangan stok permanen. Write-off baru mengurangi kuantitas/nilai tercatat melalui adjustment yang sah.

### 7.6 Metode HPP — Moving Average
**Metode HPP keuangan ERP DAGING ditetapkan menggunakan Moving Average per SKU untuk persediaan OWN.** Metode ini menjadi dasar nilai persediaan, COGS penjualan, Gross Profit, dan laporan keuangan. HPP asal lot tetap disimpan sebagai informasi biaya batch dan traceability, bukan sebagai metode COGS paralel.

Aturan wajib:
1. **Penerimaan pembelian:** nilai persediaan SKU bertambah sebesar biaya perolehan yang dikapitalisasi. HPP Moving Average dihitung ulang dari total nilai tercatat dan total gram setelah penerimaan.
2. **Landed Cost:** biaya yang memenuhi definisi biaya perolehan menambah nilai persediaan dan memengaruhi Moving Average. Alokasi dan pembulatan harus mengikuti satu kebijakan yang konsisten.
3. **Penjualan:** COGS memakai Moving Average SKU tepat sebelum transaksi diposting. FEFO hanya menentukan lot fisik yang keluar. Snapshot HPP dan COGS disimpan pada transaksi.
4. **Retur penjualan:** barang yang diterima kembali dan dinyatakan layak menambah persediaan berdasarkan nilai COGS historis transaksi asal, bukan HPP rata-rata terbaru. Referensi transaksi asal wajib disimpan. Barang karantina belum menambah stok yang tersedia dijual.
5. **Konversi:** nilai tercatat bahan OWN yang diproses dialokasikan ke seluruh output yang dapat dijual menggunakan Relative NRV. Snapshot kuantitas, estimasi harga jual normal, biaya penyelesaian/penjualan relevan, NRV, dan hasil alokasi wajib disimpan. Output sampingan yang dijual rutin (misalnya tetelan) ikut menerima alokasi; limbah yang tidak bernilai jual tidak membentuk persediaan dan biayanya terserap ke output yang dapat dijual. Jika total NRV tidak positif, proses ditahan untuk pemeriksaan Owner. Total nilai alokasi wajib sama persis dengan nilai input setelah pembulatan deterministik. HPP Moving Average SKU hasil dihitung ulang setelah kuantitas dan nilai masuk.
6. **Stock adjustment dan susut:** penambahan/pengurangan nilai persediaan memakai HPP Moving Average yang berlaku pada saat adjustment, dengan alasan, referensi, dan audit trail.
7. **Stok nol:** ketika kuantitas dan nilai tercatat SKU menjadi nol, saldo nilai persediaan harus nol. Penerimaan berikutnya membentuk rata-rata baru dari nilai dan kuantitas penerimaan tersebut.
8. **Stok minus/offline:** transaksi minus tidak boleh membuat nilai persediaan atau Moving Average berubah secara diam-diam. COGS provisional, penggunaan HPP terakhir, dan mekanisme revaluasi setelah konflik stok diselesaikan harus ditetapkan dan diuji sebelum fitur stok minus dianggap siap produksi.
9. **Konsistensi lintas perangkat:** event yang memengaruhi kuantitas dan nilai persediaan harus diproses dalam urutan yang deterministik. Konflik tidak boleh menghasilkan Moving Average berbeda antarperangkat tanpa rekonsiliasi.

Rumus konseptual:

Moving Average (Rp/kg) = total nilai tercatat persediaan SKU (Rp) × 1.000 / total kuantitas persediaan SKU (gram)

COGS penjualan (Rp) = berat terjual (gram) × Moving Average sebelum transaksi (Rp/kg) / 1.000

Seluruh nilai uang disimpan sebagai integer Rupiah dan berat sebagai integer Gram. Sistem wajib mempertahankan total nilai tercatat sebagai sumber perhitungan agar pembulatan HPP per kg tidak terakumulasi berulang kali.

Metode Moving Average ini berlaku untuk persediaan OWN. CONSIGNMENT mengikuti kewajiban setor sesuai perjanjian dan AFFILIATE mengikuti skema komisi; keduanya tidak boleh dipaksakan masuk ke nilai persediaan OWN.

---

## 8. Kas, Bank, Piutang, OPEX, dan Keuangan

### 8.1 Kas dan bank
Sistem membedakan kas fisik, rekening bank, customer deposit yang belum dialokasikan, saldo piutang, dan kewajiban sementara GRNI. Customer deposit adalah kewajiban kepada pelanggan sampai dialokasikan ke penjualan atau dikembalikan; bukan revenue. GRNI adalah kewajiban atas barang yang sudah diterima tetapi invoice supplier belum diverifikasi. Setiap penerimaan, pengeluaran, dan transfer antar-kanal menyimpan tanggal, nominal, metode, pelaku, dan referensi. Transfer antar-kanal bukan pendapatan atau biaya baru.

### 8.2 Penerimaan uang Sales dan setoran
- Sales mencatat uang yang benar-benar diterima dari pelanggan, terhubung ke transaksi/piutang, nominal, metode, waktu, kanal, dan bukti bila tersedia.
- Penerimaan CASH menambah kas yang dipegang Sales atau kas toko sesuai kanal yang dipilih. TRANSFER masuk ke rekening tujuan dan tidak boleh dihitung sebagai uang tunai yang harus disetor Sales.
- Sales dapat membuat catatan setoran untuk uang yang diserahkan kepada Owner/bank, termasuk nominal, kanal, waktu, dan referensi penerimaan asal.
- Status setoran: `DRAFT` (belum diajukan), `SUBMITTED` (Sales menyatakan telah menyerahkan), `RECEIVED` (Owner memverifikasi uang/bukti benar-benar diterima), `RECONCILED` (seluruh penerimaan asal telah dicocokkan), atau `DISPUTED` (ada selisih yang perlu diselesaikan).
- Sales tidak boleh memverifikasi setoran yang dia ajukan sendiri. Owner menjadi pihak verifikasi karena hanya ada dua role aktif.
- Owner dapat memverifikasi beberapa setoran sekaligus melalui ringkasan, bukan harus membuka satu per satu.
- Saldo kas yang masih dipegang Sales dihitung dari penerimaan tunai yang valid dikurangi setoran berstatus RECEIVED dan pengeluaran yang diizinkan serta tercatat.
- Soft limit: kas Sales di atas **Rp3.000.000** atau uang tertua lebih dari **48 jam** memunculkan peringatan. Ini tidak memblokir penjualan.
- Jika Owner belum tersedia, setoran tetap SUBMITTED dan ditampilkan sebagai belum diverifikasi. Sales tetap dapat bekerja; sistem tidak menganggap setoran sudah diterima sampai Owner memverifikasi.
- Selisih setoran dicatat sebagai DISPUTED dengan nilai hitung, nilai diterima, alasan, bukti, dan tindak lanjut. Jangan mengubah nominal penerimaan asal agar cocok dengan setoran.

### 8.3 Piutang pelanggan
Piutang terbentuk dari penjualan yang diposting dan belum dibayar penuh. Sistem mendukung pembayaran sebagian, pelunasan, umur piutang, riwayat pembayaran, jatuh tempo, dan pengingat. Pembayaran yang belum terverifikasi tidak mengurangi saldo piutang final.

### 8.4 Utang supplier dan pembayaran
Utang supplier berasal dari tagihan pembelian yang valid. Sistem mendukung pembayaran sebagian, pelunasan, umur utang, dan rekonsiliasi per supplier. Sales dapat menyiapkan draft pembayaran dan bukti; pembayaran di luar batas kebijakan atau perubahan/pelepasan utang memerlukan Owner.

### 8.5 OPEX
- Sales dapat mencatat draft pengeluaran operasional dengan kategori, nominal, tanggal, metode pembayaran, penerima, keterangan, dan bukti jika tersedia.
- Pengeluaran dalam batas nominal/kategori yang ditetapkan Owner dapat diposting Sales. Pengeluaran di luar batas memerlukan otorisasi Owner sebelum uang dikeluarkan atau transaksi dianggap final.
- Jika bukti nota tidak tersedia, alasan wajib dicatat. Sistem tidak boleh mengarang bukti.
- OPEX yang sudah diposting tidak dihapus; koreksi memakai reversal/adjustment.
- Biaya perolehan yang telah dikapitalisasi ke persediaan tidak boleh dibebankan lagi sebagai OPEX.

### 8.6 Konsinyasi dan affiliate
- Kewajiban konsinyasi dihitung berdasarkan barang titipan yang benar-benar terjual dan dasar setor sesuai perjanjian.
- Pembayaran/setoran ke penitip dicatat terhadap kewajiban yang terbentuk, dengan referensi penjualan dan supplier/penitip.
- Affiliate dicatat sebagai pendapatan/komisi sesuai perjanjian.
- Keduanya tidak boleh dicampur dengan stok OWN atau komisi internal Sales.

### 8.7 Rekonsiliasi dan kontrol keuangan
- Saldo kas/bank harus dapat ditelusuri ke penerimaan dan pengeluaran.
- Penerimaan pelanggan, DP, setoran Sales, pembayaran supplier, refund, dan transfer antar-kanal adalah jenis event berbeda.
- Sistem menampilkan transaksi belum diverifikasi, setoran tertunda, transfer belum cocok, dan selisih rekonsiliasi.
- Sales melihat penerimaan dan setoran yang menjadi tanggung jawabnya; Owner melihat seluruh kas, bank, piutang, utang, dan rekonsiliasi toko.

### 8.8 Komisi internal Sales dan bonus
Komisi internal Sales dan bonus tetap **di luar scope implementasi aktif v1**. Bagian ini menyimpan arah desain untuk versi berikutnya dan tidak boleh dianggap sebagai fitur yang harus aktif pada rilis v1. Komisi internal Sales berbeda dari komisi AFFILIATE.

Arah desain komisi yang telah disepakati:
- Dasar komisi adalah total laba kotor per transaksi, bukan menghitung komisi tiap item secara terpisah. Laba dan rugi seluruh item dalam satu transaksi digabung terlebih dahulu; item rugi mengurangi laba item lain.
- Komisi dihitung dari laba kotor total transaksi yang positif dikalikan tarif yang ditetapkan Owner. Jika laba kotor total nol atau negatif, komisi transaksi tersebut nol. Kerugian tidak dibawa untuk mengurangi transaksi lain.
- Dasar laba kotor untuk komisi adalah COGS historis transaksi yang dihitung menggunakan Moving Average SKU saat penjualan diposting.
- Satu transaksi memiliki satu Sales utama sebagai pemilik atribusi dengan default split 100%. Jika beberapa Sales berkolaborasi, Owner dapat menetapkan pembagian sebelum transaksi selesai; total persentase wajib tepat 100%.
- Sales attribution berbeda dari penanggung jawab pelanggan, petugas operasional, dan petugas penerima pembayaran. Aktivitas tersebut tidak otomatis memberikan hak komisi.
- Status komisi: EARNED setelah penjualan valid dan barang diserahkan; PAYABLE secara proporsional dengan pembayaran pelanggan yang benar-benar diterima; PAID setelah Owner membayar dan mencatat pembayaran.
- Pembatalan sebelum penyerahan tidak menghasilkan komisi. Retur/koreksi mengoreksi komisi melalui event yang dapat ditelusuri; tidak ada penalti atau chargeback otomatis kepada Sales.
- Bonus adalah apresiasi diskresioner Owner, terpisah dari komisi reguler, dan dicatat dengan penerima, nominal, alasan/kriteria, periode, pemberi, tanggal, dan status pembayaran.

Tarif komisi, persentase, target, dan nominal bonus belum ditetapkan. Tidak ada implementasi komisi/bonus aktif v1 sebelum scope ditinjau ulang dan Owner menyetujui keputusan final.

---

## 9. Laporan dan Pajak

### 9.1 Prinsip laporan
Laporan harus profesional, konsisten, dan dapat ditelusuri sampai transaksi sumber. UI operasional Sales sederhana; kelengkapan laporan Owner tidak boleh dikurangi. Angka laporan harus membedakan data lokal, data yang sudah di-ACK backend, dan data yang belum lengkap akibat sinkronisasi/rekonsiliasi.

### 9.2 Dashboard dan laporan minimum

**Dashboard Owner** menampilkan ringkasan yang membantu mengambil keputusan:
- Revenue, Gross Profit, Net Profit (sesuai periode dan status data).
- Penjualan hari ini, tren, berat terjual, dan performa produk.
- Stok tersedia, nilai persediaan, stok menua/near-expiry, karantina, dan stok minimum.
- Piutang jatuh tempo/menunggak dan utang supplier.
- Saldo kas/bank, kas Sales yang belum disetor, setoran menunggu verifikasi, dan OPEX.
- Retur, void, stock adjustment, kerugian/susut, serta transaksi di luar batas.
- Status sync, event pending/failed, konflik, backup, dan kesehatan data.

**Dashboard Sales** hanya menampilkan informasi untuk bekerja:
- Penjualan dan target operasional jika Owner mengaktifkannya.
- Harga aktif, stok tersedia, dan status persiapan/pengiriman.
- Piutang pelanggan yang ditangani dan pembayaran yang perlu ditindaklanjuti sesuai akses.
- Kas penerimaan miliknya, setoran yang belum diverifikasi, dan tugas operasional.
Sales tidak melihat laporan laba bersih seluruh toko, saldo keuangan sensitif, atau audit pengguna lain.

**Laporan minimum Owner:**
- Penjualan harian, mingguan, dan bulanan.
- Penjualan per produk, pelanggan, dan Sales.
- Berat/kuantitas terjual.
- Revenue, Gross Profit, margin, dan Net Profit.
- HPP/COGS, Moving Average, dan pergerakan lot.
- Persediaan, umur stok, karantina, dan susut.
- Pembelian dan landed cost.
- Piutang dan umur piutang.
- Utang supplier dan umur utang.
- Kas, bank, dan Cash Flow.
- OPEX.
- Retur, void, reversal, dan koreksi.
- Kewajiban konsinyasi dan pendapatan/komisi affiliate.
- Setoran Sales dan rekonsiliasi.
- Audit dan konflik data.

Laporan yang sama dapat diekspor sesuai hak akses. Sales hanya dapat mengekspor data operasional yang memang boleh dilihatnya.

### 9.3 Laba rugi
- **OWN:** Revenue penjualan bersih dikurangi COGS berdasarkan Moving Average menghasilkan Gross Profit. Net Profit memperhitungkan OPEX dan komponen lain yang telah didefinisikan.
- **CONSIGNMENT:** sistem menampilkan nilai penjualan kepada pelanggan, kewajiban/setoran kepada penitip, dan selisih usaha secara terpisah. Apakah penyajian akuntansi final memakai pendekatan gross (principal) atau net (agent) bergantung pada substansi perjanjian dan penilaian akuntansi; dokumen ini tidak mengarang klasifikasi tersebut. Sampai diverifikasi, laporan operasional harus memisahkan omzet pelanggan dan kewajiban penitip, serta tidak mencampur barang titipan ke nilai persediaan OWN.
- **AFFILIATE:** pendapatan bisnis hanya komisi yang menjadi hak ERP DAGING sesuai perjanjian. Nilai penjualan produk milik partner tidak boleh otomatis dicatat sebagai Revenue ERP DAGING.
- Gross Profit dan Net Profit konsolidasi harus menandai komponen yang belum memiliki perlakuan akuntansi final. Owner tidak boleh menerima angka gabungan yang seolah final jika klasifikasi principal/agent, pajak, atau biaya terkait belum diverifikasi.
- Laporan operasional dapat tetap menampilkan penjualan dan settlement per model kepemilikan secara terpisah untuk membantu rekonsiliasi.

### 9.4 Pajak
- Pajak dapat dikonfigurasi sesuai kebijakan usaha dan ketentuan yang berlaku.
- Tarif dan perlakuan pajak tidak boleh ditanam permanen tanpa keputusan yang sah.
- Sistem membedakan data transaksi, hasil kalkulasi, dan nilai yang diverifikasi.
- Integrasi resmi perpajakan/e-Faktur berada di luar scope aktif.
- Laporan pajak ERP bukan pengganti verifikasi kewajiban oleh pihak berwenang atau konsultan pajak.

### 9.5 Kondisi data laporan
Jika data belum tersinkron atau sebagian sumber belum tersedia, laporan harus menampilkan status/penanda kelengkapan. Sistem tidak boleh menyajikan data parsial seolah-olah merupakan angka konsolidasi final.

---

## 10. Saldo Awal dan Go-Live

### 10.1 Tujuan
Saldo awal merekam posisi usaha sebelum ERP DAGING mulai digunakan. Saldo awal harus dibedakan dari transaksi operasional setelah Go-Live.

### 10.2 Data pembukaan
Data yang perlu didukung:
- Produk dan master terkait.
- Stok awal per produk dan lot bila tersedia.
- Berat/jumlah awal.
- Tanggal penerimaan dan tanggal kedaluwarsa bila diketahui.
- Nilai persediaan dan HPP awal.
- Saldo kas.
- Saldo rekening bank.
- Piutang per pelanggan.
- Utang per supplier.
- Kewajiban konsinyasi.
- Data pendukung lain yang diperlukan untuk operasional.

Barang CONSIGNMENT bukan stok OWN. AFFILIATE tidak membentuk stok fisik.

### 10.3 Input dan impor
Saldo awal dapat dimasukkan melalui formulir atau impor CSV. Template pembukaan sekurang-kurangnya mendukung:

| Jenis saldo awal | Kolom CSV |
|---|---|
| Stok lot awal | `sku, lot_code, expiry_date, total_gram, total_pcs, cost_total_rupiah, supplier_code` |
| Piutang pelanggan awal | `customer_code, invoice_no, amount_due_rupiah, due_date` |
| Utang supplier awal | `supplier_code, reference_no, amount_due_rupiah, due_date` |

Sebelum disimpan, sistem memvalidasi kolom wajib, tipe data, angka, referensi master, data ganda, dan konsistensi total. Kolom opsional dan aturan nilai kosong harus didefinisikan dalam template impor; jangan menganggap seluruh kolom selalu wajib tanpa aturan validasi.

Sistem menampilkan ringkasan data valid dan kesalahan. Baris tidak valid tidak boleh diam-diam diimpor sebagai data benar.

### 10.4 Konfirmasi
Owner memeriksa dan mengonfirmasi saldo awal. Setelah Go-Live, data pembukaan tidak boleh diedit diam-diam. Koreksi dilakukan melalui transaksi penyesuaian dengan alasan, aktor, waktu, dan referensi terhadap saldo awal.

### 10.5 Rekonsiliasi sebelum Go-Live
Owner dapat membandingkan stok fisik, kas, bank, rincian piutang, rincian utang, dan kewajiban konsinyasi dengan saldo yang dimasukkan. Selisih yang belum selesai harus ditampilkan.

### 10.6 Keputusan terbuka
Perlu diputuskan apakah seluruh stok awal wajib memiliki lot rinci atau boleh menggunakan lot pembukaan khusus ketika riwayat lot lama tidak tersedia. Pilihan ini memengaruhi FEFO dan HPP; developer tidak boleh menentukan sendiri.

---

## 11. Arsitektur PWA dan Penyimpanan Lokal

### 11.1 Arsitektur aplikasi
- React 18 dan TypeScript.
- Vite sebagai build tool.
- PWA dengan vite-plugin-pwa dan Workbox.
- Tailwind CSS untuk styling.
- IndexedDB untuk penyimpanan lokal.
- Business Engine sebagai lapisan aturan bisnis.
- UI tidak boleh menjadi tempat duplikasi aturan perhitungan.

### 11.2 Penyimpanan lokal
IndexedDB menyimpan data operasional, master data yang diperlukan, transaksi, stock ledger, audit trail, sync outbox, status sinkronisasi, dan metadata lampiran.

Nama database aktif saat ini adalah `karkasia_erp_offline_db`. Nama store dan struktur tabel mengikuti skema implementasi yang berversi.

### 11.3 Migrasi data
Migrasi schema harus berversi dan diuji. Data lama yang masih didukung harus dinormalisasi tanpa kehilangan entitas atau status. Migrasi yang berisiko harus didahului snapshot pengaman dan memiliki prosedur pemulihan.

### 11.4 Proyeksi
Ringkasan stok, saldo, atau dashboard yang dapat dihitung ulang harus diperlakukan sebagai projection/cache, bukan sumber kebenaran tunggal jika ledger/event sumber tersedia.

### 11.5 Penyimpanan media
Foto dan lampiran dikelola terpisah dari payload transaksi utama melalui metadata dan antrean media. Referensi media harus stabil dan dapat diverifikasi melalui manifest/checksum.

---

## 12. Backend, Sinkronisasi, dan Konflik

### 12.1 Backend belum dikunci
Backend bersifat configurable dan vendor-neutral. Opsi yang pernah dievaluasi termasuk GAS/Google Sheets, REST API dengan PostgreSQL, Supabase, dan layanan lain yang memenuhi kebutuhan. Daftar tersebut bukan kewajiban untuk membangun semuanya.

Satu backend sinkronisasi aktif digunakan untuk satu konfigurasi operasional pada satu waktu. Backend produksi belum dikunci dalam dokumen ini.

### 12.2 Kontrak adapter
Adapter menyediakan kemampuan yang diperlukan untuk:
- Health check.
- Push event/outbox.
- ACK eksplisit per event.
- Pull perubahan.
- Cursor/sequence dan pagination.
- Idempotensi.
- Pelaporan error.
- Dukungan media bila diperlukan.

Business Engine tidak boleh bergantung langsung pada SDK atau skema vendor tertentu.

### 12.3 Outbox
- Transaksi lokal disimpan lebih dahulu di IndexedDB.
- Perubahan yang perlu disinkronkan masuk Outbox.
- Setiap event memiliki UUID, idempotency key, Store ID, Device ID asal, jenis event, timestamp, referensi, versi schema/payload, dan data yang diperlukan.
- Status minimal membedakan PENDING, SYNCED, dan FAILED.
- FAILED harus menyimpan informasi error yang dapat diperiksa dan dicoba ulang sesuai aturan.
- Status SYNCED dan server sequence hanya diberikan setelah ACK eksplisit dari backend untuk event tersebut.
- Mode LOCAL_ONLY tidak boleh menandai event sebagai tersinkron.

### 12.4 Pull dan rekonsiliasi
- Setelah push atau pada jadwal sinkronisasi, perangkat menarik perubahan berdasarkan cursor/server sequence.
- Event diterapkan berurutan, idempoten, dan dengan aturan deterministik yang sama pada semua perangkat.
- Pengiriman ulang event tidak boleh membuat transaksi ganda.
- Perubahan master yang belum tersedia, stok negatif, referensi tidak cocok, atau urutan event yang tidak dapat dipastikan menjadi conflict case.
- Konflik tidak boleh diabaikan atau diselesaikan dengan membuang event secara diam-diam.
- Perangkat menampilkan waktu sinkronisasi terakhir dan status data lokal/backend. Data lokal yang belum tersinkron tidak boleh ditampilkan sebagai data konsolidasi seluruh perangkat.
- Aktivitas rutin tetap dapat berjalan offline selama validasi lokal mencukupi. Jika transaksi berisiko bentrok dengan stok fisik terakhir, sistem harus menampilkan status stok yang mungkin sudah usang dan menandai risiko; tidak boleh menjanjikan ketersediaan global yang tidak dapat diverifikasi.
- Reservasi stok antarperangkat dan penjualan bersamaan saat offline mengikuti keputusan teknis khusus sebelum produksi; konflik tidak boleh diselesaikan dengan menghapus transaksi salah satu perangkat.

### 12.5 Konflik dan notifikasi Owner
Conflict case menyimpan event terkait, perangkat asal, waktu, jenis konflik, data pembanding, dan status penyelesaian. Owner meninjau konflik yang memerlukan keputusan bisnis. Sistem mempertahankan histori sebelum dan sesudah penyelesaian.

Owner mendapat daftar pengecualian terpusat, bukan notifikasi untuk setiap aktivitas normal. Prioritas notifikasi:
- **Kritis:** data keuangan/stok tidak konsisten, dugaan event ganda, konflik yang dapat mengubah saldo, atau kegagalan backup/restore yang membahayakan data.
- **Perlu tindakan:** retur di luar kebijakan, adjustment material, penjualan di bawah HPP, setoran berselisih, pembayaran/transfer belum terverifikasi, dan pengeluaran di luar batas.
- **Informasi:** stok menipis/near-expiry, piutang jatuh tempo, kas Sales mendekati soft limit, serta ringkasan operasional.

Notifikasi harus dapat dibuka ke transaksi sumber dan menampilkan tindakan yang diperlukan. Notifikasi bukan approval otomatis; Owner hanya diminta mengambil keputusan ketika aturan memang mensyaratkannya.

### 12.6 Penggantian backend
Penggantian backend memerlukan prosedur ekspor, migrasi, deduplikasi, rekonsiliasi, dan pengujian multi-device. Jangan mengirim event ke dua backend secara paralel tanpa desain konsistensi yang disengaja.

---

## 13. Keamanan, Backup, dan Restore

### 13.1 Keamanan aplikasi
- PWA disajikan melalui HTTPS.
- Secret server/database tidak boleh berada di bundle frontend.
- Akses backend wajib menerapkan autentikasi dan otorisasi di sisi server.
- Validasi UI tidak menggantikan validasi Business Engine/backend.
- Data PIN tidak disimpan dalam plaintext.

### 13.2 PIN Owner
PIN Owner adalah kontrol tambahan untuk otorisasi lokal, bukan pengganti akun Owner, autentikasi backend, atau pemeriksaan kewenangan di server.

Rancangan awal menggunakan PBKDF2-HMAC-SHA256 dengan salt acak unik. Parameter **100.000 iterasi yang pernah dicantumkan bukan baseline final dan tidak boleh dianggap memenuhi standar keamanan saat ini**. Target awal yang harus dievaluasi adalah 600.000 iterasi PBKDF2-HMAC-SHA256; parameter final harus diuji pada perangkat minimum yang didukung agar verifikasi tetap praktis. Alternatif Argon2id hanya boleh dipilih jika implementasi PWA dan ketersediaan library telah diverifikasi serta performanya layak. OWASP Password Storage Cheat Sheet merekomendasikan PBKDF2-HMAC-SHA256 sebanyak 600.000 iterasi: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html. 

Plaintext PIN tidak boleh disimpan atau diekspor. Salt dan hash tidak boleh dimasukkan ke backup lintas perangkat. Percobaan gagal harus dibatasi dengan lockout dan pencatatan audit; batas percobaan, durasi lockout, dan mekanisme anti-bypass lintas perangkat masih harus ditetapkan. Otorisasi offline harus memiliki masa berlaku, scope tindakan, dan snapshot objek yang jelas; otorisasi lama tidak boleh dipakai ulang untuk tindakan berbeda.

### 13.3 Batas keamanan IndexedDB
IndexedDB tidak otomatis terenkripsi hanya karena aplikasi memakai PIN. PIN aplikasi bukan pengganti autentikasi backend, keamanan origin, atau perlindungan perangkat. Risiko akses melalui browser/perangkat yang telah dikuasai pihak lain harus dinilai secara terpisah.

### 13.4 Strategi backup
- IndexedDB adalah penyimpanan transaksi aktif pada perangkat.
- Backend yang dipilih menjadi perantara/sumber data bersama bagi event yang sudah diterima dan di-ACK.
- Google Drive adalah backup eksternal alternatif, bukan backend sinkronisasi utama dan bukan syarat transaksi.
- Jika Drive diaktifkan, gunakan satu akun Google milik Owner dan satu folder bersama bernama `ERP DAGING BACKUP`.
- Tidak ada folder per perangkat dan tidak ada konfigurasi folder/Device ID manual.
- Device ID dicatat sebagai metadata asal transaksi, bukan struktur folder.
- File JSON backup harus unik/versioned dan tidak saling menimpa.
- Lampiran disimpan sebagai file terpisah dengan manifest dan referensi stabil.
- Upload aman dan deduplikasi harus melalui backend/gateway yang ditetapkan; jangan mengasumsikan semua client boleh menulis langsung ke Drive tanpa kontrol.
- PWA tidak menjamin pekerjaan background berjalan setelah browser ditutup atau ditangguhkan. Upload tertunda dilanjutkan ketika aplikasi aktif dan koneksi tersedia.

### 13.5 Metadata backup
Backup sekurang-kurangnya mengidentifikasi:
- Backup ID.
- Store ID.
- Device ID asal.
- Waktu pembuatan.
- Schema version.
- Rentang/urutan event.
- Data dan metadata sinkronisasi.
- Manifest lampiran.
- Checksum/integrity data.

### 13.6 Restore
Sebelum restore:
- Buat snapshot pengaman kondisi perangkat.
- Validasi schema, checksum, Store ID, manifest, dan lampiran.
- Periksa event/UUID yang sudah ada agar tidak diduplikasi.
- Pertahankan data yang lebih baru dan event pending yang belum diterima backend.
- Jangan menghapus seluruh IndexedDB lalu menimpa secara buta dengan satu file.

**Perangkat yang sama:** pemulihan snapshot dapat dilakukan dengan guard dan rekonsiliasi terhadap data lokal/backend yang tersedia.

**Perangkat pengganti:**
- Membuat Device ID aktif yang baru.
- Menarik data yang sudah tersinkron dari backend terlebih dahulu bila tersedia.
- Mengimpor event yang belum ada dari backup secara additive.
- Mempertahankan Device ID asal pada metadata transaksi/audit historis.
- Tidak mengkloning identitas aktif perangkat lama.
- Tidak melakukan full snapshot overwrite dari perangkat lama ke perangkat pengganti.

Jika backend tidak tersedia, data hasil restore harus ditandai sebagai belum direkonsiliasi dengan sumber bersama. Restore bukan bukti bahwa semua perangkat telah konsisten.

### 13.7 Status backup
Status backup lokal, backend, dan Drive harus ditampilkan terpisah. File yang baru dibuat lokal tidak boleh ditampilkan sebagai berhasil diunggah ke Drive atau backend sebelum upload dan verifikasi selesai.

---

## 14. Audit Trail dan Integritas Data

### 14.1 Jejak audit
Aktivitas sensitif dan perubahan bisnis menyimpan:
- Identitas event dan referensi transaksi sumber.
- Store ID, User ID, role, dan Device ID asal.
- Waktu kejadian dan waktu diterima backend bila berbeda.
- Jenis tindakan dan status sebelum/sesudah.
- Entitas, item, lot, pembayaran, atau akun yang terkait.
- Nilai sebelum/sesudah bila relevan.
- Alasan, bukti, dan otorisasi bila diperlukan.
- Versi kebijakan/ambang yang digunakan saat tindakan.
- Identitas Owner yang mengotorisasi serta snapshot permintaan yang disetujui.

Audit trail append-only dan tidak dapat diubah oleh Sales. Owner dapat melakukan koreksi melalui event baru, tetapi tidak menghapus jejak sebelumnya.

### 14.2 Koreksi
Transaksi selesai, stock ledger, dan audit trail tidak dihapus untuk memperbaiki kesalahan. Gunakan reversal, retur, atau adjustment yang merujuk data asal.

### 14.3 Snapshot historis
Harga, berat, kuantitas, sumber aturan, dan data penting lain yang menentukan hasil transaksi disimpan sebagai snapshot. Perubahan master tidak boleh mengubah hasil historis secara tidak sengaja.

### 14.4 Rekonsiliasi
Sistem harus dapat menelusuri saldo dan laporan ke event/transaksi pembentuknya. Selisih harus dicatat sebagai temuan, bukan disembunyikan melalui perubahan angka ringkasan.

---

## 15. Modul dan Batas Scope

Nomor modul adalah identitas fungsi, bukan urutan pengerjaan. Daftar berikut memuat 24 entri termasuk MOD-07B.

1. **MOD-01 — First Run dan Inisialisasi:** konfigurasi awal toko dan Owner.
2. **MOD-02 — Pengguna dan Perangkat:** role, sesi, identitas perangkat.
3. **MOD-03 — Produk dan Kategori:** SKU, kategori, satuan, barcode.
4. **MOD-04 — Penjualan dan POS:** pesanan, penjualan, pembayaran, bukti transaksi.
5. **MOD-05 — Harga dan Promo:** Pricing Engine dan pengaturan harga Owner.
6. **MOD-06 — Pelanggan:** data pelanggan, kelompok, riwayat, penanggung jawab.
7. **MOD-07 — Persediaan dan Lot:** stok pusat, lot, FEFO, HPP.
8. **MOD-07B — Stock Opname dan Karantina:** opname, selisih, susut, kelayakan.
9. **MOD-08 — Retur:** retur penjualan/pembelian dan koreksi.
10. **MOD-09 — Pembelian dan Landed Cost:** PO, penerimaan, supplier invoice, biaya perolehan.
11. **MOD-10 — Piutang:** saldo pelanggan, pembayaran, umur piutang.
12. **MOD-11 — Setoran Sales:** penerimaan uang, setoran, rekonsiliasi.
13. **MOD-12 — Pengeluaran Operasional:** OPEX dan bukti pengeluaran.
14. **MOD-13 — Pajak dan Laba Rugi:** konfigurasi pajak dan laporan.
15. **MOD-14 — Dashboard dan Store Health:** ringkasan usaha dan status kesehatan data/sinkronisasi.
16. **MOD-15 — Konflik dan Pengecualian:** pemeriksaan dan penyelesaian konflik.
17. **MOD-16 — Backup dan Restore:** backup, validasi, pemulihan.
18. **MOD-17 — Perangkat Pendukung:** barcode scanner dan printer struk.
19. **MOD-18 — Audit Trail dan Pencatatan Keuangan:** histori aktivitas dan penelusuran.
20. **MOD-19 — Ekspor Dokumen:** PDF, CSV, dan dokumen operasional.
21. **MOD-20 — Kamera dan Dokumen:** foto bukti dan pengelolaan lampiran.
22. **MOD-21 — Voice Order:** ucapan menjadi draft pesanan.
23. **MOD-22 — AI Advisor:** analisis dan rekomendasi berdasarkan data ERP.
24. **MOD-23 — OCR Nota:** ekstraksi data dari foto nota menjadi draft.

### 15.1 Scope di luar implementasi aktif
- E-commerce dan marketplace.
- Multi-toko dan multi-gudang independen.
- Stok kendaraan sebagai gudang tersendiri.
- Payroll.
- Komisi internal Sales dan bonus insentif Sales (arah desain dicatat, tetapi belum masuk scope implementasi aktif v1).
- Integrasi pajak resmi/e-Faktur.
- GPS tracking.
- WhatsApp API untuk pengiriman otomatis.
- Aplikasi native iOS.
- Flutter/APK.

Penambahan scope harus melalui perubahan spesifikasi yang disetujui Owner.

### 15.2 Batas implementasi
Daftar modul bukan bukti fitur telah tersedia. Status tiap fitur harus dibuktikan melalui source code, pengujian, dan hasil operasional yang sesuai.

---

## 16. AI, OCR, dan Voice Order

### 16.1 Prinsip umum
AI adalah alat bantu, bukan sumber kebenaran transaksi. AI tidak boleh menjadi otoritas untuk harga, stok, HPP, saldo, atau laporan. Hasil AI harus diperiksa dan divalidasi oleh Business Engine sebelum menjadi data resmi.

Fitur transaksi inti harus tetap berjalan saat layanan AI offline/tidak tersedia.

### 16.2 OCR Nota
1. Pengguna mengambil/memilih foto nota.
2. Sistem mengekstrak teks dan angka.
3. Sistem membuat draft.
4. Pengguna memeriksa dan memperbaiki draft.
5. Business Engine memvalidasi.
6. Pengguna mengonfirmasi penyimpanan.

OCR tidak boleh langsung membentuk transaksi keuangan final tanpa pemeriksaan pengguna. Foto sumber dan hasil ekstraksi harus dapat ditelusuri.

### 16.3 Voice Order
Ucapan diubah menjadi draft pesanan. Produk, pelanggan, berat, harga, dan jumlah harus dicocokkan dengan data ERP. Jika ucapan ambigu atau tidak lengkap, sistem meminta koreksi. Tidak boleh membuat transaksi final tanpa konfirmasi pengguna.

### 16.4 AI Advisor
AI Advisor ditujukan untuk Owner dan dapat membantu:
- Ringkasan penjualan.
- Pergerakan dan umur stok.
- Perubahan margin.
- Piutang dan utang.
- Pola biaya.
- Deteksi anomali.
- Rekomendasi tindakan.

Setiap hasil menampilkan periode dan sumber data. Angka resmi berasal dari perhitungan Business Engine. AI tidak boleh mengubah transaksi, harga, stok, atau saldo.

### 16.5 Privasi dan batas layanan
Data yang dikirim ke layanan AI harus dibatasi sesuai kebutuhan. Data sensitif pelanggan tidak dikirim tanpa dasar dan kebutuhan yang sah. Batas kuota, timeout, provider, dan konfigurasi layanan harus ditetapkan dalam konfigurasi teknis sebelum produksi; fitur AI tidak boleh menghambat operasi offline.

---

## 17. Standar UI/UX

### 17.1 Arah desain
- Mobile-first.
- Clean Luxury.
- Tampilan bersih, modern, premium, dan profesional.
- Bahasa Indonesia sederhana.
- Workflow ringkas.
- Laporan tetap lengkap.

### 17.2 Standar bahasa dan istilah UI
ERP DAGING menggunakan campuran Bahasa Indonesia sederhana dan istilah Inggris yang sudah umum dipakai dalam aktivitas bisnis/UMKM. Tujuannya adalah membuat aplikasi terasa modern dan familiar tanpa mengorbankan kejelasan.

Aturan penggunaan:
- Nama menu dan fitur boleh memakai istilah Inggris yang umum, misalnya **Sales**, **Stock**, **Customer**, **Supplier**, **Dashboard**, dan **Settings**.
- Instruksi, penjelasan, konfirmasi, peringatan, dan pesan kesalahan tetap menggunakan Bahasa Indonesia yang sederhana.
- Istilah Inggris tidak boleh dipilih hanya agar terlihat modern. Jika istilahnya tidak umum atau berpotensi ambigu, gunakan Bahasa Indonesia.
- Satu istilah harus konsisten di seluruh menu, tombol, laporan, notifikasi, dan dokumen bantuan.
- Istilah UI tidak mengubah nama field database, API, event, enum, atau aturan Business Engine.
- Istilah akuntansi yang memiliki arti khusus harus tetap presisi. Contohnya **Gross Profit** berarti laba kotor, sedangkan **Net Profit** berarti laba bersih; jangan mengganti keduanya dengan kata **Profit** saja jika konteksnya laporan keuangan.

#### Kamus istilah UI yang direkomendasikan

| Istilah formal/lama | Label UI yang direkomendasikan | Catatan penggunaan |
|---|---|---|
| Penjualan | Sales | Menu/fungsi penjualan |
| Pembelian | Purchasing | Menu/fungsi pembelian |
| Persediaan | Stock | Menu stok |
| Pelanggan | Customer | Data pelanggan |
| Pemasok | Supplier | Data pemasok |
| Pengiriman | Delivery | Proses pengiriman |
| Penerimaan stok | Stock In | Stok masuk |
| Pengeluaran stok | Stock Out | Stok keluar |
| Retur | Return | Retur penjualan/pembelian sesuai konteks |
| Pembatalan transaksi | Cancel Transaction | Aksi pembatalan; histori tetap tersimpan |
| Pemindahan stok | Stock Transfer | Perpindahan stok |
| Penyesuaian stok | Stock Adjustment | Koreksi stok yang tercatat |
| Barang rusak | Damaged Stock | Status/kategori barang rusak |
| Stok minimum | Minimum Stock | Batas peringatan stok |
| Laba kotor | Gross Profit | Istilah laporan yang spesifik |
| Laba bersih | Net Profit | Istilah laporan yang spesifik |
| Pendapatan | Revenue | Pendapatan usaha |
| Harga pokok penjualan | HPP / Cost | Gunakan HPP pada konteks laporan Indonesia; Cost dapat dipakai pada tampilan ringkas jika tidak ambigu |
| Piutang | Receivable | Gunakan AR hanya pada konteks teknis/laporan ringkas |
| Utang | Payable | Gunakan AP hanya pada konteks teknis/laporan ringkas |
| Arus kas | Cash Flow | Ringkasan arus kas |
| Biaya operasional | OPEX | Boleh disertai penjelasan “Biaya Operasional” |
| Uang muka | DP | Kepanjangan Down Payment dijelaskan saat pertama digunakan |
| Pembayaran sebagian | Partial Payment | Status pembayaran |
| Pelunasan | Settlement | Aksi/status pelunasan |
| Ringkasan keuangan | Financial Summary | Ringkasan keuangan |
| Laporan penjualan | Sales Report | Laporan penjualan |
| Daftar harga | Price List | Daftar harga |
| Harga khusus | Special Price | Harga berdasarkan kesepakatan khusus |
| Harga grosir | Wholesale Price | Harga berdasarkan volume/ketentuan grosir |
| Harga kontrak | Contract Price | Harga sesuai kontrak |
| Promosi | Promo | Program promosi |
| Potongan harga | Discount | Diskon |
| Promo lot terbatas | Flash Sale | Label UI untuk penawaran lot clearance |
| Harga berdasarkan volume | Volume Price | Harga berdasarkan berat aktual sesuai aturan |
| Harga jual | Selling Price | Harga jual produk |
| Margin | Margin | Jangan disamakan dengan Gross Profit |
| Halaman utama | Dashboard | Ringkasan kondisi usaha |
| Riwayat transaksi | Transaction History | Riwayat transaksi |
| Data utama | Master Data | Data referensi utama |
| Pengguna | Users | Daftar pengguna |
| Hak akses | Access Control | Pengaturan kewenangan |
| Catatan aktivitas | Activity Log | Jejak aktivitas |
| Pencadangan | Backup | Proses pencadangan |
| Pemulihan | Restore | Proses pemulihan |
| Sinkronisasi | Sync | Proses sinkronisasi |
| Status sistem | System Status | Kondisi aplikasi/backend |
| Pengaturan | Settings | Pengaturan aplikasi |

Label di atas adalah standar istilah yang direkomendasikan untuk UI, bukan kewajiban menerjemahkan seluruh teks aplikasi ke Bahasa Inggris. Jika istilah yang lebih singkat berpotensi membingungkan, tampilkan label Inggris dengan penjelasan Bahasa Indonesia.


### 17.3 Navigasi dan form
Navigasi harus mengutamakan fungsi operasional yang sering digunakan. Form meminta informasi sesingkat mungkin, menggunakan nilai awal yang masuk akal, pencarian/pilihan cepat, keypad sesuai tipe data, dan validasi dekat dengan input.

### 17.4 Feedback
UI harus membedakan:
- Tersimpan di perangkat.
- Menunggu sinkronisasi.
- Diterima backend.
- Gagal sinkronisasi.
- Memerlukan pemeriksaan konflik.
- Memerlukan otorisasi Owner.

Transaksi lokal yang berhasil disimpan tidak boleh diberi label seolah sudah diterima backend.

### 17.5 Prinsip kontrol dan pengalaman operasional
ERP DAGING harus terasa seperti aplikasi kasir dan stok yang mudah digunakan, dengan Business Engine ERP yang kuat di belakangnya.

- Sales berfokus pada pekerjaan harian: penjualan, timbang/packing, penerimaan barang, stok, pembayaran, dan pengiriman.
- Sales tidak perlu menghitung HPP, NRV, COGS, jurnal, atau rekonsiliasi secara manual.
- Kompleksitas perhitungan, validasi, ledger, sinkronisasi, dan audit disembunyikan dari workflow normal.
- Aktivitas rutin tidak meminta approval Owner jika masih dalam batas kebijakan.
- Sistem mengutamakan validasi otomatis, pencatatan transparan, dan kontrol berbasis pengecualian.
- Owner mendapat pengaturan kebijakan, ringkasan usaha, laporan lengkap, dan daftar pengecualian yang perlu keputusan.
- Owner tidak menjadi bottleneck untuk transaksi rutin.
- UI boleh sederhana, tetapi tidak boleh melewati validasi Business Engine atau mengurangi jejak audit.
- Istilah teknis seperti Moving Average, Relative NRV, ledger, dan idempotency tidak perlu ditampilkan kepada Sales kecuali dalam layar diagnostik yang memang ditujukan untuk Owner/pengembang.
### 17.6 Batas dokumen desain
PLAN ERP DAGING ini adalah sumber utama aturan produk, role, permission, workflow, valuasi, keuangan, dan kriteria penerimaan. Dokumen UI/UX terpisah hanya boleh merinci visual system, layout, dan interaksi layar; dokumen tersebut tidak boleh mengubah aturan dalam PLAN.

Sebelum implementasi UI, dokumen UI/UX pendamping wajib diselaraskan dengan role Owner + Sales, istilah Flash Sale, Moving Average, serta prinsip kontrol berbasis pengecualian. Jika ada perbedaan, PLAN ini yang berlaku. Pembaca tidak perlu membuka dokumen UI/UX untuk memahami aturan bisnis dan keputusan dalam PLAN ini.

## 18. Pengujian, Deployment, dan Kriteria Rilis

### 18.1 Pemeriksaan kode
Setiap perubahan yang relevan harus menjalani TypeScript type checking, lint, unit test, integration test yang sesuai, dan production build. Hasil harus berasal dari commit yang sama dengan kandidat rilis.

### 18.2 Pengujian Business Engine
Pengujian mencakup:
- Prioritas dan snapshot harga.
- Harga grosir berdasarkan SKU.
- OWN, CONSIGNMENT, dan AFFILIATE.
- Moving Average: penerimaan pertama, penerimaan berikutnya dengan biaya berbeda, landed cost, penjualan lintas beberapa lot FEFO, stok habis, dan penerimaan setelah stok nol.
- COGS penjualan harus memakai Moving Average sebelum transaksi, bukan HPP asal lot yang terpilih FEFO.
- Retur harus mengembalikan nilai berdasarkan COGS transaksi asal; barang karantina tidak boleh menambah stok tersedia.
- Konversi harus menguji Relative NRV: output utama dan sampingan yang dijual, output tanpa NRV positif, limbah yang tidak menjadi stok, snapshot harga/biaya, pembagian nilai dengan pembulatan deterministik, rekonsiliasi total nilai input-output, rekonsiliasi berat input-output-limbah/selisih, serta pembaruan Moving Average SKU hasil.
- GRNI: penerimaan parsial, invoice terlambat, selisih harga invoice terhadap PO, penerimaan tanpa harga yang disetujui, dan rekonsiliasi kewajiban sementara menjadi utang invoice.
- Pembayaran: DP sebelum penyerahan, deposit belum dialokasikan, alokasi eksplisit ke invoice, kelebihan pembayaran, transfer pending verification, pembayaran campuran, refund, dan customer credit.
- Pembelian dan pembayaran supplier, piutang, utang, OPEX, setoran Sales, dan rekonsiliasi kas/bank.
- Stock adjustment, susut, dan koreksi landed cost.
- Retur, pembatalan draft, reversal transaksi posted, dan refund tanpa penghapusan histori.
- FEFO, konversi, susut, opname, dan karantina.
- Ledger, reversal, audit trail, dan konsistensi nilai antarperangkat.
- Saldo awal dan rekonsiliasi.
- Perhitungan laporan OWN, CONSIGNMENT, dan AFFILIATE harus diuji terpisah; laporan tidak boleh menggabungkan angka dengan klasifikasi yang belum diverifikasi.

Setiap pengujian perhitungan harus memiliki input dan hasil yang diharapkan, termasuk nilai tercatat sebelum/sesudah, kuantitas gram, HPP rata-rata, COGS, dan selisih pembulatan.

### 18.3 Pengujian offline dan penyimpanan
Buktikan transaksi tersimpan tanpa internet, tetap tersedia setelah aplikasi ditutup/restart, Outbox bertahan, dan kegagalan penyimpanan dilaporkan jelas.

### 18.4 Pengujian multi-device
Minimal dua perangkat untuk menguji push/pull, event duplikat, ACK tertunda, koneksi terputus, perangkat kembali online, konflik stok/master data, serta pemulihan. Tidak boleh terjadi transaksi ganda atau event hilang tanpa penanganan.

### 18.5 Pengujian backup/restore
Uji JSON, lampiran, checksum, file rusak/tidak lengkap, pemulihan perangkat yang sama, perangkat pengganti, deduplikasi event, dan rekonsiliasi. File berhasil diunduh bukan bukti restore berhasil.

### 18.6 Pengujian keamanan dan kewenangan
Uji hak akses Owner/Sales, penolakan mutasi harga oleh Sales, batas diskon, otorisasi tindakan sensitif, PIN, permintaan otorisasi offline, pemisahan verifikasi setoran, akses laporan sesuai role, validasi backend, perlindungan secret, dan akses data.

Tambahkan skenario:
- Sales dapat menyelesaikan penjualan rutin tanpa PIN Owner.
- Draft dapat dibatalkan Sales dengan alasan; transaksi POSTED tidak dapat diedit atau dihapus.
- Penjualan POSTED dapat berstatus UNPAID/PARTIAL/PAID secara terpisah dari DELIVERED.
- DP sebelum serah-terima dicatat sebagai customer deposit, bukan revenue.
- Retur ≤ Rp500.000 dalam 1 × 24 jam dapat dicatat Sales; nilai/masa di luar batas tertahan untuk otorisasi Owner.
- Retur barang masuk karantina dan jika layak mengembalikan nilai berdasarkan COGS historis.
- Stock adjustment melebihi 2% lot atau 5 kg memerlukan otorisasi Owner.
- Sales tidak dapat memverifikasi setoran yang diajukan sendiri.
- Setoran SUBMITTED tidak mengurangi kas Sales sampai Owner memverifikasi menjadi RECEIVED.
- OPEX/pembelian di atas batas konfigurasi tidak dapat diposting tanpa otorisasi.
- Saat Owner offline, tindakan sensitif masuk pending authorization dan tidak di-bypass.
- Audit menyimpan aktor, waktu, device, nilai sebelum/sesudah, alasan, dan otorisasi.
### 18.7 Pengujian UI dan AI
Uji HP layar kecil, HP umum, tablet, desktop, navigasi, POS, Atur Harga, keyboard virtual, offline, pesan kesalahan, OCR, Voice Order ambigu, dan AI tidak tersedia.

### 18.8 Status kesiapan
- **DEVELOPMENT:** masih dikerjakan.
- **INTERNAL TEST:** implementasi tersedia dan sedang diuji.
- **PILOT:** digunakan terbatas untuk validasi operasional.
- **PRODUCTION READY:** seluruh kriteria penerimaan wajib lulus dan bukti pengujian tersedia.

Keberadaan kode atau tampilan layar tidak cukup untuk menyatakan fitur selesai atau production-ready.

### 18.9 Deployment dan pembaruan
PWA produksi menggunakan HTTPS. Service Worker dan cache harus diuji agar pembaruan aplikasi tidak menghilangkan data lokal. Migrasi schema harus memiliki strategi pengamanan dan pemulihan.

### 18.10 Monitoring minimum
Owner dapat melihat versi aplikasi, kondisi penyimpanan lokal, status backend/sinkronisasi, jumlah event pending/failed, kegagalan terakhir, status backup, dan konflik yang membutuhkan perhatian.

---

## 19. Glosarium dan Keputusan Terbuka

### 19.1 Glosarium
- **ACK:** konfirmasi backend menerima event.
- **Affiliate:** model penjualan tanpa persediaan fisik milik bisnis, dengan komisi sesuai kesepakatan.
- **AP:** utang kepada supplier.
- **AR:** piutang pelanggan.
- **Business Engine:** lapisan pusat aturan bisnis, validasi, dan perhitungan.
- **Consignment/Konsinyasi:** barang titipan yang kepemilikannya tetap pada pihak penitip sesuai perjanjian.
- **FEFO:** First Expired, First Out; lot dengan kedaluwarsa terdekat yang eligible diprioritaskan.
- **GRN:** Goods Received Note, catatan penerimaan barang.
- **HPP:** Harga Pokok Penjualan.
- **Idempotency:** pengiriman/pemrosesan ulang tidak membuat transaksi ganda.
- **IndexedDB:** database lokal yang disediakan browser.
- **Landed Cost:** biaya perolehan tambahan untuk membawa barang sampai lokasi penyimpanan/siap digunakan.
- **Lot:** kelompok barang yang memiliki identitas penerimaan/asal dan atribut biaya/kelayakan.
- **OPEX:** biaya operasional.
- **OCR:** Optical Character Recognition, ekstraksi teks dari gambar.
- **Outbox:** antrean event lokal yang menunggu sinkronisasi.
- **PO:** Purchase Order, pesanan pembelian.
- **PWA:** Progressive Web App, aplikasi web yang dapat dipasang pada perangkat.
- **Reconciliation:** pencocokan data/event untuk menemukan dan menangani selisih.
- **NRV (Net Realizable Value):** estimasi nilai jual normal suatu output setelah dikurangi estimasi biaya penyelesaian dan biaya penjualan yang relevan.
- **Snapshot:** salinan nilai/aturan pada waktu tertentu untuk menjaga konteks historis.
- **SKU:** Stock Keeping Unit, identitas produk.
- **UUID:** identitas unik universal untuk entitas atau event.
- **Yield Loss/Cutting Loss:** selisih atau bagian yang hilang/tidak menjadi produk hasil dalam proses pemotongan/pengolahan.

### 19.2 Keputusan terbuka sebelum implementasi final
Keputusan berikut tetap memerlukan desain rinci, verifikasi teknis, atau parameter yang belum tersedia. Keputusan yang sudah ditetapkan di Bagian 2, 5, 6, 7, dan 8 tidak boleh dibuka kembali tanpa Change Decision yang menjelaskan alasan dan dampaknya.

1. Formula alokasi landed cost ke produk/lot, pembulatan alokasinya, dan event koreksi untuk biaya yang datang terlambat termasuk bagian yang telah menjadi COGS.
2. Kebijakan kapitalisasi biaya tenaga kerja atau biaya proses tambahan pada hasil konversi.
3. Kebijakan lot untuk saldo awal ketika riwayat lot lama tidak tersedia.
4. Nilai konfigurasi batas diskon Sales, batas OPEX, batas pembelian tanpa persetujuan, dan batas kategori pengeluaran. Mekanisme kontrol sudah ditetapkan; Owner mengisi nilai operasionalnya.
5. Aturan tempo untuk pembayaran parsial/perubahan metode bayar dan urutan tempo terhadap clearance.
6. Kebijakan retensi, cadence, dan verifikasi backup.
7. Pemilihan backend produksi dan detail autentikasi/otorisasi adapter.
8. Batas percobaan PIN gagal, durasi lockout, dan anti-bypass lintas perangkat.
9. Aturan pembulatan deterministik untuk seluruh perhitungan uang/berat yang menghasilkan pecahan, termasuk COGS yang dialokasikan ke beberapa baris lot.
10. Spesifikasi perangkat pendukung rilis: scanner, printer struk, lebar kertas, dan batas kompatibilitas.
11. Tarif dan perlakuan pajak yang berlaku harus diverifikasi sesuai kondisi usaha dan ketentuan terkini.
12. Definisi rinci laporan keuangan final, khususnya klasifikasi principal/agent CONSIGNMENT dan komponen biaya yang masuk Net Profit.
13. Kebijakan COGS provisional dan revaluasi untuk transaksi stok minus/offline.
14. Mekanisme reservasi stok antarperangkat dan penanganan dua perangkat yang menjual stok fisik terakhir saat offline.
15. Sumber bukti dan prosedur verifikasi transfer bank.
16. Kebijakan penyelesaian refund versus customer credit ketika transaksi dibatalkan/diretur dan saldo deposit belum digunakan.
17. Konfirmasi akuntansi atas GRNI dan perbedaan nilai antara PO, penerimaan, serta invoice supplier.

Nilai atau kebijakan yang belum ditetapkan tidak boleh diisi oleh developer melalui asumsi. Fitur yang bergantung pada keputusan tersebut harus ditandai belum siap produksi.

### 19.3 Aturan penutupan keputusan
Setiap keputusan terbuka harus ditutup dengan nilai/aturan eksplisit, alasan, dampak pada data dan modul, serta kriteria pengujian. Setelah disetujui Owner, keputusan tersebut dimasukkan ke bagian spesifikasi terkait dan dihapus dari daftar terbuka. Jangan membuat Change Register yang mengharuskan pembaca menebak aturan mana yang berlaku.

---

## Pernyataan status dokumen

Dokumen ini merupakan draft konsolidasi mandiri. Dokumen ini belum menjadi persetujuan final atas seluruh keputusan terbuka dan tidak menyatakan implementasi telah lulus audit. Sebelum dijadikan PLAN.md utama, lakukan pemeriksaan silang terhadap keputusan bisnis yang sudah disepakati, source code aktif, dan dokumen UI/UX. Perubahan ke dokumen utama hanya dilakukan setelah draft ini disetujui.
