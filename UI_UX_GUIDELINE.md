# UI/UX Guideline — ERP DAGING

**Status:** Baseline desain terkunci untuk implementasi PWA  
**Prioritas:** Mobile-first · Clean Luxury · Simple Workflow  
**Batas:** Dokumen ini mengatur pengalaman dan presentasi UI; tidak mengubah aturan bisnis, skema data, otorisasi, atau arsitektur Local-First.

## 1. Arah Produk

- **Mobile-first PWA.** HP adalah acuan utama karena Owner, Admin, dan Sales sering bekerja melalui smartphone. Desktop adalah adaptasi responsif, bukan sumber desain utama.
- **Clean Luxury.** Tampilan harus modern, bersih, elegan, matang, dan profesional. Simple berarti mudah digunakan, bukan visual polos atau murah.
- **Simple Workflow.** Pekerjaan rutin diselesaikan dengan langkah sesedikit mungkin, istilah yang mudah dipahami, input seperlunya, default masuk akal, dan validasi otomatis.
- **Professional by Default.** UI operasional tetap ringan; laporan, HPP, ledger, audit trail, dan kontrol bisnis tetap lengkap.
- Prinsip ringkas: **Premium Look. Effortless Experience.**

## 2. Visual System

- Dasar putih bersih atau ivory/off-white; navy atau charcoal sebagai warna utama.
- Champagne gold hanya aksen terbatas, bukan warna dominan.
- Tipografi modern dan jelas dengan hierarki konsisten untuk judul, label, angka, dan status.
- Spacing lega, alignment rapi, ikon konsisten, radius halus, border tipis, dan shadow lembut seperlunya.
- Status berhasil, peringatan, gagal, stok menipis, dan mendekati kedaluwarsa harus dibedakan melalui warna **dan** teks/ikon.
- Hindari ornamen berlebihan, gradient mencolok, terlalu banyak warna, grafik dekoratif, kartu bertumpuk tanpa fungsi, teks terlalu kecil, dan layar padat.
- Visual premium tidak boleh mengorbankan performa, aksesibilitas, keterbacaan, atau kenyamanan perangkat kelas menengah.

## 3. Mobile Interaction

- Navigasi utama memakai **bottom navigation** untuk akses ibu jari. Menu sekunder dan fungsi jarang dipakai masuk ke halaman "Lainnya" atau menu kontekstual.
- Aksi utama ditempatkan di area mudah dijangkau; target sentuh nyaman dan jarak antartombol mencegah salah tekan.
- Form ringkas, satu kolom bila sesuai, pilihan/default otomatis, pencarian, keypad numerik, dan validasi dekat field.
- Hindari tabel lebar di HP. Gunakan daftar/ringkasan yang mudah dipindai; detail lengkap dibuka pada halaman detail atau bagian expandable.
- Berat, harga, total transaksi, stok, piutang, dan utang harus mudah dibaca dengan format konsisten.
- Setiap aksi memberi feedback jelas: loading, berhasil, gagal, perlu tindakan, atau tersimpan lokal dan menunggu sinkronisasi.
- Jangan bergantung pada hover. Fungsi penting harus bisa digunakan dengan sentuhan dan keyboard.
- Perhatikan safe area, keyboard virtual, orientasi layar, koneksi tidak stabil, PWA terpasang, dan browser.

## 4. Pengalaman per Role

### Sales
Fokus pada penjualan. Alur utama: pilih pelanggan (atau pelanggan umum) → pilih produk → masukkan berat/jumlah → periksa ringkasan → pilih pembayaran → simpan dan tampilkan bukti transaksi. Opsi tambahan hanya muncul saat relevan. Jangan tampilkan menu administrasi.

### Admin
Fokus pada pembelian/penerimaan, persediaan, pelanggan/supplier, piutang/utang, dan OPEX. Aksi rutin dibuat langsung dan jelas; kontrol tambahan muncul hanya saat kondisi transaksi memerlukannya.

### Owner
Fokus pada ringkasan usaha, laporan, kebijakan, pengguna, dan pengecualian yang benar-benar membutuhkan perhatian. Owner bukan bottleneck untuk pekerjaan rutin yang bisa divalidasi otomatis.

Hak akses tetap mengikuti role. Menyederhanakan tampilan tidak boleh mengurangi otorisasi, validasi, pencatatan, atau audit trail.

## 5. Desktop

- Gunakan ruang layar untuk navigasi samping, ringkasan multi-kolom, dan tabel yang memang relevan.
- Struktur informasi, istilah, aturan bisnis, dan hasil transaksi harus konsisten dengan HP.
- Jangan membuat workflow bisnis berbeda karena ukuran layar; perbedaan hanya pada layout dan penyajian.

## 6. Aturan Implementasi

1. Business Engine tetap satu-satunya sumber aturan bisnis dan validasi transaksi.
2. Komponen UI tidak boleh membuat aturan transaksi tandingan.
3. Jangan mengubah keputusan bisnis untuk menyederhanakan tampilan. Jika UI bertentangan dengan aturan bisnis, pertahankan aturan bisnis dan perbaiki UI.
4. Jangan menambah approval untuk aktivitas rutin yang tidak membutuhkan kontrol nyata.
5. Gunakan validasi otomatis, pencatatan, dan kontrol berbasis pengecualian.
6. Laporan tetap profesional dan lengkap meskipun layar operasional dibuat ringkas.
7. Detail final bottom navigation, dashboard, POS, tipografi, dan token desain ditetapkan setelah diuji pada HP nyata; contoh mockup bukan keputusan menu final.

## 7. Acceptance Checklist

- [ ] Sales dapat menyelesaikan transaksi utama dengan alur ringkas.
- [ ] Admin dapat menyelesaikan pekerjaan rutin tanpa approval yang tidak perlu.
- [ ] Owner dapat melihat ringkasan dan menangani pengecualian tanpa menjadi bottleneck.
- [ ] Layout diuji pada HP kecil, HP umum, dan desktop.
- [ ] Alur diuji saat offline, keyboard terbuka, validasi gagal, dan sinkronisasi tertunda.
- [ ] Semua target sentuh nyaman dan tidak ada fungsi penting yang bergantung pada hover.
- [ ] Status selalu terbaca melalui teks/ikon, bukan warna saja.
- [ ] Perilaku bisnis UI sama dengan Business Engine.
