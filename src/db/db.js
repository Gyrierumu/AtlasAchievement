const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const env = require('../config/env');

const databaseDirectory = path.dirname(env.databasePath);
fs.mkdirSync(databaseDirectory, { recursive: true });

const db = new sqlite3.Database(env.databasePath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, err => {
      if (err) return reject(err);
      resolve();
    });
  });
}

module.exports = {
  db,
  run,
  get,
  all,
  exec
};
