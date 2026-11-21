# Apoteku — Platform Layanan Farmasi Digital 💊🇮🇩

> **Pemilik Produk (Product Owner):** Rabiatul Adawiah, S.Farm., Apt.  
> **Komponen Sistem:** Mobile Application (PWA Pasien) + Web Dashboard (Apoteker & Administrator) + Integrasi WhatsApp  
> **Dukungan Bahasa:** 🇮🇩 Bahasa Indonesia (ID) & 🇬🇧 English (EN)

Platform layanan farmasi digital yang menghubungkan pasien dengan tenaga kefarmasian (apoteker klinis) untuk mempermudah akses layanan kefarmasian, mengelola jadwal penggunaan obat, meningkatkan kepatuhan terapi, memantau tekanan darah (khususnya pada kehamilan risiko preeklampsia), serta menyusun laporan Pemantauan Terapi Obat (PTO).

---

## ✨ Fitur Utama (Produk Penuh — Sesuai PRD v1.0)

### 1. Portal Pasien (Mobile-First PWA)
- **Manajemen Akun & Profil Klinis (`/profile`)**: Pengelolaan data pribadi, HPL/usia kehamilan, diagnosis, riwayat alergi obat, dan pengaturan pengingat.
- **Katalog Layanan Farmasi & Direktori Apoteker (`/services`)**: Melihat layanan kefarmasian (*Pemantauan Terapi Obat / PTO, Telefarmasi, Rekonsiliasi Obat, Konseling Kepatuhan, Home Pharmacy Care*), melihat kredensial resmi apoteker (`STRA` & `SIPA`), dan mengajukan jadwal layanan.
- **Jadwal Pengobatan Mandiri & Resep (`/medications`)**: Pasien dapat menambahkan/mengubah sendiri jadwal pengobatan dan jam alarm obat maupun mengikuti regimen yang diresepkan apoteker.
- **Alarm Obat Interaktif & Pengingat Terintegrasi**:
  - Alarm suara & visual in-app dengan tombol *Sudah Diminum* dan *Tunda 10 Menit (Snooze)*.
  - Notifikasi *Web Push (VAPID)*.
  - Pengingat otomatis melalui **WhatsApp**.
- **Pelaporan & Riwayat Penggunaan Obat (`/`, `/medications`)**: Konfirmasi minum obat atau alasan melewati dosis, indikator kepatuhan 30 hari, serta log riwayat penggunaan obat dari waktu ke waktu.
- **Pemantauan Tekanan Darah (`/blood-pressure`)**: Pencatatan sistolik, diastolik, nadi, klasifikasi triase otomatis, dan peringatan otomatis ke WhatsApp bila tekanan darah tinggi/kritis.
- **Konsultasi Real-Time & Edukasi (`/chat`, `/education`, `/surveys`)**: Live chat dengan apoteker, tombol langsung ke WhatsApp apoteker, artikel edukasi dwibahasa (ID/EN), dan kuesioner kepatuhan (ARMS).

### 2. Dasbor Apoteker (`/staff`)
- **Daftar Pasien Tanggung Jawab Apoteker**: Filter *Pasien Tanggung Jawab Saya* vs *Semua Pasien*, indikator kepatuhan 7 & 30 hari, tekanan darah terakhir, dan tindak lanjut permintaan layanan farmasi.
- **Riwayat Pengobatan & Konfirmasi Dosis Pasien (`/staff/patients/:id`)**: Tabel lengkap jadwal vs waktu minum aktual, deviasi keterlambatan (menit), dan catatan pasien.
- **Tindak Lanjut Pasien & Laporan Pemantauan Farmakoterapi (PTO)**:
  - Pencatatan terstruktur metode **SOAP** (*Subjective, Objective, Assessment, Plan*) dan klasifikasi **DRP** (*Drug-Related Problems*).
  - Pengiriman rencana tindak lanjut otomatis ke ruang Chat & WhatsApp pasien.
  - **Cetak / PDF Laporan PTO Resmi** lengkap dengan identitas kredensial apoteker (`STRA` & `SIPA`).
- **Pusat Ekspor Data & Laporan CSV (`/staff/export`)**: Unduhan satu klik untuk dataset Pasien, Log Dosis, Log Tekanan Darah (dengan MAP), Laporan Tindak Lanjut PTO, Kuesioner, dan Transkrip Chat dengan opsi **Anonimisasi Etik Penelitian (`P-xxx`)**.

### 3. Portal Administrator (`/admin`)
- **Laporan Operasional & Analitik**: Metrik pengguna, tingkat kepatuhan 30 hari, kontrol tekanan darah, beban kerja per apoteker, dan distribusi masalah terapi obat (DRP).
- **Manajemen Akun & Hak Akses Pengguna**: Kelola akun Pasien, Apoteker, dan Administrator, pengaturan peran (*role*), aktivasi/penonaktifan akun, dan reset kata sandi.
- **Verifikasi Identitas & Kredensial Apoteker**: Pemeriksaan dan persetujuan nomor **STRA**, **SIPA**, tempat praktik, serta spesialisasi apoteker (`VERIFIED` / `PENDING` / `REJECTED`).
- **Manajemen Layanan Kefarmasian**: Tambah, ubah, dan atur status layanan farmasi di katalog.
- **Manajemen Sistem, Database & Integrasi WhatsApp**: Pemantauan kesehatan PostgreSQL, statistik 14 tabel database, konfigurasi WhatsApp Gateway (`SIMULATOR` / `FONNTE` / `WABLAS` / `CLOUD_API`), uji kirim WhatsApp, dan *Audit Trail* keamanan sistem.

---

## 🚀 Cara Menjalankan secara Lokal

Cukup klik dua kali berkas **`start.bat`** di folder proyek, atau jalankan melalui terminal:

```bash
# 1. Jalankan PostgreSQL di Docker
docker compose up -d postgres

# 2. Jalankan Backend API
cd server
npm run db:deploy
npm run db:seed
npm run dev

# 3. Jalankan Frontend Web (buka terminal baru)
cd web
npm run dev
```

Buka peramban di: **`http://localhost:5175`** (atau port Vite yang aktif).

---

## 👥 Akun Uji Coba Cepat (Tersedia Tombol 1-Klik di Halaman Login)

| Peran | Login / Email | Kata Sandi |
| :--- | :--- | :--- |
| **Pasien (Aisyah Rahmadani)** | `pasien@rara.local` *(atau 081234567890)* | `pasien123` |
| **Apoteker (Rabiatul Adawiah, S.Farm., Apt.)** | `apoteker@rara.local` | `apoteker123` |
| **Administrator Sistem** | `admin@rara.local` | `admin123` |
