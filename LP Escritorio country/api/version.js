import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  try {
    // ==============================
    // GET - Buscar histórico
    // ==============================
    if (req.method === 'GET') {
      const { projectId } = req.query;

      if (!projectId) {
        return res.status(400).json({
          error: 'projectId é obrigatório'
        });
      }

      const versions = await sql`
        SELECT
          id,
          project_id,
          version_number,
          change_summary,
          created_at
        FROM versions
        WHERE project_id = ${projectId}
        ORDER BY version_number DESC
      `;

      return res.status(200).json({
        success: true,
        versions
      });
    }

    // ==============================
    // POST - Criar nova versão
    // ==============================
    if (req.method === 'POST') {
      const {
        projectId,
        state,
        changeSummary
      } = req.body;

      if (!projectId) {
        return res.status(400).json({
          error: 'projectId é obrigatório'
        });
      }

      if (!state) {
        return res.status(400).json({
          error: 'state é obrigatório'
        });
      }

      // Descobre o próximo número da versão
      const result = await sql`
        SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
        FROM versions
        WHERE project_id = ${projectId}
      `;

      const nextVersion = Number(result[0].next_version);

      // Salva a nova versão
      const version = await sql`
        INSERT INTO versions (
          project_id,
          version_number,
          state,
          change_summary
        )
        VALUES (
          ${projectId},
          ${nextVersion},
          ${JSON.stringify(state)},
          ${changeSummary || 'Alterações salvas'}
        )
        RETURNING
          id,
          project_id,
          version_number,
          change_summary,
          created_at
      `;

      return res.status(201).json({
        success: true,
        version: version[0]
      });
    }

    return res.status(405).json({
      error: 'Método não permitido'
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
}