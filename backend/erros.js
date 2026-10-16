const { AppError } = require("../utils/erros");

// Rota inexistente em /api
function naoEncontrado(req, res, next) {
  next(new AppError(404, `Rota não encontrada: ${req.method} ${req.originalUrl}`));
}

// Tratador central de erros (precisa ser o último middleware)
function tratarErros(err, req, res, next) {
  if (res.headersSent) return next(err);

  // JSON malformado / corpo grande demais
  if (err.type === "entity.parse.failed")
    return res.status(400).json({ erro: "JSON inválido no corpo da requisição." });
  if (err.type === "entity.too.large")
    return res.status(413).json({ erro: "Corpo da requisição muito grande." });

  // Erros esperados lançados pela própria aplicação
  if (err instanceof AppError) {
    const corpo = { erro: err.message };
    if (err.detalhes) corpo.detalhes = err.detalhes;
    return res.status(err.status).json(corpo);
  }

  // Erros do banco que escaparam das validações
  if (err.code === "SQLITE_CONSTRAINT_UNIQUE" || err.code === "SQLITE_CONSTRAINT_PRIMARYKEY")
    return res.status(409).json({ erro: "Registro duplicado." });
  if (err.code === "SQLITE_CONSTRAINT_FOREIGNKEY")
    return res.status(409).json({ erro: "Operação não permitida: existem registros vinculados." });
  if (typeof err.code === "string" && err.code.startsWith("SQLITE_CONSTRAINT"))
    return res.status(400).json({ erro: "Dados violam uma regra do banco de dados." });

  // Qualquer outra coisa: loga no servidor e não vaza detalhes ao cliente
  console.error(err);
  res.status(500).json({ erro: "Erro interno do servidor." });
}

module.exports = { naoEncontrado, tratarErros };
