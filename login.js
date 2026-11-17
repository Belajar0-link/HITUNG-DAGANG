/* login.js — Logika halaman masuk, daftar, dan lupa sandi.
   Data akun disimpan di localStorage (cocok untuk belajar).
*/
(function () {
  const KEY_U = "dag_users";   // daftar akun
  const KEY_S = "dag_session"; // siapa yang sedang login
  const $ = (s) => document.querySelector(s);

  const bacaUsers = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY_U)) || [];
    } catch {
      return [];
    }
  };

  const pesan = (el, teks, ok = false) => {
    el.textContent = teks;
    el.className = "msg " + (ok ? "ok" : "err");
  };

  // Kalau sudah login, langsung ke dashboard
  const sesi = localStorage.getItem(KEY_S) || sessionStorage.getItem(KEY_S);
  if (sesi && bacaUsers().some((u) => u.id === sesi)) {
    location.replace("dashboard.html");
    return;
  }

  // Sandi di-hash dengan PBKDF2 + garam acak
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

  async function hash(sandi, garam) {
    if (!window.crypto || !crypto.subtle) {
      throw new Error("Buka lewat http://127.0.0.1 atau localhost.");
    }
    const kunci = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(sandi),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: new TextEncoder().encode(garam),
        iterations: 100000,
        hash: "SHA-256",
      },
      kunci,
      256
    );
    return b64(bits);
  }

  // Tampilkan satu bagian: "masuk", "daftar", atau "lupa"
  function tampilkan(w) {
    ["masuk", "daftar", "lupa"].forEach((n) => {
      $("#f-" + n).hidden = n !== w;
    });
    $(".tabs").hidden = w === "lupa";
    $("#tab-masuk").setAttribute("aria-selected", w === "masuk");
    $("#tab-daftar").setAttribute("aria-selected", w === "daftar");
  }

  const tab = (masuk) => tampilkan(masuk ? "masuk" : "daftar");
  $("#tab-masuk").onclick = () => tab(true);
  $("#tab-daftar").onclick = () => tab(false);

  // ===== DAFTAR =====
  $("#f-daftar").addEventListener("submit", async (e) => {
    e.preventDefault();
    const m = $("#d-msg");
    const btn = $("#d-btn");
    const nama = $("#d-nama").value.trim();
    const email = $("#d-email").value.trim().toLowerCase();
    const sandi = $("#d-pass").value;

    if (!/^\w{3,20}$/.test(nama)) {
      return pesan(m, "Nama pengguna 3–20 karakter, hanya huruf, angka, atau _.");
    }
    if (!/^[a-z0-9._%+-]+@gmail\.com$/.test(email)) {
      return pesan(m, "Gunakan alamat Gmail, contoh: nama@gmail.com.");
    }
    if (sandi.length < 8 || !/[a-z]/i.test(sandi) || !/\d/.test(sandi)) {
      return pesan(m, "Sandi minimal 8 karakter dan harus ada huruf serta angka.");
    }

    const users = bacaUsers();
    const id = nama.toLowerCase();

    if (users.some((u) => u.id === id)) {
      return pesan(m, "Nama pengguna sudah dipakai.");
    }
    if (users.some((u) => u.email === email)) {
      return pesan(m, "Gmail ini sudah terdaftar. Silakan masuk.");
    }

    btn.disabled = true;
    try {
      const garam = b64(crypto.getRandomValues(new Uint8Array(16)));
      users.push({
        id,
        nama,
        email,
        garam,
        hash: await hash(sandi, garam),
      });
      localStorage.setItem(KEY_U, JSON.stringify(users));

      $("#f-daftar").reset();
      tab(true);
      $("#m-id").value = nama;
      pesan($("#m-msg"), "Pendaftaran berhasil. Silakan masuk.", true);
      $("#m-pass").focus();
    } catch (err) {
      pesan(m, err.message);
    }
    btn.disabled = false;
  });

  // ===== MASUK =====
  $("#f-masuk").addEventListener("submit", async (e) => {
    e.preventDefault();
    const m = $("#m-msg");
    const btn = $("#m-btn");
    const ident = $("#m-id").value.trim().toLowerCase();
    const sandi = $("#m-pass").value;

    if (!ident || !sandi) {
      return pesan(m, "Isi nama pengguna/Gmail dan sandi.");
    }

    // Batasi percobaan salah (5x → tunggu 30 detik)
    const kunciL = "dag_lock";
    const lock = JSON.parse(localStorage.getItem(kunciL) || '{"n":0,"sampai":0}');

    if (Date.now() < lock.sampai) {
      return pesan(
        m,
        "Terlalu banyak percobaan. Coba lagi " +
          Math.ceil((lock.sampai - Date.now()) / 1000) +
          " detik lagi."
      );
    }

    btn.disabled = true;
    try {
      const u = bacaUsers().find((x) => x.id === ident || x.email === ident);
      const benar = u && (await hash(sandi, u.garam)) === u.hash;

      if (!benar) {
        lock.n++;
        if (lock.n >= 5) {
          lock.n = 0;
          lock.sampai = Date.now() + 30000;
        }
        localStorage.setItem(kunciL, JSON.stringify(lock));
        pesan(m, "Nama pengguna atau sandi salah, atau akun belum terdaftar.");
        $("#m-pass").value = "";
      } else {
        localStorage.removeItem(kunciL);
        // Centang "Ingat saya" → localStorage, tidak → sessionStorage
        ($("#m-ingat").checked ? localStorage : sessionStorage).setItem(KEY_S, u.id);
        location.replace("dashboard.html");
      }
    } catch (err) {
      pesan(m, err.message);
    }
    btn.disabled = false;
  });

  // ===== LUPA SANDI =====
  // Isi 3 nilai ini dari akun EmailJS kamu kalau mau kirim email sungguhan.
  // Kalau dikosongkan, aplikasi jalan di "mode uji" (kode muncul di layar).
  const EMAILJS = {
    publicKey: "",
    serviceId: "",
    templateId: "",
  };

  const KEY_R = "dag_reset";
  const bacaR = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY_R));
    } catch {
      return null;
    }
  };

  $("#ke-lupa").onclick = () => {
    tampilkan("lupa");
    langkah(1);
  };
  $("#dari-lupa").onclick = () => tampilkan("masuk");
  $("#l-ulang").onclick = () => langkah(1);

  function langkah(n) {
    $("#l-kirim").hidden = n !== 1;
    $("#l-ubah").hidden = n !== 2;
    $("#l-uji").hidden = true;
    $("#l-msg1").textContent = "";
    $("#l-msg2").textContent = "";
  }

  async function kirimEmail(u, kode) {
    if (!EMAILJS.publicKey || !EMAILJS.serviceId || !EMAILJS.templateId) {
      $("#l-uji").hidden = false;
      $("#l-uji").textContent = "Mode uji (EmailJS belum diatur). Kode Anda: " + kode;
      return;
    }

    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS.serviceId,
        template_id: EMAILJS.templateId,
        user_id: EMAILJS.publicKey,
        template_params: {
          to_email: u.email,
          nama: u.nama,
          kode,
        },
      }),
    });

    if (!res.ok) {
      throw new Error("Email gagal terkirim. Periksa pengaturan EmailJS Anda.");
    }
  }

  // Langkah 1: minta kode
  $("#l-kirim").addEventListener("submit", async (e) => {
    e.preventDefault();
    const m = $("#l-msg1");
    const btn = $("#l-btn1");
    const email = $("#l-email").value.trim().toLowerCase();

    if (!/^[a-z0-9._%+-]+@gmail\.com$/.test(email)) {
      return pesan(m, "Masukkan alamat Gmail yang dipakai saat daftar.");
    }

    const r = bacaR();
    if (r && Date.now() - r.kirim < 60000) {
      return pesan(
        m,
        "Tunggu " + Math.ceil((60000 - (Date.now() - r.kirim)) / 1000) + " detik sebelum minta kode lagi."
      );
    }

    $("#l-uji").textContent = "";
    btn.disabled = true;

    try {
      const u = bacaUsers().find((x) => x.email === email);

      if (u) {
        const kode = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
        const garam = b64(crypto.getRandomValues(new Uint8Array(16)));

        localStorage.setItem(
          KEY_R,
          JSON.stringify({
            email,
            garam,
            hash: await hash(kode, garam),
            exp: Date.now() + 600000,
            salah: 0,
            kirim: Date.now(),
          })
        );
        await kirimEmail(u, kode);
      } else {
        // Pesan tetap sama agar Gmail tidak bisa ditebak
        localStorage.setItem(KEY_R, JSON.stringify({ kirim: Date.now(), exp: 0 }));
      }

      const uji = $("#l-uji").textContent;
      langkah(2);
      if (uji) {
        $("#l-uji").hidden = false;
        $("#l-uji").textContent = uji;
      }
      $("#l-kode").focus();
    } catch (err) {
      localStorage.removeItem(KEY_R);
      pesan(m, err.message);
    }
    btn.disabled = false;
  });

  // Langkah 2: masukkan kode + sandi baru
  $("#l-ubah").addEventListener("submit", async (e) => {
    e.preventDefault();
    const m = $("#l-msg2");
    const btn = $("#l-btn2");
    const kode = $("#l-kode").value.trim();
    const baru = $("#l-baru").value;
    const r = bacaR();

    if (!r || !r.hash || Date.now() > r.exp) {
      return pesan(m, "Kode tidak berlaku atau sudah kedaluwarsa. Minta kode baru.");
    }
    if (!/^\d{6}$/.test(kode)) {
      return pesan(m, "Kode terdiri dari 6 angka.");
    }
    if (baru.length < 8 || !/[a-z]/i.test(baru) || !/\d/.test(baru)) {
      return pesan(m, "Sandi baru minimal 8 karakter dan harus ada huruf serta angka.");
    }

    btn.disabled = true;
    try {
      if ((await hash(kode, r.garam)) !== r.hash) {
        r.salah++;
        if (r.salah >= 5) {
          localStorage.removeItem(KEY_R);
          langkah(1);
          pesan($("#l-msg1"), "Terlalu banyak kode salah. Minta kode baru.");
        } else {
          localStorage.setItem(KEY_R, JSON.stringify(r));
          pesan(m, "Kode salah. Sisa percobaan: " + (5 - r.salah) + ".");
        }
      } else {
        const users = bacaUsers();
        const u = users.find((x) => x.email === r.email);
        u.garam = b64(crypto.getRandomValues(new Uint8Array(16)));
        u.hash = await hash(baru, u.garam);
        localStorage.setItem(KEY_U, JSON.stringify(users));
        localStorage.removeItem(KEY_R);
        localStorage.removeItem("dag_lock");

        $("#l-ubah").reset();
        $("#l-kirim").reset();
        tampilkan("masuk");
        $("#m-id").value = u.nama;
        $("#m-pass").value = "";
        pesan($("#m-msg"), "Sandi berhasil diubah. Silakan masuk.", true);
      }
    } catch (err) {
      pesan(m, err.message);
    } finally {
      btn.disabled = false;
    }
  });
})();
