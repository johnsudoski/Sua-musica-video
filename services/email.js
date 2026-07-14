/**
 * Envio do email final com o vídeo-homenagem pronto.
 * Mesmo padrão do site principal (Resend > SMTP > Gmail).
 */

const axios = require('axios');
const nodemailer = require('nodemailer');

function buildHtml({ nomeDestinatario, videoUrl }) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Seu vídeo-homenagem está pronto! 🎬</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0D0D1A; color: #fff; margin: 0; padding: 20px; }
    .container { max-width: 580px; margin: 0 auto; background: #161628; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #E91E8C, #7B2FBE); padding: 40px 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; color: #fff; }
    .body { padding: 32px 30px; }
    .body p { color: #ccc; line-height: 1.6; margin: 0 0 16px; }
    .name { color: #E91E8C; font-weight: bold; }
    .btn { display: block; background: linear-gradient(135deg, #E91E8C, #7B2FBE); color: #fff !important; text-decoration: none; text-align: center; padding: 16px 32px; border-radius: 50px; font-size: 18px; font-weight: bold; margin: 24px 0; }
    .footer { padding: 24px 30px; border-top: 1px solid #2a2a45; text-align: center; }
    .footer p { color: #555; font-size: 13px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎬 SuaMúsicaAI — Vídeo Homenagem</h1>
    </div>
    <div class="body">
      <p>Olá! 💕</p>
      <p>O vídeo-homenagem para <span class="name">${nomeDestinatario}</span> ficou pronto, com suas fotos e vídeos ao som da música criada especialmente pra vocês.</p>
      <a href="${videoUrl}" class="btn">🎬 Assistir e baixar meu vídeo</a>
      <p>Com carinho,<br><strong>Equipe SuaMúsicaAI</strong></p>
    </div>
    <div class="footer">
      <p>SuaMúsicaAI • O presente mais emocionante do Brasil 🇧🇷</p>
    </div>
  </div>
</body>
</html>`.trim();
}

async function sendViaResend({ to, from, subject, html, text }) {
  const res = await axios.post(
    'https://api.resend.com/emails',
    { from, to, subject, html, text },
    { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 15000 }
  );
  return res.data;
}

async function sendViaGmail({ to, from, subject, html, text }) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  return transporter.sendMail({ from, to, subject, html, text });
}

async function sendVideoReadyEmail({ to, nomeDestinatario, videoUrl }) {
  const from    = process.env.EMAIL_FROM || 'SuaMúsicaAI <onboarding@resend.dev>';
  const subject = `🎬 O vídeo-homenagem para ${nomeDestinatario} está pronto!`;
  const html    = buildHtml({ nomeDestinatario, videoUrl });
  const text    = `Seu vídeo-homenagem para ${nomeDestinatario} está pronto!\n\nAssista e baixe: ${videoUrl}\n\nEquipe SuaMúsicaAI`;

  if (process.env.RESEND_API_KEY) {
    console.log(`[email] Enviando vídeo pronto via Resend para ${to}`);
    const info = await sendViaResend({ to, from, subject, html, text });
    console.log(`[email] Resend OK: ${info.id}`);
    return info;
  }

  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    console.log(`[email] Enviando vídeo pronto via Gmail para ${to}`);
    const info = await sendViaGmail({ to, from, subject, html, text });
    console.log(`[email] Gmail OK: ${info.messageId}`);
    return info;
  }

  console.log('\n====== [EMAIL VIDEO PRONTO - SEM CONFIG] ======');
  console.log('Para:', to, '| Vídeo:', videoUrl);
  console.log('===============================================\n');
  return { messageId: 'no-config', to };
}

module.exports = { sendVideoReadyEmail };
