const jwt = require("jsonwebtoken");
const { AppError } = require("../utils/erros");

// Protege rotas: exige o cookie de sessão criado no login
function exigirLogin(req, res, next) {
  try {
    const payload = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    req.usuarioId = payload.id;
    next();
  } catch {
    next(new AppError(401, "Não autenticado."));
  }
}

module.exports = { exigirLogin };
