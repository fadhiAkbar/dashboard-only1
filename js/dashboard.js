/* ============================================================
   Webkarya — Dashboard logic (v2: pencatatan order/penjualan)
   Semua data disimpan di localStorage supaya tidak hilang
   walaupun dashboard ditutup / browser di-refresh.
   ============================================================ */

const STORAGE_KEY = "webkarya_dashboard_data_v2";
const AUTH_KEY = "webkarya_dashboard_auth_v1";
const PASS_KEY = "webkarya_dashboard_pass_v1";
const DEFAULT_PASS = "webkarya2026";

const DEFAULT_DATA = {
  orders: [], // { id, nama, kategori, hargaJual, qty, pendapatan, waktu(ISO) }
};

const KATEGORI_SUGGESTIONS = ["Basic", "Starter", "Business"];

// ---------- State ----------
let state = loadData();

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = structuredClone(DEFAULT_DATA);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.orders)) parsed.orders = [];
    return parsed;
  } catch (e) {
    console.error("Gagal load data, pakai default.", e);
    return structuredClone(DEFAULT_DATA);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function formatRupiah(n) {
  const num = Number(n) || 0;
  return "Rp " + num.toLocaleString("id-ID");
}

// ---------- Toast ----------
function toast(msg, isError = false) {
  const host = document.getElementById("toastHost");
  const el = document.createElement("div");
  el.className = "toast" + (isError ? " error" : "");
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .3s ease";
    setTimeout(() => el.remove(), 300);
  }, 2400);
}

// ============================================================
// AUTH GATE (sederhana, client-side)
// ============================================================
function initAuth() {
  if (!localStorage.getItem(PASS_KEY)) {
    localStorage.setItem(PASS_KEY, DEFAULT_PASS);
  }
  const gate = document.getElementById("loginGate");
  const app = document.getElementById("appRoot");
  const authed = sessionStorage.getItem(AUTH_KEY) === "1";
  if (authed) {
    gate.classList.add("hidden");
    app.classList.remove("hidden");
  } else {
    gate.classList.remove("hidden");
    app.classList.add("hidden");
  }

  const form = document.getElementById("loginForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = document.getElementById("loginPass").value;
    const stored = localStorage.getItem(PASS_KEY) || DEFAULT_PASS;
    if (val === stored) {
      sessionStorage.setItem(AUTH_KEY, "1");
      gate.classList.add("hidden");
      app.classList.remove("hidden");
      document.getElementById("loginError").classList.add("hidden");
      form.reset();
    } else {
      document.getElementById("loginError").classList.remove("hidden");
    }
  });
}

function logout() {
  sessionStorage.removeItem(AUTH_KEY);
  location.reload();
}

// ============================================================
// SIDEBAR NAV
// ============================================================
function initNav() {
  document.querySelectorAll("[data-section]").forEach((btn) => {
    btn.addEventListener("click", () => {
      showSection(btn.getAttribute("data-section"));
      closeSidebarMobile();
    });
  });

  document.getElementById("hamburgerDash").addEventListener("click", () => {
    document.getElementById("dashSidebar").classList.add("open");
    document.getElementById("sidebarOverlay").classList.add("open");
  });
  document.getElementById("sidebarOverlay").addEventListener("click", closeSidebarMobile);
}

function closeSidebarMobile() {
  document.getElementById("dashSidebar").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("open");
}

function showSection(name) {
  document.querySelectorAll(".dash-section").forEach((s) => s.classList.add("hidden"));
  document.getElementById(`section-${name}`).classList.remove("hidden");

  document.querySelectorAll("[data-section]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-section") === name);
  });

  const titles = {
    ringkasan: ["Ringkasan", "Catat order & pantau penjualan secara realtime"],
    pengaturan: ["Pengaturan", "Preferensi dashboard & keamanan"],
  };
  document.getElementById("pageTitle").textContent = titles[name][0];
  document.getElementById("pageSubtitle").textContent = titles[name][1];
}

// ============================================================
// LIVE CLOCK (format: Kam, 30 Jul 2026, 14.40.18)
// ============================================================
const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function pad(n) { return String(n).padStart(2, "0"); }

function tickClock() {
  const now = new Date();
  const str = `${DAY_NAMES[now.getDay()]}, ${now.getDate()} ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}, ${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`;
  const el = document.getElementById("liveClock");
  if (el) el.textContent = str;
}

function formatWaktuSingkat(iso) {
  const d = new Date(iso);
  return `${pad(d.getDate())} ${MONTH_NAMES[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ============================================================
// ORDER — tambah, hapus, hitung
// ============================================================
function addOrder(e) {
  e.preventDefault();
  const nama = document.getElementById("orderNama").value.trim();
  const kategori = document.getElementById("orderKategori").value.trim() || "Lainnya";
  const hargaJual = Number(document.getElementById("orderHarga").value);
  const qty = Number(document.getElementById("orderQty").value);

  if (!nama) return toast("Nama jasa/produk wajib diisi.", true);
  if (!hargaJual || hargaJual <= 0) return toast("Harga jual harus lebih dari 0.", true);
  if (!qty || qty <= 0) return toast("Jumlah terjual harus lebih dari 0.", true);

  state.orders.push({
    id: uid("ord"),
    nama,
    kategori,
    hargaJual,
    qty,
    pendapatan: hargaJual * qty,
    waktu: new Date().toISOString(),
  });
  saveData();
  renderRingkasan();
  document.getElementById("orderForm").reset();
  toast("Order berhasil dicatat.");
}

function deleteOrder(id) {
  if (!confirm("Hapus data order ini? Tindakan tidak bisa dibatalkan.")) return;
  state.orders = state.orders.filter((o) => o.id !== id);
  saveData();
  renderRingkasan();
  toast("Order dihapus.");
}

function groupByProduk(orders) {
  const map = {};
  orders.forEach((o) => {
    if (!map[o.nama]) map[o.nama] = { nama: o.nama, qty: 0, pendapatan: 0 };
    map[o.nama].qty += o.qty;
    map[o.nama].pendapatan += o.pendapatan;
  });
  return Object.values(map);
}

// ============================================================
// RENDER: RINGKASAN
// ============================================================
function renderRingkasan() {
  const orders = state.orders;

  const totalQty = orders.reduce((a, o) => a + o.qty, 0);
  const totalPendapatan = orders.reduce((a, o) => a + o.pendapatan, 0);
  document.getElementById("statProdukTerjual").textContent = totalQty.toLocaleString("id-ID");
  document.getElementById("statPendapatan").textContent = formatRupiah(totalPendapatan);

  // ---- Peringkat produk ----
  const grouped = groupByProduk(orders).sort((a, b) => b.qty - a.qty);
  const bestList = document.getElementById("bestSellerList");
  const worstList = document.getElementById("worstSellerList");
  bestList.innerHTML = "";
  worstList.innerHTML = "";

  if (!grouped.length) {
    bestList.innerHTML = `<p class="text-sm text-[var(--text-dim)]">Belum ada data.</p>`;
    worstList.innerHTML = `<p class="text-sm text-[var(--text-dim)]">Belum ada data.</p>`;
  } else {
    const best = grouped.slice(0, 3);
    best.forEach((p, i) => {
      bestList.innerHTML += `
        <div class="rank-row">
          <div class="flex items-center gap-2 min-w-0">
            <span class="rank-num">${i + 1}</span>
            <span class="truncate">${esc(p.nama)}</span>
          </div>
          <span class="text-[var(--cyan)] font-mono flex-none">${p.qty} unit</span>
        </div>`;
    });

    if (grouped.length > 1) {
      const worst = [...grouped].sort((a, b) => a.qty - b.qty).slice(0, 3);
      worst.forEach((p, i) => {
        worstList.innerHTML += `
          <div class="rank-row">
            <div class="flex items-center gap-2 min-w-0">
              <span class="rank-num">${i + 1}</span>
              <span class="truncate">${esc(p.nama)}</span>
            </div>
            <span class="text-[var(--pink)] font-mono flex-none">${p.qty} unit</span>
          </div>`;
      });
    } else {
      worstList.innerHTML = `<p class="text-sm text-[var(--text-dim)]">Belum cukup variasi produk.</p>`;
    }
  }

  // ---- Riwayat order ----
  const body = document.getElementById("orderTableBody");
  body.innerHTML = "";
  if (!orders.length) {
    body.innerHTML = `<tr><td colspan="7" class="text-center text-[var(--text-dim)] py-8">Belum ada order. Catat order pertama di form sebelah kiri.</td></tr>`;
  } else {
    orders.forEach((o, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="text-[var(--text-dim)]">${idx + 1}</td>
        <td class="text-[var(--text-dim)]">${formatWaktuSingkat(o.waktu)}</td>
        <td class="font-medium">${esc(o.nama)}</td>
        <td><span class="badge badge-cyan">${esc(o.kategori)}</span></td>
        <td>${o.qty}</td>
        <td>${formatRupiah(o.hargaJual)}</td>
        <td class="text-[var(--cyan)]">${formatRupiah(o.pendapatan)}</td>
        <td>
          <button class="icon-btn danger" onclick="deleteOrder('${o.id}')" title="Hapus">${iconTrash()}</button>
        </td>
      `;
      body.appendChild(tr);
    });
  }
  document.getElementById("footTotalQty").textContent = totalQty.toLocaleString("id-ID");
  document.getElementById("footTotalPendapatan").textContent = formatRupiah(totalPendapatan);
}

// ============================================================
// EXPORT / IMPORT / RESET
// ============================================================
function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `webkarya-order-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  toast("Backup diunduh.");
}

function importJSON(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed.orders)) throw new Error("format tidak sesuai");
      state = parsed;
      saveData();
      renderRingkasan();
      toast("Data berhasil di-import.");
    } catch (e) {
      toast("File tidak valid.", true);
    }
  };
  reader.readAsText(file);
  evt.target.value = "";
}

function resetData() {
  if (!confirm("Hapus semua data order? Tindakan tidak bisa dibatalkan.")) return;
  state = structuredClone(DEFAULT_DATA);
  saveData();
  renderRingkasan();
  toast("Semua data order telah dihapus.");
}

function changePassword(e) {
  e.preventDefault();
  const cur = document.getElementById("curPass").value;
  const next = document.getElementById("newPass").value;
  const stored = localStorage.getItem(PASS_KEY) || DEFAULT_PASS;
  if (cur !== stored) return toast("Password saat ini salah.", true);
  if (!next || next.length < 4) return toast("Password baru minimal 4 karakter.", true);
  localStorage.setItem(PASS_KEY, next);
  document.getElementById("changePassForm").reset();
  toast("Password berhasil diganti.");
}

// ============================================================
// ICONS
// ============================================================
function iconTrash() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M6 7h12M9.5 7V5.5a1.5 1.5 0 011.5-1.5h2a1.5 1.5 0 011.5 1.5V7m-8 0v12a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V7"/></svg>`;
}

// ============================================================
// INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  initNav();
  renderRingkasan();
  showSection("ringkasan");

  tickClock();
  setInterval(tickClock, 1000);

  document.getElementById("orderForm").addEventListener("submit", addOrder);
  document.getElementById("changePassForm").addEventListener("submit", changePassword);

  document.getElementById("btnExport").addEventListener("click", exportJSON);
  document.getElementById("importFile").addEventListener("change", importJSON);
  document.getElementById("btnReset").addEventListener("click", resetData);
  document.getElementById("btnLogout").addEventListener("click", logout);

  // Datalist kategori
  const dl = document.getElementById("kategoriList");
  KATEGORI_SUGGESTIONS.forEach((k) => {
    const opt = document.createElement("option");
    opt.value = k;
    dl.appendChild(opt);
  });
});
