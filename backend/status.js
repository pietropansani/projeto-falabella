// Regras de negócio do status da Ordem de Serviço
const STATUS = ["aberta", "em_andamento", "aguardando_peca", "concluida", "cancelada"];
const PRIORIDADES = ["baixa", "media", "alta", "urgente"];

// Para quais status cada status pode ir
const TRANSICOES = {
  aberta: ["em_andamento", "cancelada"],
  em_andamento: ["aguardando_peca", "concluida", "cancelada"],
  aguardando_peca: ["em_andamento", "cancelada"],
  concluida: [],
  cancelada: [],
};

const STATUS_FINAIS = ["concluida", "cancelada"];
// Status em que a OS obrigatoriamente precisa ter um técnico
const STATUS_COM_TECNICO = ["em_andamento", "aguardando_peca", "concluida"];

module.exports = { STATUS, PRIORIDADES, TRANSICOES, STATUS_FINAIS, STATUS_COM_TECNICO };
