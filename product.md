# goblock

Swap SOL ke token Pump yang lebih murah dari Jupiter dan tetap cepat masuk blok. Fee goblock tidak dipotong dari swap biasa.

## Keunggulan

- Koin baru tidak kena 50 bps Jupiter. Koin biasa tidak kena 10 bps. User hanya bayar fee pool.
- DFlow juga 0 fee protokol. goblock menang di biaya total: satu langkah, tanpa hop tambahan, tip dibatasi.
- Sebelum tanda tangan, trader melihat hasil kalau token langsung dijual lagi, plus status koin: masih di bonding curve atau sudah lulus, fee creator, mayhem, dan cashback. DFlow tidak menampilkan ini.
- API produksi bisa dipakai siapa saja yang berlangganan. Kunci terbit tanpa formulir tunggu 2–5 hari seperti DFlow.

Keunggulan harga hilang kalau swap dari beranda ikut dipotong.

## Swap

Satu langkah. Pool terbaik di antara PumpSwap, Raydium, dan Meteora. User menandatangani di wallet sendiri.

Priority fee mengikuti antrian slot saat itu, dengan batas atas 0,0001 SOL. Tip cukup untuk masuk satu sampai dua slot. Tip tidak dipakai sebagai sumber uang.

## Dari mana goblock dibayar

- Swap dari beranda, lewat `/api/swap`, tetap gratis dan tanpa kunci.
- Swap lewat link brand memotong 5 bps. Setengah ke wallet brand, setengah ke kas goblock, hanya kalau transaksi berhasil. Untuk koin baru ini tetap jauh di bawah fee Jupiter.
- Bot membayar langganan API, bukan potongan di swap trader. Halaman trader tidak berubah.

Link brand: `/?brand=Nama&brandWallet=<alamat>`

Kas goblock: `GOBLOCK_TREASURY`, atau upgrade authority kalau variabel itu kosong.

## API

`/api/v1/swap` wajib header `x-api-key`. Kunci yang berlaku ada di `GOBLOCK_API_KEYS`, dipisah koma. Paket nanti membedakan batas permintaan, bukan menambah fee swap.

DFlow production harus diajukan dan menunggu persetujuan. goblock menerbitkan kunci saat orang berlangganan.

## Kode saat ini

Quote membandingkan PumpSwap, bonding curve, Raydium, Meteora, dan Orca dalam satu langkah, lalu memakai hasil terbesar. Resi koin, pratinjau jual-balik, priority fee berbatas, fee link 5 bps, dan kunci pada `/api/v1/swap` sudah dipakai.

Pembayaran langganan otomatis menyusul. Router ada di `programs/goblock`: instruksi `route` meneruskan swap ke program yang diizinkan dan menulis log `goblock:`. Binary-nya sekitar 6 KB dan sudah hidup di devnet. Beranda masih memanggil program venue langsung, sampai program `4gZQou…` hidup di mainnet.
