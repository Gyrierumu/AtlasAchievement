const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const env = require('../config/env');
const requireAdmin = require('../middleware/requireAdmin');
const asyncHandler = require('../middleware/asyncHandler');
const uploadsController = require('../controllers/uploads.controller');
const AppError = require('../utils/AppError');

const router = express.Router();

fs.mkdirSync(env.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.uploadDir),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
    cb(null, safeName);
  }
});

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const upload = multer({
  storage,
  limits: { fileSize: env.maxUploadSizeBytes },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new AppError('Formato inválido. Envie JPG, PNG, WEBP ou GIF.', 400));
      return;
    }
    cb(null, true);
  }
});

router.post(
  '/cover',
  requireAdmin,
  (req, res, next) => {
    upload.single('cover')(req, res, error => {
      if (!error) return next();
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('A imagem excede o limite permitido de 5MB.', 400));
      }
      return next(error);
    });
  },
  asyncHandler(uploadsController.uploadCover)
);

module.exports = router;
