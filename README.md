# smart.sts - Sistem Raport STS SMP Islam Smart

Sistem Pengisian Raport Sumatif Tengah Semester (STS) terintegrasi untuk **SMP Islam Smart**. Aplikasi dirancang khusus untuk memudahkan koordinasi antara Guru Mata Pelajaran, Wali Kelas, dan Administrator dalam mengelola nilai siswa, menghasilkan deskripsi capaian pembelajaran otomatis (maupun kustom), serta memfasilitasi cetak cetak cetak raport langsung atau ekspor dokumen Microsoft Word (.doc).

---

## 🌟 Fitur Utama

- **Akses Multi-Role Terpadu**:
  - **Administrator**: Mengelola data Guru, Siswa, setelan instansi (Kepala Sekolah, NIP, Semester, Tahun Pelajaran), kontrol gaya cetak, serta visibilitas elemen raport.
  - **Guru Mata Pelajaran (Mapel)**: Melakukan penginputan nilai kriteria (nilai akhir, usaha, proses, capaian) dan memilih/menambahkan Tujuan Pembelajaran yang diujikan secara taktis.
  - **Wali Kelas**: Memantau progres kelengkapan nilai siswa di kelasnya, mengisi kehadiran siswa (Sakit, Izin, Alpa), memberikan penilaian Sikap (Spiritual & Sosial), serta menulis Catatan Wali Kelas.
- **Auto-Kalkulasi Predikat & Capaian**:
  - Konfigurasi kriteria rentang nilai baru yang presisi:
    - **Nilai > 91**: Predikat **A**
    - **Nilai >= 85**: Predikat **B**
    - **Nilai < 85**: Predikat **C**
- **Dashboard Progress Real-time**: Menampilkan persentase kelengkapan data per mata pelajaran dan per kelas secara intuitif.
- **Template Deskripsi & Capaian Otomatis**: Memilih TP (Tujuan Pembelajaran) yang langsung dirakit menjadi teks deskripsi komprehensif di lembar raport.
- **Cetak & Ekspor Dokumen**:
  - Cetak langsung via browser dengan desain CSS Media Print kustom yang rapi dan elegan.
  - Ekspor raport ke format Microsoft Word (`.doc`) dengan struktur tabel presisi.
- **Tema Gelap & Terang Teroptimalisasi**: Dilengkapi kontras tinggi dalam mode Dark Mode (tulisan kuning/putih berjelas) dan tampilan visual kertas asli pada pratinjau lembar raport.

---

## 🛠️ Teknologi yang Digunakan

- **Frontend**: React (v19+), Vite, Tailwind CSS (v4)
- **Backend & Dev Tooling**: Express, TypeScript, tsx, esbuild
- **Library Animasi & Ikon**: Motion, Lucide-React

---

## 🚀 Cara Menjalankan Project Secara Lokal

### prasyarat
- Node.js (versi 18 ke atas disarankan)
- npm (Node Package Manager)

### 1. Instalasi Dependensi
Jalankan perintah berikut di direktori root project untuk menginstal semua paket dependensi:
```bash
npm install
```

### 2. Menjalankan Server Pengembangan (Dev)
Gunakan perintah berikut untuk memulai server dalam mode pengembangan:
```bash
npm run dev
```
Aplikasi akan berjalan dan dapat diakses di `http://localhost:3000`.

### 3. Membangun Aplikasi untuk Produksi
Untuk mengompilasi dan mengikat backend dan frontend ke dalam folder `dist/` siap rilis:
```bash
npm run build
```

### 4. Menjalankan Aplikasi Hasil Build
Setelah proses build selesai, jalankan aplikasi menggunakan perintah:
```bash
npm run start
```

---

*SMP Islam Smart - Menuju Digitalisasi Pendidikan yang Terintegrasi, Mandiri, dan Unggul.*
