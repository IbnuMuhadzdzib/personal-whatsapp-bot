import { db } from "./db";

function formatCountdown(targetIso: string): string {
  const target = new Date(targetIso).getTime();
  if (isNaN(target)) return "Format tanggal tidak valid";

  const diff = target - Date.now();
  if (diff <= 0) return "✅ Sudah lewat / sedang berlangsung!";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);

  return `⏳ ${days} hari, ${hours} jam, ${minutes} menit lagi`;
}

export function handleCommand(
  groupId: string,
  senderName: string,
  rawText: string
): string | null {
  const text = rawText.trim();
  if (!text.startsWith("/")) return null;

  const [cmdRaw, ...restParts] = text.split(" ");
  const cmd = cmdRaw.toLowerCase();
  const arg = restParts.join(" ").trim();

  // ==================== 0. HELP / MENU ====================
  if (cmd === "/help" || cmd === "/menu") {
    return [
      "🤖 *MENU BOT GRUP (ON-DEMAND)*",
      "",
      "📌 *1. TODO TASK*",
      "• `/todo add <tugas>` — Tambah tugas",
      "• `/todo list` — Lihat daftar tugas",
      "• `/todo done <id>` — Tandai selesai",
      "• `/todo del <id>` — Hapus tugas",
      "",
      "🗓️ *2. EVENT & COUNTDOWN*",
      "• `/event add <Nama> | <YYYY-MM-DD HH:mm>`",
      "• `/event list` — Lihat jadwal & countdown",
      "• `/event del <id>` — Hapus event",
      "",
      "📒 *3. MULTI-CATATAN (BANYAK LEMBAR)*",
      "• `/note set <nama-lembar> | <isi>` — Buat/timpa lembar",
      "• `/note append <nama-lembar> | <isi>` — Tambah baris ke lembar",
      "• `/note read <nama-lembar>` — Baca isi lembar",
      "• `/note list` — Lihat semua daftar lembar",
      "• `/note del <nama-lembar>` — Hapus lembar",
      "",
      "⏰ *4. REMINDER (CEK INTERAKTIF)*",
      "• `/remind add <YYYY-MM-DD HH:mm> | <pesan>`",
      "• `/remind list` — Cek semua reminder & status jatuh tempo",
      "• `/remind del <id>` — Hapus reminder",
      "",
      "📝 *5. TEMPLATE CUSTOM*",
      "• `/tpl save <nama> | <teks dgn {{var}}>`",
      "• `/tpl use <nama> | var1=nilai1; var2=nilai2`",
      "• `/tpl list` — Lihat daftar template",
      "• `/tpl del <nama>` — Hapus template",
      "",
      "🎲 *6. EXTRA*",
      "• `/pick opsi1, opsi2, opsi3` — Pilih acak",
      "• `/groupid` — Cek ID grup ini",
    ].join("\n");
  }

  // ==================== EXTRA: GROUP ID & PICK ====================
  if (cmd === "/groupid") {
    return `🆔 Group JID:\n\`${groupId}\``;
  }

  if (cmd === "/pick") {
    const items = arg.split(",").map((s) => s.trim()).filter(Boolean);
    if (items.length < 2) return "❌ Masukkan minimal 2 pilihan dipisah koma.\nContoh: `/pick Nasi Goreng, Mie Ayam, Sate`";
    const chosen = items[Math.floor(Math.random() * items.length)];
    return `🎲 Pilihan terpilih: *${chosen}*`;
  }

  // ==================== 1. TODO TASK ====================
  if (cmd === "/todo") {
    const [sub, ...subArgs] = arg.split(" ");
    const val = subArgs.join(" ").trim();

    if (sub === "add") {
      if (!val) return "❌ Contoh: `/todo add Beli domain baru`";
      db.run(
        "INSERT INTO todos (group_id, title, created_by) VALUES (?, ?, ?)",
        [groupId, val, senderName]
      );
      return `✅ Todo ditambahkan: *${val}*`;
    }

    if (sub === "list" || !sub) {
      const rows = db
        .query("SELECT id, title, is_done, created_by FROM todos WHERE group_id = ? ORDER BY id ASC")
        .all(groupId) as any[];
      if (!rows.length) return "📭 Belum ada todo di grup ini.";
      const lines = rows.map(
        (r) => `${r.is_done ? "☑️" : "⬜"} *[${r.id}]* ${r.title} _(${r.created_by})_`
      );
      return `📌 *DAFTAR TODO GRUP:*\n\n${lines.join("\n")}`;
    }

    if (sub === "done") {
      const id = Number(val);
      if (!id) return "❌ Masukkan ID todo. Contoh: `/todo done 1`";
      db.run("UPDATE todos SET is_done = 1 WHERE id = ? AND group_id = ?", [id, groupId]);
      return `☑️ Todo *[${id}]* ditandai selesai!`;
    }

    if (sub === "del") {
      const id = Number(val);
      if (!id) return "❌ Masukkan ID todo. Contoh: `/todo del 1`";
      db.run("DELETE FROM todos WHERE id = ? AND group_id = ?", [id, groupId]);
      return `🗑️ Todo *[${id}]* dihapus.`;
    }
  }

  // ==================== 2. EVENT & COUNTDOWN ====================
  if (cmd === "/event") {
    const [sub, ...subArgs] = arg.split(" ");
    const val = subArgs.join(" ").trim();

    if (sub === "add") {
      const [title, timeStr] = val.split("|").map((s) => s.trim());
      if (!title || !timeStr) {
        return "❌ Format salah.\nContoh: `/event add Liburan Bareng | 2026-12-25 08:00`";
      }
      const iso = timeStr.replace(" ", "T");
      if (isNaN(new Date(iso).getTime())) {
        return "❌ Format tanggal salah. Gunakan `YYYY-MM-DD HH:mm` (Contoh: `2026-12-25 08:00`).";
      }
      db.run(
        "INSERT INTO events (group_id, title, event_time, created_by) VALUES (?, ?, ?, ?)",
        [groupId, title, iso, senderName]
      );
      return `🗓️ Event *${title}* disimpan!\n${formatCountdown(iso)}`;
    }

    if (sub === "list" || !sub) {
      const rows = db
        .query("SELECT id, title, event_time FROM events WHERE group_id = ? ORDER BY event_time ASC")
        .all(groupId) as any[];
      if (!rows.length) return "📭 Belum ada jadwal event.";
      const lines = rows.map(
        (r) =>
          `*[${r.id}] ${r.title}*\n   📅 ${r.event_time.replace("T", " ")}\n   ${formatCountdown(r.event_time)}`
      );
      return `🗓️ *JADWAL EVENT & COUNTDOWN:*\n\n${lines.join("\n\n")}`;
    }

    if (sub === "del") {
      const id = Number(val);
      if (!id) return "❌ Contoh: `/event del 1`";
      db.run("DELETE FROM events WHERE id = ? AND group_id = ?", [id, groupId]);
      return `🗑️ Event *[${id}]* dihapus.`;
    }
  }

// ==================== 3. MULTI-CATATAN (BANYAK LEMBAR) ====================
  if (cmd === "/note" || cmd === "/catatan") {
    const [sub, ...subArgs] = arg.split(" ");
    const val = subArgs.join(" ").trim();

    const formatNoteText = (input: string): string => {
      return input
        .replaceAll("\\n", "\n")
        // Pecah pola " 2. ", " 3. ", dst. menjadi baris baru jika ditulis menyamping
        .replace(/\s+(?=\d+\.\s+)/g, "\n")
        .trim();
    };

    if (sub === "set") {
      const [sheetRaw, ...contentParts] = val.split("|");
      const sheet = sheetRaw?.trim().toLowerCase();
      const rawContent = contentParts.join("|").trim();
      if (!sheet || !rawContent) {
        return "❌ Contoh: `/note set belanja | 1. Beras 5kg, 2. Telur 1kg`";
      }
      const content = formatNoteText(rawContent);
      db.run(
        `INSERT INTO notes (group_id, sheet_name, content, updated_by, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(group_id, sheet_name)
         DO UPDATE SET content = excluded.content, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`,
        [groupId, sheet, content, senderName]
      );
      return `📒 Lembar catatan *${sheet}* berhasil disimpan!`;
    }

    if (sub === "append") {
      const [sheetRaw, ...contentParts] = val.split("|");
      const sheet = sheetRaw?.trim().toLowerCase();
      const rawContent = contentParts.join("|").trim();
      if (!sheet || !rawContent) {
        return "❌ Contoh: `/note append belanja | 3. Kopi sachet`";
      }
      const formattedAdd = formatNoteText(rawContent);
      const existing = db
        .query("SELECT content FROM notes WHERE group_id = ? AND sheet_name = ?")
        .get(groupId, sheet) as any;

      const newContent = existing ? `${existing.content}\n${formattedAdd}` : formattedAdd;
      db.run(
        `INSERT INTO notes (group_id, sheet_name, content, updated_by, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(group_id, sheet_name)
         DO UPDATE SET content = excluded.content, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`,
        [groupId, sheet, newContent, senderName]
      );
      return `➕ Ditambahkan ke lembar *${sheet}*!`;
    }

    if (sub === "read") {
      const sheet = val.toLowerCase();
      if (!sheet) return "❌ Contoh: `/note read belanja`";
      const row = db
        .query("SELECT sheet_name, content, updated_by, updated_at FROM notes WHERE group_id = ? AND sheet_name = ?")
        .get(groupId, sheet) as any;
      if (!row) return `❌ Lembar *${sheet}* tidak ditemukan. Cek \`/note list\`.`;
      return `📄 *LEMBAR: ${row.sheet_name.toUpperCase()}*\n_Update terakhir oleh ${row.updated_by}_\n\n${row.content}`;
    }

    if (sub === "list" || !sub) {
      const rows = db
        .query("SELECT sheet_name, updated_by FROM notes WHERE group_id = ? ORDER BY sheet_name ASC")
        .all(groupId) as any[];
      if (!rows.length) return "📭 Belum ada lembar catatan tersimpan.";
      const lines = rows.map((r, i) => `${i + 1}. *${r.sheet_name}* _(oleh ${r.updated_by})_`);
      return `📚 *DAFTAR LEMBAR CATATAN:*\n\n${lines.join("\n")}\n\nKetik \`/note read <nama>\` untuk membuka.`;
    }

    if (sub === "del") {
      const sheet = val.toLowerCase();
      if (!sheet) return "❌ Contoh: `/note del belanja`";
      db.run("DELETE FROM notes WHERE group_id = ? AND sheet_name = ?", [groupId, sheet]);
      return `🗑️ Lembar *${sheet}* dihapus.`;
    }
  }

  // ==================== 4. REMINDER ====================
  if (cmd === "/remind") {
    const [sub, ...subArgs] = arg.split(" ");
    const val = subArgs.join(" ").trim();

    if (sub === "add") {
      const [timeStr, ...msgParts] = val.split("|");
      const message = msgParts.join("|").trim();
      const iso = timeStr?.trim().replace(" ", "T");
      if (!iso || !message || isNaN(new Date(iso).getTime())) {
        return "❌ Format salah.\nContoh: `/remind add 2026-11-21 09:00 | Bayar tagihan server`";
      }
      db.run(
        "INSERT INTO reminders (group_id, remind_time, message, created_by) VALUES (?, ?, ?, ?)",
        [groupId, iso, message, senderName]
      );
      return `⏰ Reminder dicatat untuk *${iso.replace("T", " ")}*:\n"${message}"`;
    }

    if (sub === "list" || !sub) {
      const rows = db
        .query("SELECT id, remind_time, message, created_by FROM reminders WHERE group_id = ? ORDER BY remind_time ASC")
        .all(groupId) as any[];
      if (!rows.length) return "📭 Tidak ada reminder.";
      const now = Date.now();
      const lines = rows.map((r) => {
        const isDue = new Date(r.remind_time).getTime() <= now;
        const status = isDue ? "🔔 *JATUH TEMPO!*" : formatCountdown(r.remind_time);
        return `*[${r.id}]* ${r.message}\n   🕒 ${r.remind_time.replace("T", " ")} — ${status}`;
      });
      return `⏰ *DAFTAR REMINDER GRUP:*\n\n${lines.join("\n\n")}`;
    }

    if (sub === "del") {
      const id = Number(val);
      if (!id) return "❌ Contoh: `/remind del 1`";
      db.run("DELETE FROM reminders WHERE id = ? AND group_id = ?", [id, groupId]);
      return `🗑️ Reminder *[${id}]* dihapus.`;
    }
  }

  // ==================== 5. TEMPLATE GENERATOR ====================
  if (cmd === "/tpl" || cmd === "/template") {
    const [sub, ...subArgs] = arg.split(" ");
    const val = subArgs.join(" ").trim();

    if (sub === "save") {
      const [nameRaw, ...bodyParts] = val.split("|");
      const name = nameRaw?.trim().toLowerCase();
      const body = bodyParts.join("|").trim();
      if (!name || !body) {
        return "❌ Format salah.\nContoh: `/tpl save izin | Halo tim, tanggal {{tgl}} gw izin karena {{alasan}}.`";
      }
      db.run(
        `INSERT INTO templates (group_id, name, body) VALUES (?, ?, ?)
         ON CONFLICT(group_id, name) DO UPDATE SET body = excluded.body`,
        [groupId, name, body]
      );
      return `📝 Template *${name}* berhasil disimpan!`;
    }

    if (sub === "use") {
      const [nameRaw, varsRaw] = val.split("|");
      const name = nameRaw?.trim().toLowerCase();
      if (!name) return "❌ Contoh: `/tpl use izin | tgl=22 Nov; alasan=urusan keluarga`";

      const tpl = db
        .query("SELECT body FROM templates WHERE group_id = ? AND name = ?")
        .get(groupId, name) as any;
      if (!tpl) return `❌ Template *${name}* tidak ditemukan. Cek \`/tpl list\`.`;

      let rendered: string = tpl.body;
      if (varsRaw) {
        const pairs = varsRaw.split(";").map((s) => s.trim()).filter(Boolean);
        for (const pair of pairs) {
          const [k, ...vParts] = pair.split("=");
          const key = k?.trim();
          const value = vParts.join("=").trim();
          if (key) {
            rendered = rendered.replaceAll(`{{${key}}}`, value);
          }
        }
      }
      return rendered;
    }

    if (sub === "list" || !sub) {
      const rows = db
        .query("SELECT name, body FROM templates WHERE group_id = ? ORDER BY name ASC")
        .all(groupId) as any[];
      if (!rows.length) return "📭 Belum ada template tersimpan.";
      const lines = rows.map((r) => `• *${r.name}*: \`${r.body}\``);
      return `📝 *DAFTAR TEMPLATE:*\n\n${lines.join("\n")}`;
    }

    if (sub === "del") {
      const name = val.toLowerCase();
      if (!name) return "❌ Contoh: `/tpl del izin`";
      db.run("DELETE FROM templates WHERE group_id = ? AND name = ?", [groupId, name]);
      return `🗑️ Template *${name}* dihapus.`;
    }
  }

  return null;
}