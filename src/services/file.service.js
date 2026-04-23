const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const ALLOWED_IMAGE_TYPES = new Map([
  ['jpg', { mime: 'image/jpeg', extensions: ['.jpg', '.jpeg'] }],
  ['png', { mime: 'image/png', extensions: ['.png'] }],
  ['webp', { mime: 'image/webp', extensions: ['.webp'] }],
  ['gif', { mime: 'image/gif', extensions: ['.gif'] }]
]);

function isManagedUpload(imageUrl) {
  return typeof imageUrl === 'string' && imageUrl.startsWith('/uploads/');
}

function resolveUploadPath(imageUrl) {
  const relativeFile = imageUrl.replace('/uploads/', '');
  return path.join(env.uploadDir, relativeFile);
}

function removeManagedUpload(imageUrl) {
  if (!isManagedUpload(imageUrl)) return;

  const absolutePath = resolveUploadPath(imageUrl);
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}

async function removeFileIfExists(filePath) {
  if (!filePath) return;

  try {
    await fsp.unlink(filePath);
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function readFileHeader(filePath, length = 64) {
  const fileHandle = await fsp.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await fileHandle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await fileHandle.close();
  }
}

function detectImageTypeFromHeader(header) {
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return 'jpg';
  }

  if (
    header.length >= 8 &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a
  ) {
    return 'png';
  }

  if (
    header.length >= 12 &&
    header.toString('ascii', 0, 4) === 'RIFF' &&
    header.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }

  if (header.length >= 6) {
    const signature = header.toString('ascii', 0, 6);
    if (signature === 'GIF87a' || signature === 'GIF89a') {
      return 'gif';
    }
  }

  return null;
}

function getCanonicalExtension(typeKey) {
  const typeConfig = ALLOWED_IMAGE_TYPES.get(typeKey);
  if (!typeConfig) return null;
  return typeConfig.extensions[0];
}

async function sniffImageType(filePath) {
  const header = await readFileHeader(filePath);
  return detectImageTypeFromHeader(header);
}

async function finalizeUploadedImage(file) {
  if (!file || !file.path) {
    throw new AppError('Selecione uma imagem válida.', 400);
  }

  let detectedType = null;

  try {
    detectedType = await sniffImageType(file.path);
  } catch (error) {
    await removeFileIfExists(file.path);
    throw error;
  }

  if (!detectedType || !ALLOWED_IMAGE_TYPES.has(detectedType)) {
    await removeFileIfExists(file.path);
    throw new AppError('Formato inválido. Envie uma imagem JPG, PNG, WEBP ou GIF real.', 400);
  }

  const canonicalExtension = getCanonicalExtension(detectedType);
  const currentExtension = path.extname(file.filename || '').toLowerCase();
  const targetFilename = currentExtension === canonicalExtension
    ? file.filename
    : `${path.basename(file.filename, currentExtension)}${canonicalExtension}`;

  if (targetFilename !== file.filename) {
    const targetPath = path.join(path.dirname(file.path), targetFilename);
    await removeFileIfExists(targetPath);
    await fsp.rename(file.path, targetPath);
    file.path = targetPath;
    file.filename = targetFilename;
  }

  file.detectedMimeType = ALLOWED_IMAGE_TYPES.get(detectedType).mime;
  file.detectedExtension = canonicalExtension;
  return file;
}

module.exports = {
  isManagedUpload,
  removeManagedUpload,
  finalizeUploadedImage,
  ALLOWED_IMAGE_TYPES
};
