const express = require("express");
const db = require("../db");
const { AppError } = require("../utils/erros");
const { validar } = require("../utils/validar");
const { obterId, paginacao, garantirUnico, resposta } = require("../utils/helpers");

const router = express.Router();

const regras = {
  nome: { tipo: "texto", obrigatorio: true, min: 2, max: 120 },
  email: { tipo: "email", obrigatorio: true },
  telefone: { tipo: "telefone", obrigatorio: true },
  especialidade: { tipo: "texto", max: 100 },
  ativo: { tipo: "booleano", padrao: 1 },
};

const formatar = (t) => ({ ...t, ativo: Boolean(t.ativo) });

function buscarOuFalhar(id) {
  const tecnico = db.prepare("SELECT * FROM tecnicos WHERE id = ?").get(id);
  if (!tecnico) throw new AppError(404, "Técnico não encontrado.");
  return tecnico;
}

// GET /api/tecnicos?busca=&ativo=true&pagina=&limite=
router.get("/", (req, res) => {
  const pag = paginacao(req.query);
  const filtros = [];
  const params = {};

  const busca = String(req.query.busca || "").trim();
  if (busca) {
    filtros.push("(nome LIKE @b OR email LIKE @b OR especialidade LIKE @b)");
    params.b = `%${busca}%`;
  }
  if (req.query.ativo !== undefined) {
    if (!["true", "false"].includes(req.query.ativo))
      throw new AppError(400, "Filtro inválido.", { ativo: "Use true ou false." });
    filtros.push("ativo = @ativo");
    params.ativo = req.query.ativo === "true" ? 1 : 0;
  }

  const where = filtros.length ? "WHERE " + filtros.join(" AND ") : "";
  const total = db.prepare(`SELECT COUNT(*) AS n FROM tecnicos ${where}`).get(params).n;
  const lista = db
    .prepare(`SELECT * FROM tecnicos ${where} ORDER BY nome LIMIT @limite OFFSET @offset`)
    .all({ ...params, limite: pag.limite, offset: pag.offset });

  res.json(resposta(lista.map(formatar), total, pag));
});

// GET /api/tecnicos/:id
router.get("/:id", (req, res) => {
  res.json(formatar(buscarOuFalhar(obterId(req))));
});

// POST /api/tecnicos
router.post("/", (req, res) => {
  const dados = validar(req.body, regras);
  garantirUnico("tecnicos", "email", dados.email);

  const info = db
    .prepare(
      `INSERT INTO tecnicos (nome, email, telefone, especialidade, ativo)
       VALUES (@nome, @email, @telefone, @especialidade, @ativo)`
    )
    .run(dados);

  res.status(201).json(formatar(buscarOuFalhar(info.lastInsertRowid)));
});

// PUT /api/tecnicos/:id
router.put("/:id", (req, res) => {
  const id = obterId(req);
  buscarOuFalhar(id);
  const dados = validar(req.body, regras);
  garantirUnico("tecnicos", "email", dados.email, id);

  db.prepare(
    `UPDATE tecnicos
     SET nome = @nome, email = @email, telefone = @telefone, especialidade = @especialidade,
         ativo = @ativo, atualizado_em = CURRENT_TIMESTAMP
     WHERE id = @id`
  ).run({ ...dados, id });

  res.json(formatar(buscarOuFalhar(id)));
});

// DELETE /api/tecnicos/:id
router.delete("/:id", (req, res) => {
  const id = obterId(req);
  buscarOuFalhar(id);

  const { n } = db.prepare("SELECT COUNT(*) AS n FROM ordens_servico WHERE tecnico_id = ?").get(id);
  if (n > 0)
    throw new AppError(
      409,
      `Não é possível excluir: o técnico está vinculado a ${n} ordem(ns) de serviço. Desative-o (ativo: false) em vez de excluir.`
    );

  db.prepare("DELETE FROM tecnicos WHERE id = ?").run(id);
  res.status(204).end();
});

module.exports = router;
