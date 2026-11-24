const DB_NAME = 'kas-umkm';
const DB_VERSION = 1;
let db;

async function bukaDB() {
  db = await idb.openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('transaksi')) {
        const store = database.createObjectStore('transaksi', {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('tanggal', 'tanggal');
        store.createIndex('tipe', 'tipe');
      }
    },
  });
}

function formatRupiah(angka) {
  return 'Rp' + Number(angka).toLocaleString('id-ID');
}

async function render() {
  const semua = await db.getAll('transaksi');
  semua.sort((a, b) => {
    if (a.tanggal !== b.tanggal) return b.tanggal.localeCompare(a.tanggal);
    return b.id - a.id;
  });

  let totalMasuk = 0;
  let totalKeluar = 0;
  const ul = document.getElementById('daftar-transaksi');
  ul.innerHTML = '';

  semua.forEach((t) => {
    if (t.tipe === 'masuk') totalMasuk += t.jumlah;
    else totalKeluar += t.jumlah;

    const li = document.createElement('li');
    li.className = t.tipe;

    const span = document.createElement('span');
    span.textContent = `${t.tanggal} · ${t.keterangan} (${t.kategori})`;

    const strong = document.createElement('strong');
    strong.textContent = `${t.tipe === 'masuk' ? '+' : '-'} ${formatRupiah(t.jumlah)}`;

    li.append(span, strong);
    ul.appendChild(li);
  });

  document.getElementById('total-masuk').textContent = formatRupiah(totalMasuk);
  document.getElementById('total-keluar').textContent = formatRupiah(totalKeluar);
  document.getElementById('saldo').textContent = formatRupiah(totalMasuk - totalKeluar);
  document.getElementById('kosong').style.display = semua.length ? 'none' : 'block';
}

document.getElementById('form-transaksi').addEventListener('submit', async (e) => {
  e.preventDefault();

  const tipe = document.getElementById('tipe').value;
  const tanggal = document.getElementById('tanggal').value;
  const keterangan = document.getElementById('keterangan').value.trim();
  const kategori = document.getElementById('kategori').value;
  const jumlah = Number(document.getElementById('jumlah').value);

  if (!tanggal || !keterangan || !jumlah || jumlah <= 0) return;

  await db.add('transaksi', { tipe, tanggal, keterangan, kategori, jumlah });

  e.target.reset();
  document.getElementById('tanggal').valueAsDate = new Date();
  await render();
});

(async function init() {
  await bukaDB();
  document.getElementById('tanggal').valueAsDate = new Date();
  await render();
})();
