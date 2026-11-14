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

ERP DAGING menggunakan **dua role utama saja: Owner dan Staff**. Tidak ada role Kasir, Sales, Gudang, atau Admin yang terpisah.

### Owner

Owner mengelola dan mengawasi seluruh bisnis.

Fokus Owner:
- Ringkasan kondisi bisnis dan analisis kinerja.
- Pengelolaan produk, pelanggan, supplier, pembelian, persediaan, piutang/utang, OPEX, dan administrasi.
- Laporan, kebijakan, pengguna/perangkat, audit, dan pengecualian yang membutuhkan perhatian.
- Pemantauan seluruh aktivitas Staff, stok, umur lot, sinkronisasi, dan backup.

Owner tidak boleh menjadi bottleneck untuk pekerjaan rutin yang dapat divalidasi dan dicatat otomatis.

### Staff

**Staff adalah satu-satunya role operasional.** Satu Staff dapat melakukan penjualan/kasir sekaligus pekerjaan gudang sesuai kebutuhan usaha. Jangan memisahkan orang menjadi role Sales, Kasir, atau Gudang hanya karena jenis tugasnya berbeda.

Staff dapat:
- Melayani customer dan membuat transaksi penjualan, baik di toko maupun langsung di lokasi customer melalui HP.
- Menerima dan mencatat pembayaran tunai/transfer serta melakukan tindak lanjut tagihan customer.
- Mengambil, menyiapkan, dan menyerahkan barang dari gudang.
- Melakukan pekerjaan operasional persediaan yang memang diperlukan, seperti penerimaan barang dan pencatatan aktivitas stok, sesuai kontrol sistem.
- Menyimpan transaksi saat offline sesuai kemampuan Local-First, lalu menyinkronkannya saat koneksi tersedia.

Gunakan satu akun Staff per orang. Tidak perlu akun ganda atau berganti role ketika orang yang sama mengerjakan penjualan dan pekerjaan gudang. Setiap transaksi dan aktivitas tetap mencatat Staff yang benar-benar melakukannya agar tanggung jawab dan audit trail jelas.

Dashboard Staff dibuat ringkas dan berorientasi tindakan: **Transaksi Baru**, ringkasan aktivitas milik Staff tersebut, Tagihan Saya, Setoran Saya, transaksi terakhir, serta tugas/aktivitas stok yang relevan. Jangan memaksakan dashboard terpisah berdasarkan jabatan Sales/Kasir/Gudang.

Hak akses Owner dan Staff tetap dibedakan. Penyederhanaan menjadi satu role Staff tidak boleh menghilangkan pencatatan, validasi, atau kontrol atas aktivitas sensitif; gunakan validasi dan kontrol berbasis pengecualian, bukan menambah role atau approval berlapis.

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

## 6. Dashboard Staff

### 6.1 Tujuan dan prioritas

Dashboard Staff adalah **ruang kerja penjualan**, bukan dashboard analisis perusahaan. Prioritas tertinggi adalah memulai transaksi dengan cepat, baik di toko maupun di lokasi customer. Satu dashboard dan satu role berlaku untuk seluruh Sales; data personal difilter berdasarkan akun Staff yang sedang login.

Urutan konten yang direkomendasikan pada HP:

1. Header singkat, tanggal, dan status koneksi/sinkronisasi.
2. Tombol utama **Transaksi Baru** yang paling menonjol.
3. Ringkasan hari ini: omzet, jumlah transaksi, kg terjual, dan uang yang diterima.
4. Bagian **Tagihan Saya**: customer, sisa piutang, jatuh tempo, dan akses untuk mencatat pembayaran.
5. Bagian **Setoran Saya**: uang penjualan yang sudah diterima dan status penyetorannya sesuai alur bisnis.
6. Transaksi terakhir dengan status pembayaran yang mudah dipindai.
7. Grafik aktivitas/penjualan sederhana sebagai informasi sekunder, bukan elemen yang mengalahkan tombol transaksi.

Jangan memenuhi layar pertama dengan banyak KPI atau grafik. Informasi yang membutuhkan tindakan (tagihan dan setoran) harus jelas, tetapi tetap berada setelah aksi transaksi dan ringkasan utama.

### 6.2 Identitas transaksi dan penagihan

Setiap transaksi menyimpan setidaknya dua identitas yang berbeda secara makna:

- **Deal oleh / Sales penanggung jawab:** Staff yang melakukan penjualan dan menjadi penanggung jawab awal transaksi serta tindak lanjut piutangnya.
- **Pembayaran diterima oleh:** pengguna yang benar-benar menerima atau mencatat penerimaan uang. Nilai ini dapat berbeda dari Sales penanggung jawab.

Contoh: Pak Hendra membeli secara tempo dari Sales A. Transaksi dan piutang menjadi tanggung jawab Sales A. Jika pembayaran kemudian diterima Sales B, penerimaan dicatat atas Sales B, sedangkan Sales A tetap tercatat sebagai Sales yang melakukan deal. Riwayat transaksi tidak boleh tertimpa.

Customer dapat memiliki Staff PIC/default untuk memudahkan penugasan dan pelayanan. Namun Sales PIC customer tidak boleh otomatis menggantikan Sales pelaksana pada transaksi. Sistem harus mencatat Sales yang benar-benar melakukan deal.

Jika tanggung jawab penagihan dialihkan, simpan Staff penanggung jawab sebelumnya, Staff penerima pengalihan, waktu, dan pelaku perubahan. Pengalihan adalah pencatatan operasional, bukan alasan menambah rangkaian approval rutin.

### 6.3 Dashboard Owner untuk pemantauan Sales

Owner dapat melihat ringkasan gabungan dan per Staff, minimal omzet, jumlah transaksi, kg terjual, saldo piutang yang menjadi tanggung jawab Sales, serta pembayaran yang berhasil ditagih. Rincian harus dapat ditelusuri ke transaksi dan riwayat pembayaran. Metrik ini untuk transparansi dan pemantauan, bukan membuat prosedur kompetisi atau approval baru.

## 7. Desktop

- Gunakan ruang layar untuk navigasi samping, ringkasan multi-kolom, grafik berdampingan jika tetap terbaca, dan tabel yang memang relevan.
- Struktur informasi, istilah, aturan bisnis, dan hasil transaksi harus konsisten dengan HP.
- Jangan membuat workflow bisnis berbeda karena ukuran layar; perbedaan hanya pada layout dan penyajian.
- Dashboard Owner desktop boleh menampilkan lebih banyak detail sekaligus, tetapi tidak boleh mengubah definisi KPI, periode, atau perilaku analisis.

## 8. Aturan Implementasi

1. Business Engine tetap satu-satunya sumber aturan bisnis dan validasi transaksi.
2. Komponen UI tidak boleh membuat aturan transaksi tandingan atau menghitung ulang metrik bisnis dengan definisi berbeda.
3. Jangan mengubah keputusan bisnis untuk menyederhanakan tampilan. Jika UI bertentangan dengan aturan bisnis, pertahankan aturan bisnis dan perbaiki UI.
4. Jangan menambah approval untuk aktivitas rutin yang tidak membutuhkan kontrol nyata.
5. Gunakan validasi otomatis, pencatatan, dan kontrol berbasis pengecualian.
6. Laporan tetap profesional dan lengkap meskipun layar operasional dibuat ringkas.
7. Visualisasi harus memakai data aktual dari sumber yang benar, memiliki definisi metrik dan periode yang jelas, serta tidak memakai angka ilustrasi pada aplikasi produksi.
8. Detail final bottom navigation, layout dashboard, POS, tipografi, dan token desain ditetapkan setelah diuji pada HP nyata; contoh mockup bukan keputusan menu final.
9. Perubahan periode dashboard tidak boleh mengubah data transaksi atau status operasional. Periode historis hanya mengubah sudut pandang analisis.

## 9. Acceptance Checklist

- [ ] Hanya ada dua role: Owner dan Staff; tidak ada role Kasir, Sales, Gudang, atau Admin yang terpisah.
- [ ] Satu akun Staff dapat melakukan penjualan/kasir sekaligus pekerjaan gudang sesuai kebutuhan tanpa berganti role atau memakai akun ganda.
- [ ] Owner dapat mengakses fungsi administrasi dan seluruh laporan tanpa menjadi bottleneck untuk pekerjaan rutin.
- [ ] Dashboard Staff ringkas, memprioritaskan Transaksi Baru, Tagihan Saya, Setoran Saya, aktivitas penjualan, dan tugas stok yang relevan.
- [ ] Transaksi menyimpan identitas Sales yang melakukan deal secara terpisah dari pengguna yang menerima pembayaran.
- [ ] Piutang mengikuti Staff penanggung jawab transaksi; penerimaan pembayaran oleh Sales lain tidak mengubah identitas Sales yang melakukan deal.
- [ ] Customer dapat memiliki Staff PIC/default tanpa menimpa identitas Sales pelaksana pada transaksi.
- [ ] Pengalihan tanggung jawab penagihan menyimpan riwayat dan tidak menambah approval rutin berlapis.
- [ ] Owner dapat memantau performa dan piutang per Staff maupun gabungan seluruh Sales.
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
