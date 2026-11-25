const DB_NAME = "kas-umkm";
const DB_VERSION = 1;
let db;
let myChart = null; // Variabel untuk menyimpan grafik

// 1. Buka Database
async function bukaDB() {
  db = await idb.openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains("transaksi")) {
        const store = database.createObjectStore("transaksi", {
          keyPath: "id", autoIncrement: true
        });
        store.createIndex("tanggal", "tanggal");
        store.createIndex("tipe", "tipe");
      }
    }
  });
}

// 2. Format Rupiah
function formatRupiah(angka) {
  return "Rp" + Number(angka).toLocaleString("id-ID");
}

// 3. Navigasi Tab (Dashboard vs Kas)
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    // Hapus status active dari semua tombol & halaman
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
    
    // Tambahkan active ke yang diklik
    e.target.classList.add('active');
    const targetId = e.target.getAttribute('data-target');
    document.getElementById(targetId).classList.add('active');

    // Kalau buka dashboard, render ulang grafiknya
    if (targetId === 'page-dashboard') {
      renderGrafik();
    }
  });
});

// 4. Render Daftar Transaksi & Ringkasan
async function render() {
  const semua = await db.getAll("transaksi");
  semua.sort((a, b) => {
    if (a.tanggal !== b.tanggal) return b.tanggal.localeCompare(a.tanggal);
    return b.id - a.id;
  });

  let totalMasuk = 0;
  let totalKeluar = 0;
  const ul = document.getElementById("daftar-transaksi");
  ul.innerHTML = "";

  semua.forEach((t) => {
    if (t.tipe === "masuk") totalMasuk += t.jumlah;
    else totalKeluar += t.jumlah;

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
    btnEdit.textContent = "✏️";
    btnEdit.style.cssText = "background:none; border:none; cursor:pointer; font-size:16px; padding:4px;";
    btnEdit.onclick = () => siapkanEdit(t);

    const btnHapus = document.createElement("button");
    btnHapus.textContent = "🗑️";
    btnHapus.style.cssText = "background:none; border:none; cursor:pointer; font-size:16px; padding:4px;";
    btnHapus.onclick = () => hapusTransaksi(t.id);

    divAksi.append(strong, btnEdit, btnHapus);
    li.append(divTeks, divAksi);
    ul.appendChild(li);
  });

  document.getElementById("total-masuk").textContent = formatRupiah(totalMasuk);
  document.getElementById("total-keluar").textContent = formatRupiah(totalKeluar);
  document.getElementById("saldo").textContent = formatRupiah(totalMasuk - totalKeluar);
  document.getElementById("kosong").style.display = semua.length ? "none" : "block";
  
  // Setiap kali data berubah, update grafiknya
  renderGrafik(semua);
}

// 5. Render Grafik Pengeluaran (Chart.js)
async function renderGrafik(dataTransaksi = null) {
  // Kalau data belum dilempar, ambil dari DB
  const semua = dataTransaksi || await db.getAll("transaksi");
  
  // Ambil hanya pengeluaran
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

  // Hitung total per kategori
  const kategoriMap = {};
  pengeluaran.forEach(t => {
    kategoriMap[t.kategori] = (kategoriMap[t.kategori] || 0) + t.jumlah;
  });

  const labels = Object.keys(kategoriMap);
  const data = Object.values(kategoriMap);

  // Hapus grafik lama jika ada
  if (myChart) { myChart.destroy(); }

  const ctx = document.getElementById('grafik-pengeluaran').getContext('2d');
  myChart = new Chart(ctx, {
    type: 'doughnut', // Jenis grafik: donat
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#8b5cf6'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

// 6. Handle Form Submit (Tambah & Edit)
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
  await render();
});

// 7. Fungsi Pendukung CRUD
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
  
  // Pindah ke tab Kas (jika sedang di dashboard)
  document.querySelector('[data-target="page-kas"]').click();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function hapusTransaksi(id) {
  if (confirm("Yakin ingin menghapus transaksi ini?")) {
    await db.delete("transaksi", id);
    await render();
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

// 8. Fitur Backup & Restore
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
      await render();
      e.target.value = "";
    } catch (error) {
      alert("Gagal me-restore data. Pastikan format file CSV sesuai.");
      console.error(error);
    }
  };
  reader.readAsText(file);
});

// 9. Inisialisasi Awal
(async function init() {
  await bukaDB();
  document.getElementById("tanggal").valueAsDate = new Date();
  await render();

  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then(function(persistent) {
      if (persistent) console.log("Data dilindungi dari penghapusan otomatis.");
      else console.log("Browser mengabaikan permintaan izin penyimpanan.");
    });
  }
})();
