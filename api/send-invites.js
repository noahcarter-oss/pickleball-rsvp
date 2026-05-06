const SUPABASE_URL = "https://gikfiuargopavlzcbcnu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_gi5_tJVl_-Ni_2HF6UEduA_D9DCwBL5";
const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "Pickleball RSVP <games@pickleball.noahc.xyz>";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { gameId } = req.body || {};
    if (!gameId) return res.status(400).json({ error: "Missing gameId" });
    if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: "Missing RESEND_API_KEY" });

    const game = await supabaseGet(`games?select=*&id=eq.${encodeURIComponent(gameId)}`);
    const invitees = await supabaseGet(
      `invitees?select=*&game_id=eq.${encodeURIComponent(gameId)}&email=not.is.null&order=name.asc`,
    );

    if (!game.length) return res.status(404).json({ error: "Game not found" });
    const recipients = invitees.map((invitee) => invitee.email).filter(Boolean);
    if (!recipients.length) return res.status(400).json({ error: "No invitees have email addresses" });

    const activeGame = game[0];
    const appUrl = req.headers.origin || "https://noahcarter-oss.github.io/pickleball-rsvp";
    const rsvpUrl = `${appUrl.replace(/\/$/, "")}/?game=${activeGame.id}`;

    await sendEmail({
      to: recipients,
      subject: "Pickleball RSVP",
      html: emailTemplate({
        title: "Pickleball?",
        body: `${activeGame.game_time} at ${activeGame.location}`,
        note: activeGame.note,
        buttonText: "RSVP",
        buttonUrl: rsvpUrl,
      }),
    });

    return res.status(200).json({ sent: recipients.length });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};

async function supabaseGet(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  const body = await response.json();
  if (!response.ok) throw new Error(body.message || "Supabase request failed");
  return body;
}

async function sendEmail({ to, subject, html }) {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || DEFAULT_FROM,
      to,
      subject,
      html,
    }),
  });

  const body = await response.json();
  if (!response.ok) throw new Error(body.message || "Resend request failed");
  return body;
}

function emailTemplate({ title, body, note, buttonText, buttonUrl }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #202522;">
      <h1 style="margin: 0 0 12px; color: #215848;">${escapeHtml(title)}</h1>
      <p style="font-size: 18px; margin: 0 0 10px;">${escapeHtml(body)}</p>
      <p style="font-size: 15px; color: #667169; margin: 0 0 22px;">${escapeHtml(note)}</p>
      <a href="${buttonUrl}" style="display: inline-block; background: #2f7d64; color: white; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 700;">${escapeHtml(buttonText)}</a>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
