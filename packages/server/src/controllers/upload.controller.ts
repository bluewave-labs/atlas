import type { Request, Response } from 'express';

export function handleUpload(req: Request, res: Response) {
  const file = req.file;
  if (!file) {
    res.status(400).json({ success: false, error: 'No file provided' });
    return;
  }

  res.json({
    success: true,
    data: {
      url: `/api/v1/uploads/${file.filename}`,
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
    },
  });
}
