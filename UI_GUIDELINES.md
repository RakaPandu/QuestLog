# QuestLog UI & Design System Guidelines

Dokumen ini adalah standar desain dan arsitektur resmi yang digunakan dalam pengembangan **QuestLog** dan aplikasi desktop serupa ke depan.

---

## 1. Arsitektur Jendela Desktop (Frameless First)
- **Zero Windows Titlebar**: Menggunakan Electron Frameless Window (`frame: false`, `titleBarStyle: 'hidden'`, `backgroundColor: '#0c0e14'`).
- **Drag Region & Kontrol Jendela**:
  - Baris atas berfungsi sebagai area geser (*drag region*) dengan CSS `-webkit-app-region: drag`.
  - Semua tombol interaktif diberi kelas `.titlebar-no-drag` (`-webkit-app-region: no-drag`).
  - Double-click pada area drag otomatis memaksimalkan / mengembalikan ukuran jendela.
  - Tombol kontrol jendela di kanan atas: Minimize (`—`), Maximize/Restore (`▢`), Close (`✕`).
- **Native Launcher**: Menggunakan C# Launcher (`csc.exe`) dengan embed icon `.ico` transparan tanpa jendela CMD konsol yang muncul.

---

## 2. Struktur Bar Atas (Seamless Two-Tier)
Latar belakang bar menyatu mulus (*seamless*) dengan body aplikasi (`#07090e` / `#0c0e14`) dengan border hairline (`#141722`).

### Baris 1: Title Bar & Menus (~28px / `h-7`)
- **Kiri**: Menu teks native IDE (`QuestLog`, `Library`, `View`, `Data`) dengan dropdown context menu lengkap dengan shortcut keyboard.
- **Tengah**: Area kosong untuk drag window (tanpa elemen mengganggu seperti pill pencarian besar).
- **Kanan**: Status ringkas (`● Steam Ready`) dan tombol window controls (`-`, `▢`, `✕`).

### Baris 2: Sub-Toolbar & Breadcrumbs (~32px / `h-8`)
- **Kiri**: Logo petir transparan, navigasi riwayat tab (`<` dan `>`), tombol fokus cari (`Ctrl + F`), dan breadcrumb path (`QuestLog / Semua Koleksi (0)`).
- **Kanan**: Kontrol zoom ringkas (`- 100% +`), Refresh data (`F5`), Tombol Stats, Tombol Backup, dan Tombol utama `+ Tambah Game`.

---

## 3. Palet Warna & Visual (Anti-AI Slop)
- **Hindari Klise AI**: Dilarang menggunakan gradasi warna ungu/pink mencolok, efek glow blob cahaya berlebihan, atau glassmorphism tebal.
- **Sistem Permukaan Gelap**:
  - Background Utama: Obsidian `#0c0e14` / `#07090e`.
  - Panel & Card: Solid `#11141d` / `#141824` dengan border solid `#1f2536` / `#202738`.
  - Warna Aksen Fungsional:
    - Primary Action: Sky Blue (`#0284c7` hover `#0369a1`).
    - Playing / Active: Emerald Green (`#10b981`).
    - Completed: Amber Gold (`#f59e0b`).
    - Dropped / Alert: Rose Red (`#f43f5e`).
    - Backlog / Neutral: Slate Gray (`#64748b` / `#94a3b8`).

---

## 4. Skala, Zoom & Responsivitas
- **Batas Zoom Ketat**: Skala zoom dibatasi strictly antara **100% (minimum)** dan **125% (maksimum)** agar imersi tidak rusak.
- **Cegah Distorsi Browser**: Native Ctrl + Wheel zoom dan touchpad pinch gestures dicegah agar tata letak tidak melar/rusak.
- **Zero Horizontal Scroll**: Seluruh tampilan dikunci agar tidak ada scrollbar horizontal (`overflow-x: hidden`).
- **Informasi Padat**: Typography berukuran 11px–13px yang tajam dengan informasi ringkas dan teratur.

---

## 5. Keamanan Data
- Penyimpanan lokal JSON / SQLite yang mandiri tanpa lock-in cloud.
- Fitur bawaan Backup & Recovery: Export JSON, Import (Replace / Merge), dan Snapshot riwayat otomatis.
