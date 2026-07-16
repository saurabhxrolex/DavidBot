const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeInMemoryStore
} = require("@whiskeysockets/baileys");
const warnings = new Map();

const LINK_REGEX =
/(chat\.whatsapp\.com\/|https?:\/\/|www\.|t\.me\/|telegram\.me\/|discord\.gg\/|bit\.ly|tinyurl\.com|cutt\.ly|goo\.gl|instagram\.com|facebook\.com|youtube\.com|youtu\.be|twitter\.com|x\.com)/i;
const P = require("pino");
const qrcode = require("qrcode-terminal");



async function startDavid() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: "silent" }),
    browser: ["David", "Chrome", "1.0.0"]
  });

  ;

  sock.ev.on("connection.update", ({ connection, qr, lastDisconnect }) => {

    if (qr) {
      console.clear();
      console.log("Scan QR Code");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.clear();
      console.log("=================================");
      console.log(" David Bot Connected Successfully");
      console.log("=================================");
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error?.output?.statusCode !==
          DisconnectReason.loggedOut);

      if (shouldReconnect) {
        startDavid();
      } else {
        console.log("Logged Out!");
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // ===== Messages =====

  sock.ev.on("messages.upsert", async ({ messages }) => {

    const msg = messages[0];

    if (!msg.message) return;

    if (msg.key.fromMe) return;

    const jid = msg.key.remoteJid;

    if (!jid.endsWith("@g.us")) return;

    const metadata = await sock.groupMetadata(jid);

    const sender = msg.key.participant;

    const admins = metadata.participants
      .filter(v => v.admin)
      .map(v => v.id);

    const isAdmin = admins.includes(sender);

    const OWNER = "918601322748@s.whatsapp.net";

    if (sender === OWNER) return;

    if (isAdmin) return;

    let text = "";

    if (msg.message.conversation)
      text = msg.message.conversation;

    if (msg.message.extendedTextMessage)
      text = msg.message.extendedTextMessage.text;

    console.log("Group :", metadata.subject);
    console.log("User  :", sender);
    console.log("Text  :", text);
    // ===== Anti Link =====

if (LINK_REGEX.test(text)) {

    await sock.sendMessage(jid, {
        delete: msg.key
    });

    let count = warnings.get(sender) || 0;
    count++;
    warnings.set(sender, count);

    if (count === 1) {

        await sock.sendMessage(jid, {
            text: `⚠️ @${sender.split("@")[0]}\n\nWarning 1/3\nLinks allowed nahi hain.`,
            mentions: [sender]
        });

    } else if (count === 2) {

        await sock.sendMessage(jid, {
            text: `⚠️ @${sender.split("@")[0]}\n\nWarning 2/3\nAgli baar remove kar diye jaoge.`,
            mentions: [sender]
        });

    } else {

        try {

            await sock.groupParticipantsUpdate(
                jid,
                [sender],
                "remove"
            );

            await sock.sendMessage(jid, {
                text: `🚫 @${sender.split("@")[0]} ko 3 baar link bhejne par remove kar diya gaya.`,
                mentions: [sender]
            });

            warnings.delete(sender);

        } catch (err) {

            console.log(err);

            await sock.sendMessage(jid, {
                text: "❌ User remove nahi ho paya. David ko admin banao."
            });

        }

    }

    return;
}
  });

}

startDavid();
