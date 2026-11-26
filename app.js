const DB_NAME = "kas-umkm";
const DB_VERSION = 1;
let db;
let myChart = null; 

async function bukaDB() {
  db = await idb.openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains("transaksi")) {
        const store = database.createObjectStore("transaksi", { keyPath: "id", autoIncrement: true });
        store.createIndex("tanggal", "tanggal");
        store.createIndex("tipe", "tipe");
      }
    }
  });
}

function formatRupiah(angka) {
  return "Rp" + Number(angka).toLocaleString("id-ID");
}

// Navigasi Tab
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
    
    e.target.classList.add('active');
    const targetId = e.target.getAttribute('data-target');
    document.getElementById(targetId).classList.add('active');

    // Render ulang sesuai halaman
    if (targetId === 'page-dashboard') renderDashboard();
    if (targetId === 'page-riwayat') renderRiwayat();
    if (targetId === 'page-laporan') renderLaporan();
  });
});

// Render Dashboard (Total & Grafik)
async function renderDashboard() {
  const semua = await db.getAll("transaksi");
  
  let totalMasuk = 0, totalKeluar = 0;
  semua.forEach(t => {
    if (t.tipe === "masuk") totalMasuk += t.jumlah;
    else totalKeluar += t.jumlah;
  });

  document.getElementById("total-masuk").textContent = formatRupiah(totalMasuk);
  document.getElementById("total-keluar").textContent = formatRupiah(totalKeluar);
  document.getElementById("saldo").textContent = formatRupiah(totalMasuk - totalKeluar);
  
  renderGrafik(semua);
}

// Render Grafik
async function renderGrafik(semua) {
  const pengeluaran = semua.filter(t => t.tipe === "keluar");
  
  if (pengeluaran.length === 0) {
    document.getElementById("grafik-pengeluaran").style.display = "none";
    document.getElementById("pesan-grafik").style.display = "block";
    if (myChart) { myChart.destroy(); myChart = null; }
    return;
  } else {
    document.getElementById("grafik-pengeluaran").style.display = "block";
    document.getElementById("pesan-grafik").style.display = "none";
  }

  const kategoriMap = {};
  pengeluaran.forEach(t => { kategoriMap[t.kategori] = (kategoriMap[t.kategori] || 0) + t.jumlah; });

  if (myChart) { myChart.destroy(); }
  const ctx = document.getElementById('grafik-pengeluaran').getContext('2d');
  myChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(kategoriMap),
      datasets: [{
        data: Object.values(kategoriMap),
        backgroundColor: ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#8b5cf6'],
        borderWidth: 1
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });
}

// Render Riwayat (Dengan Filter)
async function renderRiwayat() {
  const filterBulan = document.getElementById("filter-riwayat").value;
  const semua = await db.getAll("transaksi");
  
  // Filter berdasarkan bulan (jika ada)
  let dataTampil = semua;
  if (filterBulan) {
    dataTampil = semua.filter(t => t.tanggal.startsWith(filterBulan));
  }

  // Urutkan dari yang terbaru
  dataTampil.sort((a, b) => {
    if (a.tanggal !== b.tanggal) return b.tanggal.localeCompare(a.tanggal);
    return b.id - a.id;
  });

  const ul = document.getElementById("daftar-transaksi");
  ul.innerHTML = "";

  dataTampil.forEach((t) => {
    const li = document.createElement("li");
    li.style.alignItems = "center";

    const divTeks = document.createElement("div");
    divTeks.style.flex = "1";
    divTeks.innerHTML = `<small>${t.tanggal}</small><br><strong>${t.keterangan}</strong> <br><small style="color:#6b7280">${t.kategori}</small>`;

    const divAksi = document.createElement("div");
    divAksi.style.display = "flex"; divAksi.style.gap = "8px"; divAksi.style.alignItems = "center";

    const strong = document.createElement("strong");
    strong.textContent = `${t.tipe === "masuk" ? "+" : "-"} ${formatRupiah(t.jumlah)}`;
    strong.style.minWidth = "90px"; strong.style.textAlign = "right";
    strong.style.color = t.tipe === "masuk" ? "#0a7d33" : "#c0392b";

    const btnEdit = document.createElement("button");
    btnEdit.textContent = "✏️"; btnEdit.style.cssText = "background:none; border:none; cursor:pointer; font-size:16px; padding:4px;";
    btnEdit.onclick = () => siapkanEdit(t);

    const btnHapus = document.createElement("button");
    btnHapus.textContent = "🗑️"; btnHapus.style.cssText = "background:none; border:none; cursor:pointer; font-size:16px; padding:4px;";
    btnHapus.onclick = () => hapusTransaksi(t.id);

    divAksi.append(strong, btnEdit, btnHapus);
    li.append(divTeks, divAksi);
    ul.appendChild(li);
  });

  document.getElementById("kosong").style.display = dataTampil.length ? "none" : "block";
}

// Render Laporan Bulanan
async function renderLaporan() {
  const filterBulan = document.getElementById("filter-bulan").value;
  if (!filterBulan) return;

  // Update teks untuk cetak
  const dateObj = new Date(filterBulan + "-01");
  const namaBulan = dateObj.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
  document.getElementById("teks-bulan-cetak").textContent = `Bulan: ${namaBulan}`;

  const semua = await db.getAll("transaksi");
  const dataBulanIni = semua.filter(t => t.tanggal.startsWith(filterBulan));

  let masuk = 0, keluar = 0;
  const kategoriMap = {};

  dataBulanIni.forEach(t => {
    if (t.tipe === "masuk") masuk += t.jumlah;
    else keluar += t.jumlah;

    const key = `${t.tipe === 'masuk' ? 'Pemasukan' : 'Pengeluaran'} - ${t.kategori}`;
    kategoriMap[key] = (kategoriMap[key] || 0) + t.jumlah;
  });

  document.getElementById("lap-masuk").textContent = formatRupiah(masuk);
  document.getElementById("lap-keluar").textContent = formatRupiah(keluar);
  document.getElementById("lap-saldo").textContent = formatRupiah(masuk - keluar);

  const ul = document.getElementById("lap-kategori-list");
  ul.innerHTML = "";

  if (Object.keys(kategoriMap).length === 0) {
    document.getElementById("lap-kosong").style.display = "block";
  } else {
    document.getElementById("lap-kosong").style.display = "none";
    for (const [kategori, jumlah] of Object.entries(kategoriMap)) {
      const li = document.createElement("li");
      li.innerHTML = `<span>${kategori}</span> <strong>${formatRupiah(jumlah)}</strong>`;
      ul.appendChild(li);
    }
  }
}

// Event Listener Filter
document.getElementById("filter-riwayat").addEventListener("change", renderRiwayat);
document.getElementById("filter-bulan").addEventListener("change", renderLaporan);

// Handle Form Submit
document.getElementById("form-transaksi").addEventListener("submit", async (e) => {
  e.preventDefault();
  const editId = document.getElementById("edit-id").value;
  const tipe = document.getElementById("tipe").value;
  const tanggal = document.getElementById("tanggal").value;
  const keterangan = document.getElementById("keterangan").value.trim();
  const kategori = document.getElementById("kategori").value;
  const jumlah = Number(document.getElementById("jumlah").value);

  if (!tanggal || !keterangan || !jumlah || jumlah <= 0) return;
  const data = { tipe, tanggal, keterangan, kategori, jumlah };

  if (editId) {
    data.id = Number(editId);
    await db.put("transaksi", data);
  } else {
    await db.add("transaksi", data);
  }

  resetForm();
  alert("Data berhasil disimpan!");
  // Pindah ke tab riwayat setelah simpan
  document.querySelector('[data-target="page-riwayat"]').click();
});

function siapkanEdit(t) {
  document.getElementById("edit-id").value = t.id;
  document.getElementById("tipe").value = t.tipe;
  document.getElementById("tanggal").value = t.tanggal;
  document.getElementById("keterangan").value = t.keterangan;
  document.getElementById("kategori").value = t.kategori;
  document.getElementById("jumlah").value = t.jumlah;

  const btnSubmit = document.getElementById("btn-submit");
  btnSubmit.textContent = "Update Transaksi";
  btnSubmit.style.background = "#f59e0b";
  document.getElementById("btn-batal").style.display = "block";
  
  document.querySelector('[data-target="page-input"]').click();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function hapusTransaksi(id) {
  if (confirm("Yakin ingin menghapus transaksi ini?")) {
    await db.delete("transaksi", id);
    await renderRiwayat();
  }
}

function resetForm() {
  document.getElementById("form-transaksi").reset();
  document.getElementById("edit-id").value = "";
  document.getElementById("tanggal").valueAsDate = new Date();
  const btnSubmit = document.getElementById("btn-submit");
  btnSubmit.textContent = "Simpan Transaksi";
  btnSubmit.style.background = "#1f6feb";
  document.getElementById("btn-batal").style.display = "none";
}

document.getElementById("btn-batal").addEventListener("click", resetForm);

// Fitur Backup & Restore
document.getElementById("btn-export").addEventListener("click", async () => {
  const semua = await db.getAll("transaksi");
  if (semua.length === 0) { alert("Belum ada data untuk di-backup."); return; }

  const headers = ["Tanggal", "Tipe", "Kategori", "Keterangan", "Jumlah"];
  const barisData = semua.map(t => {
    const ketAman = t.keterangan.replace(/,/g, " ");
    return `${t.tanggal},${t.tipe},${t.kategori},"${ketAman}",${t.jumlah}`;
  });

  const csvContent = headers.join(",") + "\n" + barisData.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "Backup_Kas_UMKM.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

document.getElementById("btn-import").addEventListener("click", () => {
  document.getElementById("file-import").click();
});

document.getElementById("file-import").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const text = event.target.result;
      const lines = text.split("\n").filter(line => line.trim() !== "");
      lines.shift(); 

      let sukses = 0;
      for (const line of lines) {
        const match = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (match && match.length >= 5) {
          const tanggal = match[0];
          const tipe = match[1];
          const kategori = match[2];
          const keterangan = match[3].replace(/^"|"$/g, '');
          const jumlah = Number(match[4]);

          if (tanggal && tipe && kategori && keterangan && jumlah) {
            await db.add("transaksi", { tanggal, tipe, kategori, keterangan, jumlah });
            sukses++;
          }
        }
      }
      alert(`Berhasil me-restore ${sukses} data transaksi.`);
      renderDashboard();
      renderRiwayat();
      e.target.value = "";
    } catch (error) {
      alert("Gagal me-restore data. Pastikan format file CSV sesuai.");
      console.error(error);
    }
  };
  reader.readAsText(file);
});

// Inisialisasi Awal
(async function init() {
  await bukaDB();
  
  const now = new Date();
  const bulanSekarang = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  document.getElementById("tanggal").valueAsDate = now;
  document.getElementById("filter-riwayat").value = bulanSekarang;
  document.getElementById("filter-bulan").value = bulanSekarang;

  // Tampilkan data awal di dashboard
  await renderDashboard();

  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then(function(persistent) {
      if (persistent) console.log("Data dilindungi.");
    });
  }
})();
 
