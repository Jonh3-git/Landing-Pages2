import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// Quantas versões manter por projeto (evita a tabela crescer para sempre)
const KEEP_VERSIONS = 30;

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { projectId, limit } = req.query;
      if (!projectId) {
        return res.status(400).json({ success: false, error: 'projectId é obrigatório.' });
      }
      const max = Math.min(Number(limit) || 20, 100);

      const versions = await sql`
        SELECT version_number, state, created_at
        FROM versions
        WHERE project_id = ${projectId}
        ORDER BY version_number DESC
        LIMIT ${max}
      `;

      return res.status(200).json({ success: true, versions });
    }

    if (req.method === 'POST') {
      const { projectId, state } = req.body || {};
      if (!projectId || !state) {
        return res.status(400).json({ success: false, error: 'projectId e state são obrigatórios.' });
      }

      const [{ next_version }] = await sql`
        SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
        FROM versions
        WHERE project_id = ${projectId}
      `;

      const [saved] = await sql`
        INSERT INTO versions (project_id, version_number, state)
        VALUES (${projectId}, ${next_version}, ${JSON.stringify(state)}::jsonb)
        RETURNING version_number, created_at
      `;

      // Limpa versões antigas, mantendo só as KEEP_VERSIONS mais recentes
      await sql`
        DELETE FROM versions
        WHERE project_id = ${projectId}
          AND version_number <= (
            SELECT MAX(version_number) - ${KEEP_VERSIONS}
            FROM versions
            WHERE project_id = ${projectId}
          )
      `;

      return res.status(200).json({ success: true, version: saved });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, error: 'Método não permitido.' });

  } catch (error) {
    console.error('Erro em /api/version:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
}