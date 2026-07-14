/**
 * SuaMúsicaAI — Vídeo Homenagem
 * Coleta briefing + upload de fotos/vídeos ANTES do checkout, e depois que
 * o pagamento é confirmado (pelo site principal), monta automaticamente
 * o vídeo real via Creatomate juntando o material enviado com a música.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const db = require('./services/db');
const { generateTributeVideo } = require('./services/creatomate');
const { sendVideoReadyEmail } = require('./services/email');

const app = express();
const PORT = process.env.PORT || 3001;

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024, files: 10 }, // até 150MB por arquivo, 10 arquivos
});

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── POST /api/request — recebe briefing + upload, cria o pedido e devolve o link do checkout ───
app.post('/api/request', upload.array('files', 10), async (req, res) => {
  const { nome, relacao, memoria, genero, voz, email, brief } = req.body;

  if (!nome || !relacao || !memoria || !genero || !email) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Envie pelo menos uma foto ou vídeo.' });
  }

  try {
    const requestId = crypto.randomUUID();
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const requestDir = path.join(UPLOADS_DIR, requestId);
    fs.mkdirSync(requestDir, { recursive: true });

    const uploadedFiles = req.files.map((f) => {
      const safeName = f.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const filePath = path.join(requestDir, safeName);
      fs.writeFileSync(filePath, f.buffer);
      return {
        filename: safeName,
        url: `${appUrl}/uploads/${requestId}/${encodeURIComponent(safeName)}`,
        type: f.mimetype.startsWith('video/') ? 'video' : 'image',
      };
    });

    await db.createVideoRequest({
      requestId,
      email,
      formData: { nomeDestinatario: nome, relacao, memoria, genero, voz: voz || 'feminino' },
      brief,
      uploadedFiles,
    });

    const checkoutBase = process.env.TICTO_CHECKOUT_VIDEO || 'https://checkout.ticto.app/OD8AA1433';
    const url = new URL(checkoutBase);
    url.searchParams.set('utm_campaign', requestId);
    url.searchParams.set('email', email);

    console.log(`[request] Pedido criado: ${requestId} | email=${email} | arquivos=${uploadedFiles.length}`);
    res.json({ success: true, requestId, checkoutUrl: url.toString() });
  } catch (err) {
    console.error('[request] Erro ao criar pedido:', err.message);
    res.status(500).json({ error: 'Erro ao processar seu pedido. Tente novamente.' });
  }
});

// ─── GET /api/status?email= — consulta status do(s) pedido(s) por email ───
app.get('/api/status', async (req, res) => {
  const email = (req.query.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'Email obrigatório.' });

  try {
    const rows = await db.getVideoRequestsByEmail(email);
    res.json({ requests: rows.map(r => ({
      requestId: r.request_id,
      status: r.status,
      nomeDestinatario: r.nome_destinatario,
      videoUrl: r.video_url,
      createdAt: r.created_at,
    })) });
  } catch (err) {
    console.error('[status] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao consultar status.' });
  }
});

// ─── SPA fallback ───
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Worker: processa pedidos pagos, montando o vídeo real ───
let isProcessing = false;
async function processPaidRequests() {
  if (isProcessing) return;
  isProcessing = true;
  try {
    const paidRequests = await db.getVideoRequestsByStatus('paid');
    for (const reqRow of paidRequests) {
      const requestId = reqRow.request_id;
      try {
        console.log(`[worker] Montando vídeo para request_id ${requestId}...`);
        await db.updateVideoRequestStatus(requestId, 'processing');

        const mediaFiles = reqRow.uploaded_files || [];
        const { videoUrl } = await generateTributeVideo({
          audioUrl: reqRow.audio_url,
          nomeDestinatario: reqRow.nome_destinatario,
          mediaFiles,
        });

        await db.updateVideoRequestStatus(requestId, 'ready', { video_url: videoUrl });

        if (reqRow.email) {
          await sendVideoReadyEmail({ to: reqRow.email, nomeDestinatario: reqRow.nome_destinatario, videoUrl });
        }
        console.log(`[worker] Vídeo pronto para request_id ${requestId}: ${videoUrl}`);
      } catch (err) {
        console.error(`[worker] Erro ao montar vídeo (request_id ${requestId}):`, err.message);
        await db.updateVideoRequestStatus(requestId, 'error').catch(() => {});
      }
    }
  } catch (err) {
    console.error('[worker] Erro ao buscar pedidos pagos:', err.message);
  } finally {
    isProcessing = false;
  }
}

setInterval(processPaidRequests, 20000);

app.listen(PORT, () => {
  console.log(`\n🎬 SuaMúsicaAI Vídeo Homenagem rodando em http://localhost:${PORT}`);
  console.log(`   Creatomate: ${process.env.CREATOMATE_API_KEY ? '✓ configurada' : '✗ faltando CREATOMATE_API_KEY'}`);
  console.log(`   Postgres:   ${process.env.DATABASE_URL ? '✓ configurado' : '✗ faltando DATABASE_URL'}\n`);
  processPaidRequests();
});

module.exports = app;
