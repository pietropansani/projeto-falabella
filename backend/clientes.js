const express = require("express");
const db = require("../db");
const { AppError } = require("../utils/erros");
const { validar } = require("../utils/validar");
const { obterId, paginacao, garantirUnico, resposta } = require("../utils/helpers");

const router = express.Router();

const regras = {
  nome: { tipo: "texto", obrigatorio: true, min: 2, max: 120 },
  email: { tipo: "email" },
  telefone: { tipo: "telefone", obrigatorio: true },
  documento: { tipo: "documento" }, // CPF ou CNPJ
  endereco: { tipo: "texto", max: 255 },
};

function buscarOuFalhar(id) {
  const cliente = db.prepare("SELECT * FROM clientes WHERE id = ?").get(id);
  if (!cliente) throw new AppError(404, "Cliente não encontrado.");
  return cliente;
}

// GET /api/clientes?busca=&pagina=&limite=
router.get("/", (req, res) => {
  const pag = paginacao(req.query);
  const busca = String(req.query.busca || "").trim();
  const where = busca ? "WHERE nome LIKE @b OR email LIKE @b OR documento LIKE @b OR telefone LIKE @b" : "";
  const params = busca ? { b: `%${busca}%` } : {};

  const total = db.prepare(`SELECT COUNT(*) AS n FROM clientes ${where}`).get(params).n;
  const lista = db
    .prepare(`SELECT * FROM clientes ${where} ORDER BY nome LIMIT @limite OFFSET @offset`)
    .all({ ...params, limite: pag.limite, offset: pag.offset });

  res.json(resposta(lista, total, pag));
});

// GET /api/clientes/:id
router.get("/:id", (req, res) => {
  res.json(buscarOuFalhar(obterId(req)));
});

// POST /api/clientes
router.post("/", (req, res) => {
  const dados = validar(req.body, regras);
  garantirUnico("clientes", "email", dados.email);
  garantirUnico("clientes", "documento", dados.documento);

  const info = db
    .prepare(
      `INSERT INTO clientes (nome, email, telefone, documento, endereco)
       VALUES (@nome, @email, @telefone, @documento, @endereco)`
    )
    .run(dados);

  res.status(201).json(buscarOuFalhar(info.lastInsertRowid));
});

// PUT /api/clientes/:id
router.put("/:id", (req, res) => {
  const id = obterId(req);
  buscarOuFalhar(id);
  const dados = validar(req.body, regras);
  garantirUnico("clientes", "email", dados.email, id);
  garantirUnico("clientes", "documento", dados.documento, id);

  db.prepare(
    `UPDATE clientes
     SET nome = @nome, email = @email, telefone = @telefone, documento = @documento,
         endereco = @endereco, atualizado_em = CURRENT_TIMESTAMP
     WHERE id = @id`
  ).run({ ...dados, id });

  res.json(buscarOuFalhar(id));
});

// DELETE /api/clientes/:id
router.delete("/:id", (req, res) => {
  const id = obterId(req);
  buscarOuFalhar(id);

  const { n } = db.prepare("SELECT COUNT(*) AS n FROM ordens_servico WHERE cliente_id = ?").get(id);
  if (n > 0)
    throw new AppError(409, `Não é possível excluir: o cliente possui ${n} ordem(ns) de serviço.`);

  db.prepare("DELETE FROM clientes WHERE id = ?").run(id);
  res.status(204).end();
});

module.exports = router;
