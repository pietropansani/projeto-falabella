// Erro "esperado" da aplicação: já carrega o status HTTP e a mensagem para o cliente
class AppError extends Error {
  constructor(status, mensagem, detalhes) {
    super(mensagem);
    this.status = status;
    this.detalhes = detalhes;
  }
}

module.exports = { AppError };
