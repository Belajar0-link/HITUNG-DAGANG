/* dashboard.js — Halaman utama Catatan Dagangan
   Ada dua jenis catatan:
   - "jual"   = Pemasukan
   - "keluar" = Pengeluaran
   Bentuk tiap catatan: { id, tgl: "2026-11-18", ket, jumlah }
*/
(function () {
  const KEY_U = "dag_users";
  const KEY_S = "dag_session";
  const $ = (s) => document.querySelector(s);

  // ===== 1. Cek login =====
  const id = localStorage.getItem(KEY_S) || sessionStorage.getItem(KEY_S);
  let users = [];
  try {
    users = JSON.parse(localStorage.getItem(KEY_U)) || [];
  } catch {}
  const akun = users.find((u) => u.id === id);

  const keluar = () => {
    localStorage.removeItem(KEY_S);
    sessionStorage.removeItem(KEY_S);
    location.replace("login.html");
  };

  if (!akun) {
    keluar();
    return;
  }

  $("#nama").textContent = akun.nama;
  $("#keluar").onclick = keluar;

  // ===== 2. Data per user =====
  const JENIS = {
    jual: { pre: "p", label: "Penjualan" },
    keluar: { pre: "k", label: "Pengeluaran" },
  };

  const baca = (j) => {
    try {
      return JSON.parse(localStorage.getItem("dag_" + j + "_" + id)) || [];
    } catch {
      return [];
    }
  };

  const simpan = (j, d) => localStorage.setItem("dag_" + j + "_" + id, JSON.stringify(d));

  // ===== 3. Alat bantu =====
  const rp = (n) => "Rp" + n.toLocaleString("id-ID");
  const p2 = (n) => String(n).padStart(2, "0");
  const kunci = (d) => d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
  const hariKe = (i) => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate() - i);
  };
  const urai = (s) => {
    const [a, b, c] = s.split("-").map(Number);
    return new Date(a, b - 1, c);
  };
  const fmt = (d) =>
    d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
  const esc = (s) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Tampilkan pesan lalu hilangkan otomatis setelah 2.5 detik
  const pesan = (el, teks, ok = false) => {
    el.textContent = teks;
    el.className = "msg " + (ok ? "ok" : "err");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
      el.textContent = "";
      el.className = "msg";
    }, 2500);
  };

  // Total per hari untuk n hari terakhir (termasuk hari ini)
  function totalPerHari(j, n) {
    const peta = {};
    baca(j).forEach((x) => {
      peta[x.tgl] = (peta[x.tgl] || 0) + x.jumlah;
    });

    const hasil = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = hariKe(i);
      hasil.push({ d, total: peta[kunci(d)] || 0 });
    }
    return hasil;
  }

  const jumlah = (arr) => arr.reduce((s, x) => s + x.total, 0);

  // Total untuk periode tertentu
  // periode: 1 = hari ini, 2 = kemarin, 7/30 = n hari terakhir (termasuk hari ini)
  function totalPeriode(j, periode) {
    if (periode === 1) {
      // Hari ini saja
      return totalPerHari(j, 1)[0].total;
    }
    if (periode === 2) {
      // Kemarin saja
      const kemarin = totalPerHari(j, 2);
      return kemarin[0].total; // index 0 = kemarin (karena urut dari lama ke baru)
    }
    // 7 atau 30 hari
    return jumlah(totalPerHari(j, periode));
  }

  // ===== 4. Tampilkan data =====
  let rentang = 7;   // untuk grafik
  let periode = 1;   // untuk ringkasan (default: hari ini)

  function tampil() {
    // Ringkasan sesuai periode yang dipilih
    const masuk = totalPeriode("jual", periode);
    const keluar = totalPeriode("keluar", periode);
    const laba = masuk - keluar;

    $("#st-jual").textContent = rp(masuk);
    $("#st-keluar").textContent = rp(keluar);
    $("#st-laba").textContent = (laba >= 0 ? "" : "-") + rp(Math.abs(laba));
    $("#st-laba").classList.toggle("negatif", laba < 0);

    // Grafik & tabel pemasukan
    const seri = totalPerHari("jual", rentang);
    const maks = Math.max(...seri.map((x) => x.total), 1);

    $("#chart").innerHTML = seri
      .map((x, i) => {
        const label = rentang === 7 || i % 5 === 0 || i === seri.length - 1 ? x.d.getDate() : "";
        return `<div class="col" title="${fmt(x.d)}: ${rp(x.total)}">
          <div class="slot">
            <div class="bar${x.total ? "" : " nol"}" style="height:${(x.total / maks) * 100}%"></div>
          </div>
          <span class="lbl">${label}</span>
        </div>`;
      })
      .join("");

    $("#tabel").innerHTML = seri
      .slice()
      .reverse()
      .map((x) => `<tr><td>${fmt(x.d)}</td><td>${rp(x.total)}</td></tr>`)
      .join("");

    $("#kaki").innerHTML = `<tr><td>Total ${rentang} hari</td><td>${rp(jumlah(seri))}</td></tr>`;

    // Daftar catatan terbaru
    Object.keys(JENIS).forEach((j) => {
      const warna = j === "keluar" ? " merah" : "";
      const terbaru = baca(j)
        .sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id)
        .slice(0, 15);

      $("#" + JENIS[j].pre + "-daftar").innerHTML = terbaru.length
        ? terbaru
            .map(
              (x) => `<li>
            <div>
              <strong>${esc(x.ket || JENIS[j].label)}</strong>
              <span class="muted">${fmt(urai(x.tgl))}</span>
            </div>
            <span class="nilai${warna}">${rp(x.jumlah)}</span>
            <button class="hapus" data-id="${x.id}" aria-label="Hapus catatan">×</button>
          </li>`
            )
            .join("")
        : '<li class="kosong">Belum ada catatan.</li>';
    });
  }

  // ===== 5. Form tambah & hapus =====

  // Format angka dengan titik ribuan (contoh: 50000 → 50.000)
  const formatUang = (angka) => {
    const bersih = String(angka).replace(/\D/g, "");
    if (!bersih) return "";
    return Number(bersih).toLocaleString("id-ID");
  };

  // Ambil nilai numerik dari input yang sudah diformat
  const parseUang = (teks) => {
    const bersih = String(teks).replace(/\D/g, "");
    return bersih ? Number(bersih) : 0;
  };

  Object.keys(JENIS).forEach((j) => {
    const pre = JENIS[j].pre;
    const fTgl = $("#" + pre + "-tgl");
    const fJml = $("#" + pre + "-jml");
    const fKet = $("#" + pre + "-ket");
    const fMsg = $("#" + pre + "-msg");

    // Default tanggal = hari ini
    fTgl.value = fTgl.max = kunci(hariKe(0));

    // Format otomatis saat mengetik
    fJml.addEventListener("input", () => {
      const posisi = fJml.selectionStart;
      const sebelum = fJml.value;
      const sesudah = formatUang(sebelum);

      // Hitung berapa digit yang sudah diketik sebelum kursor
      const digitSebelum = sebelum.slice(0, posisi).replace(/\D/g, "").length;

      fJml.value = sesudah;

      // Kembalikan posisi kursor agar nyaman mengetik
      let digit = 0;
      let posBaru = sesudah.length;
      for (let i = 0; i < sesudah.length; i++) {
        if (/\d/.test(sesudah[i])) digit++;
        if (digit === digitSebelum) {
          posBaru = i + 1;
          break;
        }
      }
      fJml.setSelectionRange(posBaru, posBaru);
    });

    // Submit form
    $("#" + pre + "-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const jml = parseUang(fJml.value);

      if (!fTgl.value) return pesan(fMsg, "Pilih tanggal dulu.");
      if (!(jml > 0) || jml > 1e12) return pesan(fMsg, "Isi jumlah dengan angka lebih dari 0.");

      const data = baca(j);
      data.push({
        id: Date.now(),
        tgl: fTgl.value,
        ket: fKet.value.trim().slice(0, 60),
        jumlah: jml,
      });
      simpan(j, data);

      // Bersihkan form & fokus lagi
      fKet.value = "";
      fJml.value = "";
      fJml.focus();

      pesan(fMsg, "Tersimpan: " + rp(jml), true);
      tampil();
    });

    // Hapus dengan konfirmasi
    $("#" + pre + "-daftar").onclick = (e) => {
      const btn = e.target.closest("[data-id]");
      if (!btn) return;

      if (!confirm("Hapus catatan ini?")) return;

      simpan(
        j,
        baca(j).filter((x) => String(x.id) !== btn.dataset.id)
      );
      tampil();
    };
  });

  // Tombol periode ringkasan (Hari ini / Kemarin / 7 hari / 30 hari)
  document.querySelectorAll("[data-periode]").forEach((b) => {
    b.onclick = () => {
      periode = Number(b.dataset.periode);
      document.querySelectorAll("[data-periode]").forEach((x) => x.classList.toggle("aktif", x === b));
      tampil();
    };
  });

  // Tombol 7 hari / 30 hari untuk grafik
  document.querySelectorAll("[data-r]").forEach((b) => {
    b.onclick = () => {
      rentang = Number(b.dataset.r);
      document.querySelectorAll("[data-r]").forEach((x) => x.classList.toggle("aktif", x === b));
      tampil();
    };
  });

  // ===== 6. Navigasi menu =====
  const MENU = ["dashboard", "pemasukan", "pengeluaran"];

  function lihat() {
    const h = location.hash.slice(1);
    const aktif = MENU.includes(h) ? h : "dashboard";

    MENU.forEach((n) => {
      $("#v-" + n).hidden = n !== aktif;
      $("#nav-" + n).classList.toggle("aktif", n === aktif);
    });

    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", lihat);

  // Jalankan
  lihat();
  tampil();
})();
