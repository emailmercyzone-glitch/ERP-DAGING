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
2. **Business Engine sebagai otoritas:** aturan bisnis, validasi, perhitungan, dan perubahan status harus dijalankan oleh Business Engine, bukan hanya oleh UI.
3. **Multi-device:** target maksimal 8 perangkat aktif untuk satu operasional toko. Batas ini adalah batas perangkat, bukan ketentuan jumlah akun per role.
4. **Skala target:** sampai 500 SKU dan target operasional sampai 200 transaksi per hari.
5. **Gudang pusat:** stok berada di gudang pusat. Tidak ada stok kendaraan sebagai gudang tersendiri.
6. **Zero-float ledger:** uang disimpan sebagai integer Rupiah dan berat sebagai integer Gram. Jangan menggunakan floating point untuk nilai uang atau berat yang memengaruhi transaksi.
7. **UUID:** entitas dan event memakai identitas unik yang stabil.
8. **Append-only ledger:** pergerakan stok dan histori transaksi tidak dihapus atau ditimpa untuk melakukan koreksi. Koreksi dibuat sebagai event/transaksi pembalik atau penyesuaian yang dapat ditelusuri.
9. **Offline tidak boleh menghilangkan data:** kegagalan jaringan atau backend tidak boleh membatalkan transaksi yang sudah berhasil disimpan lokal.
10. **Sederhana bagi pengguna, lengkap bagi pengelola:** alur operasional ringkas, tetapi laporan dan jejak audit tetap profesional.

### 1.4 Satuan dan pembulatan
- Mata uang utama: Rupiah dalam integer.
- Berat utama: Gram dalam integer; 1 kg = 1.000 gram.
- Konversi tampilan ke kg boleh menggunakan desimal, tetapi nilai dasar yang disimpan dan dihitung tetap integer Gram.
- Aturan pembulatan untuk pembagian biaya, pajak, atau alokasi yang menghasilkan pecahan harus ditentukan secara deterministik dan diuji. Implementasi tidak boleh memilih aturan pembulatan secara berbeda antarfitur.

---

## 2. Pengguna, Role, dan Hak Akses

### 2.1 Role aktif
Hanya ada dua role:
- **Owner:** pemilik usaha dan pengendali kebijakan.
- **Sales:** pengguna operasional.

Role Admin, Kasir, Gudang, Staff, dan role terpisah lainnya tidak termasuk model role aktif. Tugas kasir dan gudang merupakan tanggung jawab operasional yang dapat dilakukan pengguna Sales sesuai kebijakan usaha.

### 2.2 Kewenangan Owner
Owner berwenang:
- Mengatur harga, promo, kontrak, dan kebijakan tempo.
- Mengelola data toko dan pengguna.
- Mengatur kebijakan operasional dan parameter sistem.
- Menyetujui tindakan yang secara eksplisit memerlukan otorisasi Owner.
- Melihat laporan lengkap, audit trail, dan kondisi sinkronisasi.
- Mengelola backup dan restore.
- Meninjau dan menyelesaikan konflik.
- Menetapkan koreksi atau penyesuaian sensitif sesuai aturan.

### 2.3 Kewenangan Sales
Sales menangani kegiatan operasional yang diizinkan, termasuk:
- Membuat pesanan dan transaksi penjualan.
- Memilih pelanggan dan produk.
- Menimbang, mengemas, dan menyerahkan barang sesuai alur operasional.
- Menerima pembayaran pelanggan.
- Melakukan aktivitas penerimaan dan penanganan barang di gudang pusat.
- Mencatat aktivitas pembelian atau pengeluaran yang diizinkan.
- Melihat informasi yang diperlukan untuk tugas operasionalnya.

Sales tidak boleh:
- Mengubah harga master atau aturan Pricing Engine.
- Membuat Owner Price Override.
- Mengubah kebijakan sistem.
- Menghapus atau mengubah histori transaksi.
- Melakukan tindakan yang secara eksplisit hanya boleh dilakukan Owner.

### 2.4 Penegakan akses
Hak akses wajib diperiksa oleh Business Engine dan backend. Menyembunyikan tombol pada UI tidak cukup sebagai kontrol keamanan.

### 2.5 Hal yang belum ditetapkan
Batas nominal tindakan Sales, daftar lengkap tindakan yang memerlukan PIN Owner, dan batas jumlah akun untuk tiap role belum dikunci oleh dokumen ini. Batas maksimal 8 perangkat tidak boleh diterjemahkan otomatis menjadi batas akun tertentu.

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
- Retur harus dicatat sebagai koreksi yang memiliki histori; kebijakan pemulihan kuota setelah retur masih terbuka.

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

### 5.1 Pembuatan transaksi
- Sales membuat pesanan/transaksi dan menyimpannya ke IndexedDB lokal.
- Pelanggan dapat berupa pelanggan terdaftar atau pelanggan umum.
- Harga dihitung oleh Pricing Engine.
- Berat aktual menjadi dasar perhitungan akhir.
- Sistem menyimpan snapshot harga dan aturan yang digunakan.

### 5.2 Stok, HPP, dan FEFO
- Alokasi fisik stok menggunakan lot yang memenuhi syarat jual.
- FEFO memilih lot non-karantina dengan tanggal kedaluwarsa terdekat.
- HPP keuangan penjualan menggunakan Moving Average per SKU, bukan HPP asal lot yang kebetulan terpilih FEFO.
- COGS dihitung dari berat aktual yang terjual dikalikan HPP Moving Average SKU yang berlaku tepat sebelum transaksi diposting. Hasil pembulatan Rupiah harus deterministik.
- Jika satu item dialokasikan ke beberapa lot FEFO, nilai COGS tetap berasal dari satu HPP Moving Average SKU; nilai tersebut dibagi ke baris alokasi hanya untuk rekonsiliasi kuantitas/lot. Total pembagian wajib sama persis dengan COGS item, termasuk selisih pembulatan.
- Transaksi menyimpan snapshot HPP Moving Average, berat, COGS, dan rincian lot fisik yang dikeluarkan. Perubahan HPP setelah transaksi tidak mengubah COGS historis.
- Penjualan menggunakan stok gudang pusat. Tidak ada stok kendaraan sebagai lokasi stok tersendiri.
- HPP asal lot tetap disimpan untuk penelusuran biaya penerimaan dan analisis batch, tetapi tidak menjadi dasar COGS selama metode Moving Average berlaku.

### 5.3 Stok minus saat offline
Penjualan saat stok lokal minus hanya boleh melalui kontrol pengecualian:
- Alasan wajib dicatat.
- Pengguna wajib mencentang konfirmasi tanggung jawab Owner sesuai ketentuan operasional.
- PIN/otorisasi yang dipersyaratkan harus dipenuhi.
- Ketika sinkronisasi menemukan konflik atau stok lot negatif, sistem membuat conflict case untuk ditinjau; sistem tidak boleh diam-diam menghapus atau mengubah transaksi.

### 5.4 Pembayaran
Metode pembayaran:
- CASH.
- TRANSFER.
- TEMPO.
- Kombinasi beberapa metode.

Pembayaran sebagian harus menyimpan nominal, metode, waktu, penerima, dan referensi transaksi. Sisa yang belum dibayar membentuk piutang jika syarat transaksi mengizinkan tempo.

### 5.5 Piutang dan batas kredit
- Batas kredit pelanggan bersifat peringatan, bukan pemblokiran otomatis.
- Melebihi plafon tidak otomatis meminta approval Owner atau membatalkan checkout.
- Sistem menampilkan saldo dan umur piutang agar Owner/Sales dapat mengambil keputusan.

### 5.6 Pengiriman dan penyelesaian
Dokumen penjualan, status pemenuhan barang, status serah-terima, dan status pembayaran harus dibedakan. Status `COMPLETED` tidak boleh digunakan secara ambigu untuk menyatakan sekaligus barang telah diserahkan dan tagihan telah lunas.

**Keputusan status final masih terbuka:** definisi state machine penjualan, pemenuhan, serah-terima, dan pembayaran harus ditetapkan sebelum implementasi final. Sampai keputusan tersebut ditutup, developer tidak boleh menyamakan penyelesaian pengiriman dengan pelunasan.

### 5.7 Void
- Void digunakan untuk membatalkan transaksi sebelum barang diserahkan/penjualan diselesaikan sesuai state machine final.
- Void memerlukan otorisasi Owner sesuai kebijakan.
- Void tidak menghapus transaksi awal.
- Dampak pembalik terhadap stok, pembayaran, piutang, utang, dan ledger harus dicatat sebagai event reversal yang dapat ditelusuri.

### 5.8 Retur
- Retur setelah barang diterima pelanggan berbeda dari void.
- Retur wajib memiliki alasan dan bukti foto sesuai kebijakan.
- Barang yang kembali masuk status karantina sampai dinyatakan layak.
- Retur membentuk koreksi stok dan keuangan/refund atau pengurang tagihan sesuai kondisi.
- Batas waktu, batas nominal retur yang memerlukan pemeriksaan Owner, dan state machine retur mengikuti kebijakan operasional yang ditetapkan; jangan mengarang nilai baru.

---

## 6. Pembelian, Penerimaan, Landed Cost, dan Utang

### 6.1 Pembelian
Sistem mencatat supplier, Purchase Order, rincian produk, jumlah/berat pesanan, harga, mata uang, syarat pembelian, dan dokumen pendukung.

### 6.2 Penerimaan barang
- Penerimaan berdasarkan kondisi fisik aktual.
- Berat aktual dapat berbeda dari PO.
- Selisih harus dicatat dan dapat ditelusuri.
- Penerimaan membentuk lot/batch sesuai identitas penerimaan dan kebijakan lot.
- Barang yang belum memenuhi pemeriksaan dapat ditempatkan dalam karantina.

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
- Susut seperti drip loss atau thawing dicatat melalui penyesuaian terkontrol.
- Penyesuaian memerlukan alasan dan pelaku.
- Selisih material mengikuti batas otorisasi Owner yang ditetapkan.
- Penyesuaian tidak boleh menghapus pergerakan sebelumnya.

### 7.5 Karantina
Barang retur, barang rusak, atau barang yang diragukan kelayakannya harus dapat dipisahkan dari stok yang tersedia dijual. Perubahan status karantina harus memiliki alasan, waktu, dan pelaku.

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
Sistem membedakan kas fisik dan rekening bank. Setiap penerimaan, pengeluaran, dan transfer antar-kanal memiliki tanggal, nominal, metode, pelaku, serta referensi.

Transfer antar-kanal bukan pendapatan atau biaya baru.

### 8.2 Penerimaan uang Sales
- Sales mencatat uang yang benar-benar diterima dari pelanggan, dengan referensi transaksi/piutang, nominal, metode, waktu, dan kanal penerimaan.
- Setoran parsial harus dapat dicatat dan direkonsiliasi terhadap penerimaan asal.
- Rekonsiliasi menghubungkan uang yang diterima, pembayaran pelanggan, setoran, dan saldo kas/bank.
- Batas kas Sales adalah soft limit, bukan pemblokiran transaksi.
- Peringatan operasional yang telah ditetapkan: kas Sales di atas Rp3.000.000 atau uang tertua lebih dari 48 jam.
- Saldo penerimaan memperhitungkan setoran yang sudah berstatus **RECEIVED**. Status input Sales, penerimaan/verifikasi setoran, dan konfirmasi akhir harus dibedakan.
- **Workflow verifikasi setoran belum final.** Rancangan lama memakai langkah verifikasi oleh Admin sebelum konfirmasi Owner, tetapi role Admin tidak lagi termasuk role aktif. Developer tidak boleh menghidupkan kembali role Admin atau menganggap Sales boleh memverifikasi setoran sendiri. Alur pengganti harus ditetapkan secara eksplisit untuk dua role Owner dan Sales sebelum implementasi final.

### 8.3 Piutang
Piutang terbentuk dari penjualan tempo. Sistem mendukung pembayaran sebagian, pelunasan, umur piutang, riwayat pembayaran, dan pengingat jatuh tempo.

Jadwal pengingat yang ditetapkan: H-1, H, H+1, H+3, dan H+7. Pengingat tidak berarti sistem mengirim WhatsApp otomatis.

### 8.4 Utang
Utang supplier berasal dari tagihan pembelian yang valid. Sistem mendukung pembayaran sebagian, pelunasan, umur utang, dan rekonsiliasi per supplier.

### 8.5 OPEX
Setiap biaya operasional menyimpan kategori, nominal, tanggal, metode pembayaran, pelaku, keterangan, dan bukti jika tersedia. Biaya perolehan yang telah masuk HPP tidak boleh dihitung ulang sebagai OPEX.

### 8.6 Konsinyasi dan affiliate
- Kewajiban konsinyasi dihitung berdasarkan barang titipan yang benar-benar terjual dan dasar setor sesuai kesepakatan.
- Affiliate dicatat sebagai pendapatan/komisi sesuai perjanjian.
- Keduanya tidak boleh dicampur dengan stok OWN atau komisi internal Sales.

### 8.7 Komisi internal Sales dan bonus

Komisi internal Sales tetap **di luar scope implementasi aktif v1**. Bagian ini menyimpan arah desain untuk versi berikutnya dan tidak boleh dianggap sebagai fitur yang harus aktif pada rilis v1. Komisi internal Sales berbeda dari komisi AFFILIATE.

Arah desain komisi yang telah disepakati:
- Dasar komisi adalah **total laba kotor per transaksi**, bukan menghitung komisi tiap item secara terpisah. Laba dan rugi seluruh item dalam satu transaksi digabung terlebih dahulu; item rugi mengurangi laba item lain.
- Komisi dihitung dari laba kotor total transaksi yang positif dikalikan tarif yang ditetapkan Owner. Jika laba kotor total nol atau negatif, komisi transaksi tersebut nol. Kerugian tidak dibawa untuk mengurangi transaksi lain.
- Dasar laba kotor untuk komisi adalah COGS historis transaksi yang dihitung menggunakan Moving Average SKU saat penjualan diposting. Lot yang dikeluarkan tetap disimpan sebagai jejak fisik, bukan dasar HPP komisi.
- Satu transaksi memiliki satu Sales utama sebagai pemilik atribusi dengan default split 100%. Jika beberapa Sales berkolaborasi, Owner dapat menetapkan pembagian sebelum transaksi selesai; total persentase wajib tepat 100%. Identitas Sales dan split disimpan sebagai snapshot.
- Sales attribution berbeda dari penanggung jawab/customer owner, petugas operasional, dan petugas penerima pembayaran. Menimbang, mengemas, menyerahkan barang, atau menerima uang tidak otomatis memberikan hak komisi.
- Status komisi: **EARNED** setelah penjualan valid dan barang diserahkan; **PAYABLE** secara proporsional dengan pembayaran pelanggan yang benar-benar diterima; **PAID** setelah Owner membayar dan mencatat pembayaran.
- Pembayaran komisi tidak otomatis ditransfer. Owner menentukan jadwal dan batch pembayaran; sistem mengakumulasi saldo PAYABLE.
- Piutang macet atau pelanggan gagal melunasi tidak otomatis menjadi utang pribadi Sales. Komisi yang belum menjadi PAYABLE karena pembayaran pelanggan belum diterima tetap tertahan. Tidak ada penalti atau chargeback otomatis kepada Sales atas risiko kredit bisnis.
- Pembatalan sebelum penyerahan barang tidak menghasilkan komisi. Retur sebagian menghitung ulang laba kotor transaksi setelah retur; retur penuh membuat hak komisi transaksi menjadi nol. Semua koreksi menyimpan referensi transaksi, nilai sebelum/sesudah, alasan, waktu, dan aktor.
- Jika koreksi mengurangi komisi yang belum dibayar, saldo PAYABLE dikoreksi. Jika komisi sudah dibayar, selisih menjadi saldo koreksi/pengurang komisi berikutnya; tidak ada permintaan pengembalian tunai atau pemotongan gaji otomatis. Jika tidak ada komisi berikutnya, saldo koreksi tetap terbuka untuk ditinjau Owner.

Arah desain bonus dan target:
- Target penjualan bersifat opsional; Owner dapat menetapkan target atau tidak menggunakannya.
- Bonus adalah apresiasi diskresioner Owner dan terpisah dari komisi reguler. Owner menentukan penerima, nominal/persentase, kriteria, periode, bonus individu/tim, waktu pemberian, serta apakah program berlaku.
- Indikator seperti omzet, laba, volume kg, pelanggan baru, retensi, atau pencapaian khusus hanya pilihan yang dapat digunakan Owner, bukan target atau rumus wajib.
- Bonus yang diberikan dicatat terpisah dengan nominal, alasan/kriteria, periode, penerima, pemberi, tanggal, dan status pembayaran.
- Perubahan kebijakan berlaku ke depan dan tidak boleh mengubah komisi/bonus yang sudah disahkan secara diam-diam.

Hal yang masih terbuka sebelum implementasi komisi:
- Perlakuan retur setelah komisi dibayar.
- Koreksi HPP setelah transaksi selesai.
- Penyelesaian saldo koreksi jika Sales berhenti bekerja.
- Detail administrasi saldo koreksi pada kasus khusus.

Tarif komisi, persentase, target, dan nominal bonus belum ditetapkan sebagai angka baku. Tidak ada implementasi komisi/bonus aktif v1 sebelum scope ditinjau ulang dan Owner menyetujui keputusan final.
---

## 9. Laporan dan Pajak

### 9.1 Prinsip laporan
Laporan harus profesional, konsisten, dan dapat ditelusuri sampai transaksi sumber. UI sederhana tidak boleh mengurangi kelengkapan laporan.

### 9.2 Laporan minimum
- Penjualan harian, mingguan, dan bulanan.
- Penjualan per produk, pelanggan, dan Sales.
- Berat/kuantitas terjual.
- Margin dan laba kotor.
- HPP dan pergerakan per lot.
- Persediaan, umur stok, karantina, dan susut.
- Pembelian dan landed cost.
- Piutang dan umur piutang.
- Utang supplier dan umur utang.
- Kas dan bank.
- OPEX.
- Laba rugi.
- Retur, void, dan koreksi.
- Kewajiban konsinyasi.
- Pendapatan/komisi affiliate.
- Audit dan rekonsiliasi.

### 9.3 Laba rugi
Laba kotor dihitung dari pendapatan penjualan dikurangi HPP barang terjual sesuai perlakuan OWN, CONSIGNMENT, dan AFFILIATE. Laba bersih memperhitungkan OPEX dan komponen lain yang telah didefinisikan.

Barang konsinyasi dan affiliate tidak boleh diperlakukan sebagai persediaan OWN.

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
- Event diterapkan berurutan dan idempoten.
- Pengiriman ulang event tidak boleh membuat transaksi ganda.
- Perubahan master yang belum tersedia, stok negatif, atau referensi yang tidak cocok menjadi conflict case.
- Konflik tidak boleh diabaikan atau diselesaikan dengan membuang event secara diam-diam.

ACK berarti backend telah menerima event, bukan bukti bahwa semua perangkat lain sudah menerima event tersebut.

### 12.5 Konflik
Conflict case menyimpan event terkait, perangkat asal, waktu, jenis konflik, data pembanding, dan status penyelesaian. Owner meninjau konflik yang memerlukan keputusan bisnis. Sistem harus mempertahankan histori sebelum dan sesudah penyelesaian.

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
Rancangan penyimpanan PIN Owner menggunakan hash PBKDF2-HMAC-SHA256 dengan salt unik dan 100.000 iterasi. Plaintext, hash, dan salt PIN tidak boleh diekspor ke backup. Kredensial aktif perangkat tidak disalin saat restore ke perangkat pengganti.

Batas percobaan gagal dan durasi lockout harus didefinisikan secara konsisten sebelum dinyatakan final.

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
- Identitas event.
- Store ID.
- User ID dan role.
- Device ID asal.
- Waktu kejadian.
- Jenis tindakan.
- Entitas dan referensi terkait.
- Nilai sebelum/sesudah bila relevan.
- Alasan dan otorisasi bila diperlukan.

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

### 17.5 Prinsip kontrol
Approval tidak digunakan untuk semua aktivitas rutin. Validasi otomatis dan audit menjadi mekanisme utama. Owner dilibatkan pada tindakan sensitif dan pengecualian yang memang memerlukan keputusan bisnis.

### 17.6 Batas dokumen desain
PLAN.md mengunci prinsip pengalaman dan aturan interaksi bisnis. Detail visual, komponen, token desain, layout tiap layar, dan spesifikasi interaksi rinci berada di dokumen UI_UX_GUIDELINE.md. Dokumen desain tidak boleh mengubah aturan bisnis dalam PLAN.md.

---

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
- Retur harus mengembalikan nilai berdasarkan COGS transaksi asal.
- Konversi harus menguji Relative NRV: output utama dan sampingan yang dijual, output tanpa NRV positif, limbah yang tidak menjadi stok, snapshot harga/biaya, pembagian nilai dengan pembulatan deterministik, rekonsiliasi total nilai input-output, rekonsiliasi berat input-output-limbah/selisih, serta pembaruan Moving Average SKU hasil.
- Stock adjustment, susut, dan koreksi landed cost.
- Pembayaran campuran dan parsial.
- Piutang dan utang.
- Retur dan void.
- FEFO, konversi, susut, opname, dan karantina.
- Ledger, reversal, audit trail, dan konsistensi nilai antarperangkat.
- Saldo awal dan rekonsiliasi.

Setiap pengujian perhitungan harus memiliki input dan hasil yang diharapkan, termasuk nilai tercatat sebelum/sesudah, kuantitas gram, HPP rata-rata, COGS, dan selisih pembulatan.

### 18.3 Pengujian offline dan penyimpanan
Buktikan transaksi tersimpan tanpa internet, tetap tersedia setelah aplikasi ditutup/restart, Outbox bertahan, dan kegagalan penyimpanan dilaporkan jelas.

### 18.4 Pengujian multi-device
Minimal dua perangkat untuk menguji push/pull, event duplikat, ACK tertunda, koneksi terputus, perangkat kembali online, konflik stok/master data, serta pemulihan. Tidak boleh terjadi transaksi ganda atau event hilang tanpa penanganan.

### 18.5 Pengujian backup/restore
Uji JSON, lampiran, checksum, file rusak/tidak lengkap, pemulihan perangkat yang sama, perangkat pengganti, deduplikasi event, dan rekonsiliasi. File berhasil diunduh bukan bukti restore berhasil.

### 18.6 Pengujian keamanan
Uji hak akses Owner/Sales, penolakan mutasi harga oleh Sales, otorisasi tindakan sensitif, penyimpanan PIN, validasi backend, perlindungan secret, dan akses data.

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
Keputusan berikut tidak boleh diisi dengan asumsi developer:

1. Formula alokasi landed cost ke produk/lot, perlakuan biaya yang datang terlambat, dan aturan pembulatan.
2. Kebijakan kapitalisasi biaya tenaga kerja atau biaya proses tambahan pada hasil konversi, jika fitur tersebut akan didukung; biaya tersebut tidak boleh ditambahkan tanpa definisi dan dasar alokasi yang disetujui.
3. State machine transaksi yang memisahkan status order, pemenuhan, serah-terima, dan pembayaran.
4. Kebijakan lot untuk saldo awal ketika riwayat lot lama tidak tersedia.
5. Matriks rinci kewenangan Sales dan tindakan yang memerlukan PIN/otorisasi Owner.
6. Batas nominal dan aturan pengecualian yang belum ditentukan.
7. Aturan tempo untuk pembayaran parsial/perubahan metode bayar dan urutan tempo terhadap clearance.
8. Pemulihan kuota clearance setelah retur.
9. Kebijakan retensi, cadence, dan verifikasi backup.
10. Pemilihan backend produksi dan detail autentikasi/otorisasi adapter.
11. Batas percobaan PIN gagal dan durasi lockout.
12. Kebijakan retur: konfirmasi apakah batas 1×24 jam dan ambang pemeriksaan Rp500.000 dari aturan terdahulu masih berlaku. PLAN aktif saat ini belum menetapkan kedua angka tersebut; jangan menganggapnya aktif tanpa konfirmasi.
13. Aturan pembulatan deterministik untuk pembagian biaya dan alokasi yang menghasilkan pecahan, termasuk pembagian COGS ke beberapa baris alokasi lot.
14. Workflow verifikasi dan konfirmasi setoran Sales setelah penghapusan role Admin; tentukan siapa yang menerima, memverifikasi, mengonfirmasi, dan menangani selisih tanpa membuat Owner menjadi bottleneck untuk aktivitas rutin.
15. Spesifikasi perangkat pendukung yang benar-benar ditargetkan untuk rilis: jenis scanner, model/protokol printer struk, lebar kertas, dan batas kompatibilitas perangkat.
16. Batas otorisasi stock adjustment: konfirmasi apakah ambang selisih lebih dari 2% lot atau lebih dari 5 kg dari aturan terdahulu masih berlaku. PLAN aktif saat ini hanya menyebut batas material yang harus ditetapkan.
17. Kebijakan pajak: konfirmasi apakah PPN 11% yang dapat dikonfigurasi dan PPh Final 0,5% untuk pelaporan dari aturan terdahulu masih relevan. PLAN aktif saat ini hanya menetapkan pajak configurable dan integrasi resmi di luar scope.
18. Daftar laporan minimum dan definisi setiap laporan. Pastikan apakah daftar R-01 sampai R-09 dari blueprint terdahulu masih menjadi standar atau perlu disusun ulang sesuai laporan yang sekarang tercantum.

### 19.3 Aturan penutupan keputusan
Setiap keputusan terbuka harus ditutup dengan nilai/aturan eksplisit, alasan, dampak pada data dan modul, serta kriteria pengujian. Setelah disetujui Owner, keputusan tersebut dimasukkan ke bagian spesifikasi terkait dan dihapus dari daftar terbuka. Jangan membuat Change Register yang mengharuskan pembaca menebak aturan mana yang berlaku.

---

## Pernyataan status dokumen

Dokumen ini merupakan draft konsolidasi mandiri. Dokumen ini belum menjadi persetujuan final atas seluruh keputusan terbuka dan tidak menyatakan implementasi telah lulus audit. Sebelum dijadikan PLAN.md utama, lakukan pemeriksaan silang terhadap keputusan bisnis yang sudah disepakati, source code aktif, dan dokumen UI/UX. Perubahan ke dokumen utama hanya dilakukan setelah draft ini disetujui.
