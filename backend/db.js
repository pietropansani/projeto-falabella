const Database = require("better-sqlite3");
const db = new Database("sistema.db");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tecnicos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  especialidade TEXT NOT NULL,
  telefone TEXT
);
CREATE TABLE IF NOT EXISTS ordens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente TEXT NOT NULL,
  telefone TEXT NOT NULL,
  equipamento TEXT NOT NULL,
  problema TEXT NOT NULL,
  prioridade TEXT NOT NULL DEFAULT 'Média',
  status TEXT NOT NULL DEFAULT 'Aberta',
  previsao TEXT,
  criada TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  tecnico_id INTEGER REFERENCES tecnicos(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS historico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  os_id INTEGER NOT NULL REFERENCES ordens(id) ON DELETE CASCADE,
  data TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  texto TEXT NOT NULL
);
`);
module.exports = db;