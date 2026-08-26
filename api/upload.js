import { put } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Método não permitido.' });
  }

  try {
    const { projectId, filename, dataUrl } = req.body || {};
    if (!projectId || !filename || !dataUrl) {
      return res.status(400).json({ success: false, error: 'projectId, filename e dataUrl são obrigatórios.' });
    }

    const match = /^data:(.+);base64,(.+)$/.exec(dataUrl);
    if (!match) {
      return res.status(400).json({ success: false, error: 'dataUrl inválido.' });
    }

    const contentType = match[1];
    const buffer = Buffer.from(match[2], 'base64');

    // Limite prático: o corpo da requisição na Vercel tem teto de 4.5MB.
    // O front-end já comprime a foto antes de chegar aqui, então isso é
    // só uma proteção extra contra arquivos que escapem da compressão.
    if (buffer.length > 4 * 1024 * 1024) {
      return res.status(413).json({ success: false, error: 'Imagem muito grande, mesmo após compressão.' });
    }

    const blob = await put(`${projectId}/${filename}`, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
    });

    return res.status(200).json({ success: true, url: blob.url });

  } catch (error) {
    console.error('Erro em /api/upload:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
}