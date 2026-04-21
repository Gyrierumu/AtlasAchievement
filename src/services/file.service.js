const fs = require('fs');
const path = require('path');
const env = require('../config/env');

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

module.exports = {
  isManagedUpload,
  removeManagedUpload
};
