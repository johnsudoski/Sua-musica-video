/**
 * Acesso ao Postgres compartilhado com o site principal (sua-musica-ai).
 * Mesmo projeto Railway -- conecta via rede interna (DATABASE_URL).
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway.internal') ? false : { rejectUnauthorized: false },
});

async function createVideoRequest({ requestId, email, formData, brief, uploadedFiles }) {
  await pool.query(
    `INSERT INTO video_requests (request_id, email, nome_destinatario, form_data, brief, uploaded_files)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      requestId,
      email || null,
      formData?.nomeDestinatario || null,
      JSON.stringify(formData || {}),
      brief || null,
      JSON.stringify(uploadedFiles || []),
    ]
  );
}

async function getVideoRequestsByStatus(status) {
  const result = await pool.query(`SELECT * FROM video_requests WHERE status = $1 ORDER BY created_at ASC`, [status]);
  return result.rows;
}

async function getVideoRequestByRequestId(requestId) {
  const result = await pool.query(`SELECT * FROM video_requests WHERE request_id = $1`, [requestId]);
  return result.rows[0] || null;
}

async function getVideoRequestsByEmail(email) {
  const normalized = email.toLowerCase().trim();
  const result = await pool.query(`SELECT * FROM video_requests WHERE email = $1 ORDER BY created_at DESC`, [normalized]);
  return result.rows;
}

async function updateVideoRequestStatus(requestId, status, extra = {}) {
  const fields = ['status = $2', 'updated_at = now()'];
  const values = [requestId, status];
  let i = 3;
  for (const [key, val] of Object.entries(extra)) {
    fields.push(`${key} = $${i}`);
    values.push(val);
    i++;
  }
  await pool.query(`UPDATE video_requests SET ${fields.join(', ')} WHERE request_id = $1`, values);
}

module.exports = {
  pool,
  createVideoRequest,
  getVideoRequestsByStatus,
  getVideoRequestByRequestId,
  getVideoRequestsByEmail,
  updateVideoRequestStatus,
};
