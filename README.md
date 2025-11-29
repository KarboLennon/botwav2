# WhatsApp Relay Bot

Bot WhatsApp yang berfungsi sebagai perantara (relay) antara dua nomor WhatsApp. Bot ini menerima pesan dari nomor A dan meneruskannya ke nomor B, dan sebaliknya.

## Fitur

- ✅ Relay pesan teks bidirectional
- ✅ Relay media (gambar, video, dokumen, audio)
- ✅ Session persistence (tidak perlu scan QR berulang)
- ✅ Auto-reconnect saat koneksi terputus
- ✅ Retry mechanism dengan exponential backoff
- ✅ Logging lengkap dengan rotasi otomatis
- ✅ Memory management otomatis
- ✅ Graceful shutdown
- ✅ State persistence

## Persyaratan

- Node.js 18 atau lebih tinggi
- npm atau yarn
- Koneksi internet stabil

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Konfigurasi

Buat file `config.json` di root directory:

```bash
copy config\config.template.json config.json
```

Edit `config.json` dengan nomor WhatsApp Anda:

```json
{
  "numberA": "628123456789@c.us",
  "numberB": "6287826991483@c.us",
  "botNumber": "",
  "prefixA": "[From A]",
  "prefixB": "[From B]",
  "retryAttempts": 3,
  "retryDelay": 1000,
  "maxLogSize": 10,
  "logDirectory": "./logs",
  "sessionDirectory": "./session"
}
```

**Format Nomor:**
- Gunakan format internasional: `62` (kode negara) + nomor tanpa `0` di depan
- Tambahkan `@c.us` di akhir
- Contoh: `628123456789@c.us` untuk nomor `0812-3456-789`

### 3. Build Project

```bash
npm run build
```

### 4. Jalankan Bot

**Mode Development:**
```bash
npm run dev
```

**Mode Production:**
```bash
npm start
```

**Dengan PM2 (Recommended untuk production):**
```bash
npm run pm2:start
```

### 5. Scan QR Code

Saat pertama kali dijalankan, bot akan menampilkan QR code di terminal. Scan QR code tersebut dengan WhatsApp Anda:

1. Buka WhatsApp di HP
2. Tap menu (3 titik) → Linked Devices
3. Tap "Link a Device"
4. Scan QR code yang muncul di terminal

**Jika QR code di terminal tidak terbaca:**
- Bot juga menyimpan QR code sebagai file `qr-code.png` di root folder
- Buka file tersebut dan scan dari gambar
- QR code di file gambar lebih jelas dan mudah di-scan

Session akan tersimpan, jadi Anda tidak perlu scan QR lagi di run berikutnya.

## Penggunaan

Setelah bot berjalan:

1. **Nomor A** kirim pesan ke **Bot** → pesan diteruskan ke **Nomor B** dengan prefix `[From A]`
2. **Nomor B** kirim pesan ke **Bot** → pesan diteruskan ke **Nomor A** dengan prefix `[From B]`

Bot mendukung:
- ✅ Pesan teks
- ✅ Gambar
- ✅ Video
- ✅ Dokumen
- ✅ Voice notes

## PM2 Commands

Untuk production, gunakan PM2:

```bash
# Start bot
npm run pm2:start

# Stop bot
npm run pm2:stop

# Restart bot
npm run pm2:restart

# View logs
npm run pm2:logs

# Check status
npm run pm2:status

# Delete from PM2
npm run pm2:delete
```

## Development

**Run in development mode:**
```bash
npm run dev
```

**Run tests:**
```bash
npm test
```

**Watch mode:**
```bash
npm run test:watch
```

## Konfigurasi Detail

| Field | Deskripsi | Default |
|-------|-----------|---------|
| `numberA` | Nomor WhatsApp pertama (format: 628xxx@c.us) | - |
| `numberB` | Nomor WhatsApp kedua (format: 628xxx@c.us) | - |
| `botNumber` | Nomor bot (opsional, akan terisi otomatis) | "" |
| `prefixA` | Prefix untuk pesan dari A | "[From A]" |
| `prefixB` | Prefix untuk pesan dari B | "[From B]" |
| `retryAttempts` | Maksimal retry saat gagal kirim | 3 |
| `retryDelay` | Delay awal untuk retry (ms) | 1000 |
| `maxLogSize` | Ukuran maksimal file log (MB) | 10 |
| `logDirectory` | Direktori untuk log files | "./logs" |
| `sessionDirectory` | Direktori untuk session data | "./session" |

## Troubleshooting

### Bot tidak bisa connect

1. Pastikan koneksi internet stabil
2. Cek apakah WhatsApp Web bisa diakses di browser
3. Hapus folder `session/` dan scan QR ulang

### Pesan tidak terkirim

1. Cek log di folder `logs/`
2. Pastikan format nomor benar (628xxx@c.us)
3. Pastikan kedua nomor sudah save kontak bot

### Memory tinggi

Bot sudah dilengkapi memory management otomatis. Jika masih tinggi:
1. Restart bot: `npm run pm2:restart`
2. Turunkan threshold di `MemoryManager` constructor

### Session expired

Jika session expired, bot akan otomatis minta scan QR ulang. Scan dengan WhatsApp Anda.

## Logs

Log files tersimpan di folder `logs/`:
- `bot-YYYY-MM-DD.log` - Log harian
- `pm2-error.log` - PM2 error logs
- `pm2-out.log` - PM2 output logs

Log akan otomatis di-rotate saat mencapai ukuran maksimal.

## Directory Structure

```
├── src/                    # Source code
│   ├── client/            # WhatsApp client manager
│   ├── config/            # Configuration manager
│   ├── error/             # Error handler
│   ├── logger/            # Logger service
│   ├── memory/            # Memory manager
│   ├── queue/             # Message queue
│   ├── relay/             # Message relay service
│   ├── shutdown/          # Shutdown handler
│   ├── state/             # State manager
│   └── index.ts           # Main entry point
├── dist/                  # Compiled JavaScript
├── logs/                  # Log files
├── session/               # WhatsApp session data
├── config/                # Configuration templates
├── config.json            # Your configuration (not tracked)
├── ecosystem.config.js    # PM2 configuration
└── package.json           # Project metadata
```

## Security

⚠️ **Penting:**
- Jangan commit `config.json` ke git (sudah ada di .gitignore)
- Jangan share folder `session/` (berisi data autentikasi)
- Jangan share log files (mungkin berisi data sensitif)

## License

ISC
