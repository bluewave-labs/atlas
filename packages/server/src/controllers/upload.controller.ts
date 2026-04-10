import type { Request, Response } from 'express';

export function handleUpload(req: Request, res: Response) {
  const file = req.file;
  if (!file) {
    res.status(400).json({ success: false, error: 'No file provided' });
    return;
  }

  const tenantId = req.auth?.tenantId || 'shared';
  const relativePath = `${tenantId}/${file.filename}`;

  res.json({
    success: true,
    data: {
      url: `/api/v1/uploads/${relativePath}`,
      path: relativePath,
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
    },
  });
}
