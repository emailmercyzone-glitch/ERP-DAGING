# UI/UX Guideline — ERP DAGING

**Status:** Baseline desain untuk implementasi PWA  
**Prioritas:** Mobile-first · Clean Luxury · Visual Analytics · Simple Workflow  
**Pola penggunaan:** Sekitar 75% penggunaan melalui HP dan 25% melalui desktop; angka ini menjadi acuan desain dari kebutuhan operasional saat ini, bukan batas teknis.  
**Batas:** Dokumen ini mengatur pengalaman dan presentasi UI; tidak mengubah aturan bisnis, skema data, otorisasi, atau arsitektur Local-First.

## 1. Arah Produk

- **Mobile-first PWA.** HP adalah acuan utama desain karena mayoritas penggunaan dilakukan melalui smartphone. Desktop merupakan adaptasi responsif yang memanfaatkan ruang lebih luas, bukan sumber desain utama.
- **Clean Luxury.** Tampilan modern, bersih, elegan, matang, dan profesional. Simple berarti mudah digunakan, bukan visual polos atau murah.
- **Visual Analytics.** Gunakan grafik, diagram, indikator, dan tabel ringkas untuk membantu pengguna memahami kondisi bisnis dengan cepat. Visualisasi harus menjelaskan data, bukan menjadi dekorasi.
- **Simple Workflow.** Pekerjaan rutin diselesaikan dengan langkah sesedikit mungkin, istilah mudah dipahami, input seperlunya, default masuk akal, dan validasi otomatis.
- **Professional by Default.** UI operasional tetap ringan; laporan, HPP, ledger, audit trail, dan kontrol bisnis tetap lengkap.
- Prinsip ringkas: **Premium Look. Effortless Experience. Professional Business Insight.**

## 2. Visual System

- Dasar putih bersih atau ivory/off-white; navy atau charcoal sebagai warna utama.
- Champagne gold hanya aksen terbatas, bukan warna dominan.
- Tipografi modern dan jelas dengan hierarki konsisten untuk judul, label, angka, dan status.
- Spacing lega, alignment rapi, ikon konsisten, radius halus, border tipis, dan shadow lembut seperlunya.
- Gunakan line/bar chart untuk tren dan perbandingan, donut chart untuk komposisi, stacked/progress bar untuk proporsi atau umur tagihan, serta tabel/list untuk detail yang perlu ditindaklanjuti.
- Grafik harus memiliki judul, periode, satuan, legenda yang jelas, dan akses ke rincian bila relevan. Jangan mengandalkan warna saja untuk membedakan seri atau status.
- Donut chart sebaiknya menampilkan total atau angka utama di tengah jika membantu pembacaan. Hindari terlalu banyak irisan; kelompok kecil dapat digabung secara bermakna tanpa menyembunyikan risiko penting.
- Status berhasil, peringatan, gagal, stok menipis, dan mendekati kedaluwarsa dibedakan melalui warna **dan** teks/ikon.
- Hindari ornamen berlebihan, gradient mencolok, terlalu banyak warna, grafik dekoratif, kartu bertumpuk tanpa fungsi, teks terlalu kecil, dan layar padat.
- Visual premium tidak boleh mengorbankan performa, aksesibilitas, keterbacaan, atau kenyamanan perangkat kelas menengah. Animasi seperlunya, singkat, dan tidak menghambat interaksi.

## 3. Mobile Interaction

- Navigasi utama memakai **bottom navigation** untuk akses ibu jari. Menu sekunder dan fungsi jarang dipakai masuk ke halaman "Lainnya" atau menu kontekstual.
- Aksi utama ditempatkan di area mudah dijangkau; target sentuh nyaman dan jarak antartombol mencegah salah tekan.
- Form ringkas, satu kolom bila sesuai, pilihan/default otomatis, pencarian, keypad numerik, dan validasi dekat field.
- Hindari tabel lebar di HP. Gunakan ringkasan, daftar, tabel responsif, atau kartu baris yang mudah dipindai; detail lengkap dibuka pada halaman detail atau bagian expandable.
- Berat, harga, total transaksi, stok, piutang, dan utang harus mudah dibaca dengan format konsisten.
- Grafik pada HP ditampilkan satu kolom dan menggunakan lebar layar secara efektif. Label, legenda, tooltip/popup sentuh, dan angka tidak boleh terpotong atau membutuhkan hover. Jangan memaksa dua grafik kecil berdampingan jika membuatnya sulit dibaca.
- Filter periode dan kontrol penting mudah dijangkau. Hindari scroll horizontal untuk membaca grafik atau data inti.
- Setiap aksi memberi feedback jelas: loading, berhasil, gagal, perlu tindakan, atau tersimpan lokal dan menunggu sinkronisasi.
- Jangan bergantung pada hover. Fungsi penting harus bisa digunakan dengan sentuhan dan keyboard.
- Perhatikan safe area, keyboard virtual, orientasi layar, koneksi tidak stabil, PWA terpasang, dan browser.

## 4. Pengalaman per Role

ERP DAGING menggunakan tiga role utama:

### Owner

Owner sekaligus menjalankan fungsi administrasi dan pengendalian bisnis. Tidak ada role Admin terpisah.

Fokus Owner:
- Ringkasan kondisi bisnis dan analisis kinerja.
- Pengelolaan produk, pelanggan, supplier, pembelian, persediaan, piutang/utang, OPEX, dan administrasi sesuai hak akses.
- Laporan, kebijakan, pengguna/perangkat, audit, dan pengecualian yang membutuhkan perhatian.
- Pemantauan kasir, gudang, stok, umur lot, sinkronisasi, dan backup.

Owner tidak boleh menjadi bottleneck untuk pekerjaan rutin yang dapat divalidasi dan dicatat otomatis.

### Kasir

Fokus pada penjualan dan pelayanan pelanggan. Alur utama: pilih pelanggan (atau pelanggan umum) → pilih produk → masukkan berat/jumlah → periksa ringkasan → pilih pembayaran → simpan dan tampilkan bukti transaksi. Tampilkan ringkasan penjualan, transaksi, status pembayaran, dan informasi yang relevan dengan tugas kasir. Jangan tampilkan menu administrasi atau kontrol Owner.

### Gudang

Fokus pada penerimaan barang, lot, persediaan, pergerakan stok, FEFO, dan kondisi barang. Tampilkan tugas gudang, stok kritis, lot mendekati kedaluwarsa, karantina, serta aktivitas persediaan yang relevan. Aksi harus mengikuti hak akses Gudang.

Hak akses tetap mengikuti role. Menyederhanakan tampilan tidak boleh mengurangi otorisasi, validasi, pencatatan, atau audit trail.

## 5. Dashboard Owner

### 5.1 Tujuan

Dashboard Owner adalah **pusat kendali bisnis**, bukan sekadar kumpulan KPI atau laporan yang diperkecil. Owner harus cepat memahami performa usaha, posisi modal, risiko stok, kewajiban, dan aktivitas yang membutuhkan tindakan.

Dashboard boleh memiliki konten lebih lengkap dan dapat di-scroll, tetapi hierarki visual harus jelas. Informasi paling penting tampil lebih dahulu; rincian ditampilkan saat dibutuhkan.

### 5.2 Empat KPI utama

Empat KPI utama selalu menjadi bagian paling atas dan menggunakan komposisi seimbang dalam grid 2 × 2 pada HP:

1. **Omzet**
2. **Laba kotor**
3. **Piutang**
4. **Persediaan**

Setiap KPI menampilkan nilai utama, label periode/jenis saldo, dan perbandingan yang relevan. Jangan menampilkan angka tanpa konteks.

Definisi penyajian:
- Omzet: total penjualan bersih sesuai aturan Business Engine untuk periode terpilih.
- Laba kotor: omzet bersih dikurangi HPP yang relevan. Jika data HPP belum lengkap atau belum valid, tampilkan status keterbatasan; jangan menyajikan angka seolah final.
- Piutang: saldo piutang pada akhir periode atau posisi terkini, bukan total transaksi piutang yang terjadi selama periode.
- Persediaan: nilai stok berdasarkan HPP lot pada akhir periode atau posisi terkini, bukan nilai harga jual.

### 5.3 Pemilih periode dan perbandingan historis

Sediakan pilihan periode yang mudah dijangkau:
- Hari ini
- 7 hari
- 14 hari
- 30 hari

Pemilihan periode mengubah angka dan visualisasi analisis yang memang bersifat periodik, bukan hanya mengganti label tanggal.

Aturan perbandingan:
- Hari ini dibandingkan dengan hari sebelumnya pada batas waktu yang setara untuk periode berjalan.
- 7 hari dibandingkan dengan 7 hari sebelumnya.
- 14 hari dibandingkan dengan 14 hari sebelumnya.
- 30 hari dibandingkan dengan 30 hari sebelumnya.
- Tampilkan nilai periode pembanding dan persentase perubahan bila perhitungan bermakna. Tangani nilai dasar nol agar tidak menghasilkan persentase yang menyesatkan.
- Omzet dan laba kotor menggunakan akumulasi transaksi dalam periode.
- Piutang dan persediaan menggunakan posisi saldo pada akhir periode, lalu dibandingkan dengan posisi saldo pada akhir periode pembanding.
- Gunakan zona waktu bisnis WIB secara konsisten.
- Periode historis harus bersumber dari data/ledger yang dapat merekonstruksi posisi historis. Jangan menampilkan snapshot hari ini seolah-olah merupakan saldo masa lalu.
- Untuk hari berjalan, jelaskan bahwa periode belum selesai dan bandingkan pada waktu yang setara.

Pemilih periode berlaku untuk analisis historis dashboard. **Peringatan operasional yang membutuhkan tindakan tetap menunjukkan kondisi terkini**, walaupun Owner sedang melihat periode 7, 14, atau 30 hari.

### 5.4 Urutan konten dashboard

Urutan awal yang direkomendasikan:

1. Header: identitas Owner, tanggal, notifikasi, dan status sinkronisasi ringkas.
2. Empat KPI utama.
3. Tren penjualan dan laba: line/bar chart dengan periode berjalan dan pembanding.
4. Persediaan dan risiko lot: komposisi stok serta daftar lot prioritas.
5. Piutang dan utang: saldo, umur tagihan, dan jatuh tempo.
6. Arus uang dan setoran: uang masuk/keluar, setoran kasir, dan OPEX.
7. Performa produk dan aktivitas operasional.
8. Kesehatan sistem: status sinkronisasi, antrean media, dan backup.

Urutan dan kepadatan akhir dapat disempurnakan setelah diuji pada perangkat nyata, tetapi empat KPI tetap berada di bagian atas.

### 5.5 Visualisasi yang direkomendasikan

- Tren omzet/laba: line chart atau bar chart dengan pembanding periode sebelumnya.
- Komposisi persediaan: donut chart untuk kategori status atau kelompok produk yang jelas.
- Umur piutang: stacked bar atau bar chart berdasarkan kelompok umur/jatuh tempo.
- Utang jatuh tempo: ringkasan progres/bar dan daftar kewajiban terdekat.
- Risiko kedaluwarsa: tabel/list prioritas per lot; dapat disertai bar ringkas berdasarkan kilogram atau nilai HPP yang terdampak.
- Performa produk: horizontal bar chart untuk produk teratas berdasarkan metrik yang dipilih.
- Arus kas: bar/area chart bila definisi arus uang dan periodenya jelas.

Tidak semua data harus menjadi grafik. Gunakan tabel/list untuk data yang membutuhkan identifikasi dan tindakan, khususnya nomor lot, tanggal, berat, nilai HPP, pelanggan, dan tagihan.

### 5.6 Pemantauan stok dan kedaluwarsa

Pemantauan dilakukan **per lot**, bukan hanya per nama produk atau total stok.

Informasi ringkas yang perlu tersedia:
- Nama produk dan identitas lot.
- Sisa berat (kg).
- Tanggal kedaluwarsa/batas masa simpan yang tercatat.
- Sisa hari.
- Nilai HPP stok yang terdampak.
- Status dan tindakan/tautan ke detail.

Tampilkan lot yang paling mendesak lebih dahulu. Integrasikan dengan prinsip FEFO agar lot dengan batas masa simpan terdekat diprioritaskan dalam alur pengeluaran stok sesuai aturan bisnis.

Batas status waspada/mendesak/kritis harus mengikuti konfigurasi dan dasar masa simpan yang sah untuk produk tersebut. Jangan menganggap satu ambang hari berlaku universal untuk semua jenis daging. Barang yang melewati batas keamanan pangan harus masuk pemeriksaan/penanganan sesuai aturan; jangan otomatis diarahkan untuk dijual diskon.

### 5.7 Interaksi dan kejujuran data

- Grafik dan KPI yang dapat ditelusuri harus membuka rincian yang mendasarinya.
- Klik/tap peringatan langsung menuju lot, transaksi, pelanggan, tagihan, atau antrean yang perlu ditangani.
- Bedakan data tersimpan lokal, menunggu sinkronisasi, sudah tersinkron, dan gagal.
- Jangan menyamakan status sinkronisasi dengan status backup.
- Tampilkan waktu pembaruan data bila relevan, khususnya pada data yang dapat tertunda karena offline.
- Jika data tidak lengkap, belum tersinkron, atau tidak cukup untuk perhitungan yang valid, tampilkan keterbatasannya secara eksplisit.

## 6. Desktop

- Gunakan ruang layar untuk navigasi samping, ringkasan multi-kolom, grafik berdampingan jika tetap terbaca, dan tabel yang memang relevan.
- Struktur informasi, istilah, aturan bisnis, dan hasil transaksi harus konsisten dengan HP.
- Jangan membuat workflow bisnis berbeda karena ukuran layar; perbedaan hanya pada layout dan penyajian.
- Dashboard Owner desktop boleh menampilkan lebih banyak detail sekaligus, tetapi tidak boleh mengubah definisi KPI, periode, atau perilaku analisis.

## 7. Aturan Implementasi

1. Business Engine tetap satu-satunya sumber aturan bisnis dan validasi transaksi.
2. Komponen UI tidak boleh membuat aturan transaksi tandingan atau menghitung ulang metrik bisnis dengan definisi berbeda.
3. Jangan mengubah keputusan bisnis untuk menyederhanakan tampilan. Jika UI bertentangan dengan aturan bisnis, pertahankan aturan bisnis dan perbaiki UI.
4. Jangan menambah approval untuk aktivitas rutin yang tidak membutuhkan kontrol nyata.
5. Gunakan validasi otomatis, pencatatan, dan kontrol berbasis pengecualian.
6. Laporan tetap profesional dan lengkap meskipun layar operasional dibuat ringkas.
7. Visualisasi harus memakai data aktual dari sumber yang benar, memiliki definisi metrik dan periode yang jelas, serta tidak memakai angka ilustrasi pada aplikasi produksi.
8. Detail final bottom navigation, layout dashboard, POS, tipografi, dan token desain ditetapkan setelah diuji pada HP nyata; contoh mockup bukan keputusan menu final.
9. Perubahan periode dashboard tidak boleh mengubah data transaksi atau status operasional. Periode historis hanya mengubah sudut pandang analisis.

## 8. Acceptance Checklist

- [ ] Tiga role yang digunakan adalah Owner, Kasir, dan Gudang; tidak ada role Admin terpisah.
- [ ] Owner dapat mengakses fungsi administrasi sesuai kewenangannya tanpa menjadi bottleneck untuk pekerjaan rutin.
- [ ] Dashboard Owner menampilkan empat KPI utama: omzet, laba kotor, piutang, dan persediaan.
- [ ] Pemilih periode Hari ini, 7 hari, 14 hari, dan 30 hari mengubah angka serta grafik yang relevan.
- [ ] Perbandingan periode menggunakan rentang dan batas waktu yang setara.
- [ ] Saldo piutang dan persediaan historis benar-benar merepresentasikan posisi akhir periode.
- [ ] Grafik dapat dibaca dan dioperasikan melalui sentuhan pada HP tanpa hover atau scroll horizontal.
- [ ] Risiko kedaluwarsa ditampilkan per lot beserta berat, tanggal, sisa hari, dan nilai HPP bila tersedia.
- [ ] Peringatan operasional tetap menunjukkan kondisi terkini walaupun filter analisis historis berubah.
- [ ] KPI, grafik, dan peringatan dapat ditelusuri ke data rinci yang mendasarinya.
- [ ] Layout diuji pada HP kecil, HP umum, dan desktop dengan prioritas pengalaman HP.
- [ ] Alur diuji saat offline, keyboard terbuka, validasi gagal, dan sinkronisasi tertunda.
- [ ] Semua target sentuh nyaman dan tidak ada fungsi penting yang bergantung pada hover.
- [ ] Status selalu terbaca melalui teks/ikon, bukan warna saja.
- [ ] Perilaku bisnis UI sama dengan Business Engine.
