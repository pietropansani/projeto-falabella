const express = require("express");
const db = require("../db");
const { AppError } = require("../utils/erros");
const { validar } = require("../utils/validar");
const { obterId, paginacao, inteiroQuery, resposta } = require("../utils/helpers");
const { STATUS, PRIORIDADES, TRANSICOES, STATUS_FINAIS, STATUS_COM_TECNICO } = require("../utils/status");

const router = express.Router();

const SELECT_BASE = `
  SELECT o.*, c.nome AS cliente_nome, t.nome AS tecnico_nome
  FROM ordens_servico o
  JOIN clientes c ON c.id = o.cliente_id
  LEFT JOIN tecnicos t ON t.id = o.tecnico_id`;

// Campos editáveis da OS (o status NÃO entra aqui: só muda pela rota /status)
const regras = {
  cliente_id: { tipo: "inteiro", obrigatorio: true, min: 1 },
  tecnico_id: { tipo: "inteiro", min: 1 },
  titulo: { tipo: "texto", obrigatorio: true, min: 3, max: 150 },
  descricao: { tipo: "texto", max: 2000 },
  equipamento: { tipo: "texto", max: 150 },
  prioridade: { tipo: "enum", valores: PRIORIDADES, padrao: "media" },
  valor: { tipo: "decimal", min: 0 },
};

function buscarOuFalhar(id) {
  const os = db.prepare(`${SELECT_BASE} WHERE o.id = ?`).get(id);
  if (!os) throw new AppError(404, "Ordem de serviço não encontrada.");
  return os;
}

// Cliente precisa existir; técnico precisa existir e estar ativo (a não ser que já fosse o da OS)
function validarVinculos(dados, tecnicoAtualId = null) {
  const erros = {};

  if (!db.prepare("SELECT 1 FROM clientes WHERE id = ?").get(dados.cliente_id))
    erros.cliente_id = "Cliente não encontrado.";

  if (dados.tecnico_id !== null) {
    const t = db.prepare("SELECT ativo FROM tecnicos WHERE id = ?").get(dados.tecnico_id);
    if (!t) erros.tecnico_id = "Técnico não encontrado.";
    else if (!t.ativo && dados.tecnico_id !== tecnicoAtualId) erros.tecnico_id = "Técnico inativo.";
  }

  if (Object.keys(erros).length) throw new AppError(400, "Dados inválidos.", erros);
}

function registrarHistorico(osId, anterior, novo, observacao, usuarioId) {
  db.prepare(
    `INSERT INTO os_historico (os_id, status_anterior, status_novo, observacao, usuario_id)
     VALUES (?, ?, ?, ?, ?)`
  ).run(osId, anterior, novo, observacao, usuarioId);
}

// GET /api/ordens/status  -> status possíveis e transições permitidas (útil para o front)
router.get("/status", (req, res) => {
  res.json({ status: STATUS, prioridades: PRIORIDADES, transicoes: TRANSICOES });
});

// GET /api/ordens?status=&prioridade=&cliente_id=&tecnico_id=&busca=&pagina=&limite=
router.get("/", (req, res) => {
  const pag = paginacao(req.query);
  const filtros = [];
  const params = {};
  const { status, prioridade, cliente_id, tecnico_id } = req.query;

  if (status !== undefined) {
    if (!STATUS.includes(status))
      throw new AppError(400, "Filtro inválido.", { status: `Use um de: ${STATUS.join(", ")}.` });
    filtros.push("o.status = @status");
    params.status = status;
  }
  if (prioridade !== undefined) {
    if (!PRIORIDADES.includes(prioridade))
      throw new AppError(400, "Filtro inválido.", { prioridade: `Use um de: ${PRIORIDADES.join(", ")}.` });
    filtros.push("o.prioridade = @prioridade");
    params.prioridade = prioridade;
  }
  if (cliente_id !== undefined) {
    filtros.push("o.cliente_id = @cliente_id");
    params.cliente_id = inteiroQuery(cliente_id, "cliente_id");
  }
  if (tecnico_id !== undefined) {
    filtros.push("o.tecnico_id = @tecnico_id");
    params.tecnico_id = inteiroQuery(tecnico_id, "tecnico_id");
  }
  const busca = String(req.query.busca || "").trim();
  if (busca) {
    filtros.push("(o.titulo LIKE @b OR o.descricao LIKE @b OR o.equipamento LIKE @b OR c.nome LIKE @b)");
    params.b = `%${busca}%`;
  }

  const where = filtros.length ? "WHERE " + filtros.join(" AND ") : "";
  const total = db
    .prepare(`SELECT COUNT(*) AS n FROM ordens_servico o JOIN clientes c ON c.id = o.cliente_id ${where}`)
    .get(params).n;
  const lista = db
    .prepare(`${SELECT_BASE} ${where} ORDER BY o.id DESC LIMIT @limite OFFSET @offset`)
    .all({ ...params, limite: pag.limite, offset: pag.offset });

  res.json(resposta(lista, total, pag));
});

// GET /api/ordens/:id
router.get("/:id", (req, res) => {
  const os = buscarOuFalhar(obterId(req));
  const historico = db
    .prepare("SELECT * FROM os_historico WHERE os_id = ? ORDER BY id")
    .all(os.id);
  res.json({ ...os, historico });
});

// GET /api/ordens/:id/historico
router.get("/:id/historico", (req, res) => {
  const os = buscarOuFalhar(obterId(req));
  res.json(db.prepare("SELECT * FROM os_historico WHERE os_id = ? ORDER BY id").all(os.id));
});

// POST /api/ordens  (a OS sempre nasce "aberta")
router.post("/", (req, res) => {
  const dados = validar(req.body, regras);
  validarVinculos(dados);

  const id = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO ordens_servico (cliente_id, tecnico_id, titulo, descricao, equipamento, prioridade, valor)
         VALUES (@cliente_id, @tecnico_id, @titulo, @descricao, @equipamento, @prioridade, @valor)`
      )
      .run(dados);
    registrarHistorico(info.lastInsertRowid, null, "aberta", "OS criada", req.usuarioId);
    return info.lastInsertRowid;
  })();

  res.status(201).json(buscarOuFalhar(id));
});

// PUT /api/ordens/:id  (edita os dados; não altera o status)
router.put("/:id", (req, res) => {
  const id = obterId(req);
  const atual = buscarOuFalhar(id);

  if (STATUS_FINAIS.includes(atual.status))
    throw new AppError(409, `Não é possível editar uma OS ${atual.status}.`);

  const dados = validar(req.body, regras);
  validarVinculos(dados, atual.tecnico_id);

  if (dados.tecnico_id === null && STATUS_COM_TECNICO.includes(atual.status))
    throw new AppError(409, `Uma OS "${atual.status}" precisa ter um técnico atribuído.`);

  db.prepare(
    `UPDATE ordens_servico
     SET cliente_id = @cliente_id, tecnico_id = @tecnico_id, titulo = @titulo, descricao = @descricao,
         equipamento = @equipamento, prioridade = @prioridade, valor = @valor,
         atualizado_em = CURRENT_TIMESTAMP
     WHERE id = @id`
  ).run({ ...dados, id });

  res.json(buscarOuFalhar(id));
});

// PATCH /api/ordens/:id/status  { "status": "em_andamento", "observacao": "..." }
router.patch("/:id/status", (req, res) => {
  const id = obterId(req);
  const atual = buscarOuFalhar(id);

  const { status: novo, observacao } = validar(req.body, {
    status: { tipo: "enum", valores: STATUS, obrigatorio: true },
    observacao: { tipo: "texto", max: 500 },
  });

  if (novo === atual.status) throw new AppError(409, `A OS já está com o status "${novo}".`);

  const permitidos = TRANSICOES[atual.status];
  if (!permitidos.includes(novo))
    throw new AppError(409, `Transição inválida: de "${atual.status}" para "${novo}".`, { permitidos });

  if (STATUS_COM_TECNICO.includes(novo) && !atual.tecnico_id)
    throw new AppError(409, "Atribua um técnico à OS antes de avançar o status.");

  if (novo === "cancelada" && (!observacao || observacao.length < 3))
    throw new AppError(400, "Dados inválidos.", { observacao: "Informe o motivo do cancelamento." });

  db.transaction(() => {
    db.prepare(
      `UPDATE ordens_servico
       SET status = @novo,
           data_conclusao = CASE WHEN @novo = 'concluida' THEN CURRENT_TIMESTAMP ELSE data_conclusao END,
           atualizado_em = CURRENT_TIMESTAMP
       WHERE id = @id`
    ).run({ novo, id });
    registrarHistorico(id, atual.status, novo, observacao, req.usuarioId);
  })();

  res.json(buscarOuFalhar(id));
});

// DELETE /api/ordens/:id  (só OS abertas ou canceladas)
router.delete("/:id", (req, res) => {
  const id = obterId(req);
  const atual = buscarOuFalhar(id);

  if (!["aberta", "cancelada"].includes(atual.status))
    throw new AppError(409, `Só é possível excluir OS abertas ou canceladas (status atual: "${atual.status}").`);

  db.prepare("DELETE FROM ordens_servico WHERE id = ?").run(id);
  res.status(204).end();
});

module.exports = router;
