# 🎁 Lucky Draw Engine (Production-Ready)

Aplikasi undian profesional berbasis Web (Client-Side) yang dirancang khusus untuk acara berskala besar seperti Tournament, Gathering, Corporate Event, dan Anniversary.

Aplikasi ini **TIDAK** membutuhkan server database external. Semua data aman dan hidup di browser komputer operator berkat arsitektur **Offline-First**.

---

## 🌟 Fitur Utama (Core Features)

1. **No Backend Required:** Menggunakan IndexedDB (Dexie.js) sebagai database lokal. 
2. **Offline-First:** Begitu aplikasi termuat di browser, undian bisa terus berjalan 100% lancar walau koneksi internet terputus.
3. **Smart Redraw Engine:** (Ini fitur paling mematikan!) Jika dari 10 pemenang ada 3 yang tidak hadir (ABSENT), sistem hanya akan mengundi **3 sisa slot** tersebut, BUKAN 10 dari awal lagi.
4. **Cinematic Public Screen:** Layar undian dibuat khusus tanpa tombol admin yang mengganggu. Menggunakan efek putar animasi (Framer Motion).
5. **Excel/CSV Import:** Otomatis membaca nama peserta dari file Excel.
6. **Strict Winner Rules:** Otomatis mencegah peserta yang sudah memenangkan hadiah di undian sebelumnya untuk terpanggil lagi.

---

## 📖 BUKU PANDUAN OPERATOR (Manual Book)

### TAHAP 1: Persiapan (Event Setup)
1. Buka halaman dashboard admin di `/admin`.
2. Masuk ke tab **Events**. Klik **Create Event**.
3. Beri nama acara (Misal: *Gobar HGC TGC 2026*).
4. Klik tombol **Select Event** sampai muncul status ungu "ACTIVE EVENT".

### TAHAP 2: Memasukkan Peserta (Participants)
1. Masuk ke tab **Participants**.
2. Klik tombol biru **Import Excel/CSV**.
3. Pilih file Excel kamu (contoh: `Daftar Peserta Gobar.xlsx`).
4. Sistem akan otomatis menyedot semua nama. Jika ada nama atau baris kosong, sistem akan mengabaikannya secara pintar.
5. (Opsi Darurat): Kamu bisa klik **Manual Input** lalu ketik/paste nama daftar orangnya.

### TAHAP 3: Menentukan Hadiah (Prizes)
1. Masuk ke tab **Prizes**.
2. Klik **Add Prize**.
3. Masukkan nama hadiah (contoh: "TV Pintar 32 Inch", "Voucher Belanja").
4. Masukkan **Required Winner Count** alias jumlah pemenang yang dicari (Misal: 5 Orang).
5. (Opsional): Klik Upload Image untuk memasukkan gambar barangnya.
6. Klik **Save**.

### TAHAP 4: Saatnya Undian! (The Draw)
Langkah ini dilakukan saat MC acara sudah bersiap di panggung.
1. Masuk ke tab **Draw Control**.
2. Pastikan pilihan hadiah di menu *dropdown* sudah benar.
3. Klik tombol hitam raksasa: **Monitor Play (Launch Public Screen)**.
4. **Krusial:** Sebuah tab baru *Full Cinema* akan terbuka. Lempar/geser/drag tab browser ini ke Monitor Proyektor / TV LED.
5. Tekan `F11` di keyboard agar status Fullscreen.

### TAHAP 5: Verifikasi Hadir/Tidak! (Attendance)
1. Di layar Public Screen tadi, tekan tombol spasi atau klik **START DRAW**.
2. Animasi nama akan berputar dan berhenti di para pemenang.
3. **VERIFIKASI:** Sebuah modal/kotak akan muncul untuk operator.
   - Panggil namanya. Jika orangnya lari ke panggung, klik **PRESENT** (Pemenang terkonfirmasi & dikunci).
   - Jika orangnya sudah pulang, klik **ABSENT** (Orang ini dikembalikan ke kolam kocokan, dibatalkan).
4. Klik **Save & Continue**.

### TAHAP 6: Sistem Redraw Otomatis
Jika hadiah mencari 5 pemenang, tapi ternyata ada 2 orang ABSENT, maka sistem **TIDAK AKAN** menyelesaikan undian.
1. Tombol oranye besar **REDRAW 2 NOW** akan muncul.
2. Klik tombol tersebut.
3. Mesin otomatis mencari lagi 2 pangganti dari kolam peserta yang belum pernah menang, tanpa pernah memanggil pemenang yang 3 (PRESENT) tadi.
4. Jika sudah komplit, layar akan meledak meriah (PRIZE FULFILLED).

---

## 🛠 Panduan Developer & Arsitektur

* **Framework:** Next.js 14 (App Router) + TypeScript.
* **Styling & UI:** Tailwind CSS, Lucide React (Icons).
* **Database:** `Dexie.js` (IndexedDB Wrapper). Struktur skema menggunakan `LuckyDrawDB`.
* **Animasi:** `framer-motion` (Client-side render).
* **Parser:** `papaparse` (CSV) dan `xlsx` / SheetJS (Excel).

### 🚨 Aturan Keselamatan (Data Privacy)
Semua data pemenang (Event, Log kocokan, dll) hidup **hanya di browser / laptop** milik operator. Aplikasi ini bisa dihosting publik di Vercel, tetapi database-nya tetap menggunakan *Local Browser Space* (IndexedDB) dari yang membukanya. Jangan sembarangan Clear Cache / Clear Data browser!

### 💻 Local Development
```bash
# Clone the repository
git clone https://github.com/YourName/YourRepo.git

# Install dependencies (Next, Dexie, Tailwind, dll)
npm install

# Run the dev server
npm run dev

# Open http://localhost:3000
```
