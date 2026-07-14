/**
 * Montagem do vídeo-homenagem real via Creatomate API
 * Junta as fotos/vídeos enviados pelo cliente com a música personalizada,
 * em sequência, sincronizados com a duração do áudio.
 *
 * Docs: https://creatomate.com/docs/api/rest-api/creating-renders
 */

const axios = require('axios');

const BASE = 'https://api.creatomate.com/v1';

function headers() {
  return {
    Authorization: `Bearer ${process.env.CREATOMATE_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Monta a composição: áudio de fundo + fotos/vídeos em sequência (mesma
 * track = Creatomate encadeia automaticamente um após o outro) + nome
 * sobreposto no rodapé.
 */
function buildComposition({ audioUrl, nomeDestinatario, mediaFiles }) {
  const elements = [
    { type: 'audio', track: 3, src: audioUrl, volume: 1 },
  ];

  mediaFiles.forEach((file) => {
    const el = {
      type: file.type === 'video' ? 'video' : 'image',
      track: 1,
      src: file.url,
      fit: 'cover',
      width: '100%',
      height: '100%',
      animations: [{ type: 'fade', duration: 0.5 }],
    };
    if (file.type !== 'video') el.duration = 4; // fotos ficam 4s cada; vídeos usam a própria duração
    elements.push(el);
  });

  elements.push({
    type: 'text',
    track: 2,
    text: `Para ${nomeDestinatario}`,
    font_size: 52,
    fill_color: '#FFFFFF',
    font_weight: '700',
    font_family: 'Montserrat',
    background_color: 'rgba(13,13,26,0.45)',
    x: '50%',
    y: '90%',
    x_anchor: '50%',
    y_anchor: '50%',
    width: '100%',
    x_alignment: 'center',
  });

  return {
    output_format: 'mp4',
    width: 1080,
    height: 1920,
    frame_rate: 30,
    elements,
  };
}

async function startVideoRender({ audioUrl, nomeDestinatario, mediaFiles }) {
  if (!process.env.CREATOMATE_API_KEY) {
    throw new Error('CREATOMATE_API_KEY não configurada');
  }
  if (!mediaFiles?.length) {
    throw new Error('Nenhum arquivo de mídia enviado para montar o vídeo');
  }

  const composition = buildComposition({ audioUrl, nomeDestinatario, mediaFiles });

  const res = await axios.post(
    `${BASE}/renders`,
    { source: JSON.stringify(composition) },
    { headers: headers(), timeout: 20000 }
  );

  const render = Array.isArray(res.data) ? res.data[0] : res.data;
  const renderId = render?.id;
  if (!renderId) throw new Error('Creatomate não retornou render ID');

  console.log(`[creatomate] Render iniciado: ${renderId} | status: ${render.status}`);
  return renderId;
}

async function checkRenderStatus(renderId) {
  const res = await axios.get(`${BASE}/renders/${renderId}`, { headers: headers(), timeout: 10000 });
  const { status, url, error_message } = res.data;

  if (status === 'succeeded') return { status: 'COMPLETED', videoUrl: url };
  if (status === 'failed') return { status: 'FAILED', error: error_message || 'falha no render' };
  return { status: 'PROCESSING' };
}

/**
 * Monta e aguarda o render completar. maxSeconds = 300 (5 min) por padrão.
 */
async function generateTributeVideo({ audioUrl, nomeDestinatario, mediaFiles }, maxSeconds = 300) {
  const renderId = await startVideoRender({ audioUrl, nomeDestinatario, mediaFiles });
  const start = Date.now();
  let delay = 8000;

  while ((Date.now() - start) / 1000 < maxSeconds) {
    await sleep(delay);
    delay = Math.min(delay * 1.4, 20000);

    const result = await checkRenderStatus(renderId);
    if (result.status === 'COMPLETED') {
      console.log(`[creatomate] Render ${renderId} concluído: ${result.videoUrl}`);
      return { videoUrl: result.videoUrl };
    }
    if (result.status === 'FAILED') {
      throw new Error(`Render de vídeo falhou: ${result.error}`);
    }
    console.log(`[creatomate] Render ${renderId} ainda processando...`);
  }

  throw new Error('Timeout: render de vídeo não completou em 5 minutos');
}

module.exports = { generateTributeVideo };
