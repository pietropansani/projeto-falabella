const db = require("../db");
const { AppError } = require("./erros");

// Lê e valida o :id da URL
function obterId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new AppError(400, "ID inválido.");
  return id;
}

// Lê ?pagina=1&limite=20 (limite máximo: 100)
function paginacao(query) {
  const pagina = Math.max(parseInt(query.pagina, 10) || 1, 1);
  const limite = Math.min(Math.max(parseInt(query.limite, 10) || 20, 1), 100);
  return { pagina, limite, offset: (pagina - 1) * limite };
}

// Valida filtros numéricos vindos da query string (?cliente_id=3)
function inteiroQuery(valor, campo) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1) throw new AppError(400, "Filtro inválido.", { [campo]: "Deve ser um número inteiro positivo." });
  return n;
}

// Garante que o valor ainda não existe em outro registro da tabela (uso interno: tabela/campo fixos no código)
function garantirUnico(tabela, campo, valor, ignorarId = 0) {
  if (valor === null || valor === undefined) return;
  const existe = db.prepare(`SELECT id FROM ${tabela} WHERE ${campo} = ? AND id <> ?`).get(valor, ignorarId);
  if (existe) throw new AppError(409, "Registro duplicado.", { [campo]: "Já cadastrado." });
}

function resposta(lista, total, { pagina, limite }) {
  return { dados: lista, pagina, limite, total, totalPaginas: Math.max(Math.ceil(total / limite), 1) };
}

module.exports = { obterId, paginacao, inteiroQuery, garantirUnico, resposta };
