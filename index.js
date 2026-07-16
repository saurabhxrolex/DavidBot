const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const P = require("pino");
const qrcode = require("qrcode-terminal");
const config = require("./config");

const warnings = new Map();

const LINK_REGEX =
/(chat\.whatsapp\.com\/|https?:\/\/|www\.|t\.me\/|telegram\.me\/|discord\.gg\/|bit\.ly|tinyurl\.com|cutt\.ly|goo\.gl|instagram\.com|facebook\.com|youtube\.com|youtu\.be|twitter\.com|x\.com)/i;

async function startDavid() {

const { state, saveCreds } =
await useMultiFileAuthState("./session");

const { version } =
await fetchLatestBaileysVersion();

const sock = makeWASocket({
version,
auth: state,
printQRInTerminal: false,
logger: P({ level: "silent" }),
browser: ["David", "Chrome", "1.0.0"]
});

sock.ev.on("connection.update", ({
connection,
qr,
lastDisconnect
}) => {

if (qr) {
console.clear();
console.log("Scan QR Code");
qrcode.generate(qr, { small: true });
}

if (connection === "open") {
console.clear();
console.log("==============================");
console.log(" David Bot Connected");
console.log("==============================");
}

if (connection === "close") {

const shouldReconnect =
lastDisconnect?.error?.output?.statusCode !==
DisconnectReason.loggedOut;

if (shouldReconnect) {
startDavid();
} else {
console.log("Logged Out");
}

}

});

sock.ev.on("creds.update", saveCreds);

sock.ev.on("messages.upsert", async ({ messages }) => {

const msg = messages[0];

if (!msg.message) return;
if (msg.key.fromMe) return;

const jid = msg.key.remoteJid;

if (!jid.endsWith("@g.us")) return;

const metadata = await sock.groupMetadata(jid);

const sender = msg.key.participant;

const admins = metadata.participants
.filter(x => x.admin)
.map(x => x.id);

const isAdmin = admins.includes(sender);

const OWNER =
config.OWNER_NUMBER + "@s.whatsapp.net";

if (sender === OWNER) return;
if (isAdmin) return;

const text =
msg.message?.conversation ||
msg.message?.extendedTextMessage?.text ||
msg.message?.imageMessage?.caption ||
msg.message?.videoMessage?.caption ||
"";

console.log("Group :", metadata.subject);
console.log("User  :", sender);
console.log("Text  :", text);
// ===== Anti Bad Word =====

const lowerText = text.toLowerCase().trim();

if (config.SETTINGS.ANTI_BADWORD && text) {

  const found = config.BAD_WORDS.some(word =>
    lowerText.includes(word.toLowerCase())
  );

  if (found) {

    try {
      await sock.sendMessage(jid, {
        delete: msg.key
      });
    } catch (err) {
      console.log("Delete Error:", err);
    }

    await sock.sendMessage(jid, {
      text: `⚠️ *David*\n\n@${sender.split("@")[0]}\nAbusive message delete kar diya gaya.`,
      mentions: [sender]
    });

    return;
  }
}

// ===== Anti Link =====

if (config.SETTINGS.ANTI_LINK && LINK_REGEX.test(text)) {

  try {
    await sock.sendMessage(jid, {
      delete: msg.key
    });
  } catch (err) {
    console.log("Delete Error:", err);
  }

  let count = warnings.get(sender) || 0;
  count++;
  warnings.set(sender, count);

  if (count === 1) {

    await sock.sendMessage(jid, {
      text: `⚠️ *David*\n\n@${sender.split("@")[0]}\nWarning 1/3\nLinks allowed nahi hain.`,
      mentions: [sender]
    });

    return;

  } else if (count === 2) {

    await sock.sendMessage(jid, {
      text: `⚠️ *David*\n\n@${sender.split("@")[0]}\nWarning 2/3\nAgli baar remove kar diye jaoge.`,
      mentions: [sender]
    });

    return;

  } else {

    warnings.delete(sender);
        try {

      await sock.groupParticipantsUpdate(
        jid,
        [sender],
        "remove"
      );

      await sock.sendMessage(jid, {
        text: `🚫 *David*\n\n@${sender.split("@")[0]} ko 3 baar link bhejne par group se remove kar diya gaya.`,
        mentions: [sender]
      });

    } catch (err) {

      console.log("Kick Error:", err);

      await sock.sendMessage(jid, {
        text: "❌ User remove nahi ho paya. David ko group admin banao."
      });

    }

    return;
  }
});

}

startDavid();
