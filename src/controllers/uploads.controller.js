const path = require('path');
const AppError = require('../utils/AppError');

function uploadCover(req, res) {
  if (!req.file) {
    throw new AppError('Selecione uma imagem válida.', 400);
  }

  const normalizedPath = req.file.filename.replaceAll(path.sep, '/');

  res.status(201).json({
    message: 'Imagem enviada com sucesso.',
    imageUrl: `/uploads/${normalizedPath}`
  });
}

module.exports = {
  uploadCover
};
