# Apoteku (Rara Ganie Clinical Pharmacy Project) 💊🇮🇩

Aplikasi Web & PWA untuk **Penelitian Kepatuhan Minum Obat (*Medication Adherence*) & Konsultasi Apoteker Klinis** di Indonesia.

---

## ✨ Fitur Utama

### 1. Portal Pasien (Mobile-First PWA)
- **Jadwal Minum Obat Harian**: Tampilan waktu minum obat dengan tombol konfirmasi langsung (*Sudah Diminum* / *Lewati Dosis* / *Catatan Keterlambatan*).
- **Indikator Kepatuhan (*Adherence Rate*)**: Visualisasi kepatuhan 30 hari secara real-time berdasarkan data log konsumsi obat.
- **Konsultasi Chat dengan Apoteker**: Fitur live chat langsung antara pasien dan apoteker klinis lengkap dengan indikator pengetikan (*typing indicator*) dan tanda centang terbaca (*read receipts*).
- **Pusat Edukasi Obat Dwibahasa (ID/EN)**: Panduan aturan pakai, efek samping, dan tips konsumsi untuk obat kronis (misal Amlodipin, Metformin).
- **Kuesioner Penelitian (ARMS / Adherence Scale)**: Instrumen evaluasi kepatuhan dan literasi obat digital.
- **Pengingat Notifikasi (*Web Push Notification*)**: Menggunakan protokol VAPID untuk mengirim pengingat ke perangkat HP/browser.

### 2. Dasbor Apoteker & Peneliti (*Pharmacist & Researcher Dashboard*)
- **Daftar Pasien Terdaftar**: Pemantauan skor kepatuhan 7 hari dan 30 hari, diagnosis, serta tanda pesan belum dibaca.
- **Manajemen Pasien & Regimen Resep**: Pendaftaran pasien baru, pengaturan obat, dosis, sediaan, dan jadwal waktu minum obat.
- **Catatan Klinis Apoteker**: Kolom intervensi dan riwayat konseling privat yang aman untuk tim peneliti.
- **Kotak Masuk Konsultasi Farmasi**: Manajemen semua percakapan konsultasi dengan pasien dalam satu tempat.
- **Pusat Ekspor Data Riset (CSV)**:
  - Unduhan satu klik untuk dataset Pasien, Log Dosis & Keterlambatan, Jawaban Kuesioner, dan Percakapan Chat.
  - **Opsi Kelaikan Etik Penelitian (*Bioethics Anonymization*)**: Mengganti nama asli & kontak pasien dengan Kode Studi (misal `P-001`) agar siap diolah di SPSS, R, atau Excel.

---

## 🚀 Cara Menjalankan secara Lokal

### Persyaratan:
1. **Node.js** v20+ dan **npm**
2. **Docker Desktop** (untuk database PostgreSQL)

### Langkah Cepat:
Cukup klik dua kali berkas **`start.bat`** di folder proyek, atau jalankan melalui terminal:

```bash
# 1. Jalankan PostgreSQL di Docker
docker compose up -d postgres

# 2. Jalankan Backend API
cd server
npm run dev

# 3. Jalankan Frontend Web (buka terminal baru)
cd web
npm run dev
```

Buka peramban di: **`http://localhost:5173`**

---

## 👥 Akun Uji Coba Cepat (Tersedia Tombol 1-Klik di Halaman Login):

| Peran | Login / Email | Kata Sandi |
| :--- | :--- | :--- |
| **Pasien (Budi Santoso)** | `pasien@rara.local` *(atau 081234567890)* | `pasien123` |
| **Apoteker (apt. Rara Ganie)** | `apoteker@rara.local` | `apoteker123` |
| **Administrator** | `admin@rara.local` | `admin123` |

---

## 🌐 Dukungan Bahasa
Aplikasi mendukung peralihan bahasa instan di pojok kanan atas:
- 🇮🇩 **Bahasa Indonesia**
- 🇬🇧 **English**
