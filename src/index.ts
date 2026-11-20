import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { handleCommand } from "./commands";

// Opsional: isi dengan Group JID spesifik kalau mau bot CUMA aktif di 1 grup itu saja.
// Kosongkan ("") dulu di awal agar kamu bisa ketik /groupid di grupmu untuk dapat ID-nya.
const ALLOWED_GROUP_ID = "120363407314692078@g.us";

// Menyimpan ID pesan yang dikirim oleh bot sendiri agar tidak dibalas ulang (anti-loop)
const botSentMessageIds = new Set<string>();

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n📱 SCAN QR CODE INI DARI WHATSAPP DI HP LO (Perangkat Tertaut):\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;
      console.log("Koneksi terputus. Reconnect:", shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === "open") {
      console.log("✅ BOT WHATSAPP AKTIF & SIAP DIPAKAI DI GRUP!");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message) continue;

      const msgId = msg.key.id;
      // Abaikan pesan yang baru saja dikirim oleh bot ini sendiri
      if (msgId && botSentMessageIds.has(msgId)) {
        botSentMessageIds.delete(msgId);
        continue;
      }

      const remoteJid = msg.key.remoteJid;
      // Pastikan hanya merespons di dalam GRUP (@g.us), abaikan chat pribadi!
      if (!remoteJid || !remoteJid.endsWith("@g.us")) continue;

      // Jika ALLOWED_GROUP_ID diisi, abaikan grup lain
      if (ALLOWED_GROUP_ID && remoteJid !== ALLOWED_GROUP_ID) continue;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      if (!text.startsWith("/")) continue;

      const senderName = msg.pushName || (msg.key.fromMe ? "Owner" : "Member");
      const replyText = handleCommand(remoteJid, senderName, text);

      if (replyText) {
        const sent = await sock.sendMessage(
          remoteJid,
          { text: replyText },
          { quoted: msg }
        );
        if (sent?.key?.id) {
          botSentMessageIds.add(sent.key.id);
        }
      }
    }
  });
}

startBot();