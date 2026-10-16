const { AppError } = require("./erros");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cpfValido(c) {
  if (!/^\d{11}$/.test(c) || /^(\d)\1+$/.test(c)) return false;
  const calc = (n) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(c[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
}

function cnpjValido(c) {
  if (!/^\d{14}$/.test(c) || /^(\d)\1+$/.test(c)) return false;
  const calc = (n) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(c[i]) * pesos[i];
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

// Converte e valida um valor segundo a regra. Devolve { valor } ou { erro }
function converter(v, regra) {
  switch (regra.tipo) {
    case "texto": {
      if (typeof v !== "string") return { erro: "Deve ser um texto." };
      const t = v.trim();
      if (regra.min && t.length < regra.min) return { erro: `Mínimo de ${regra.min} caracteres.` };
      if (regra.max && t.length > regra.max) return { erro: `Máximo de ${regra.max} caracteres.` };
      return { valor: t };
    }
    case "email": {
      if (typeof v !== "string") return { erro: "E-mail inválido." };
      const e = v.trim().toLowerCase();
      if (!EMAIL_REGEX.test(e) || e.length > 160) return { erro: "E-mail inválido." };
      return { valor: e };
    }
    case "telefone": {
      const d = String(v).replace(/\D/g, "");
      if (d.length < 10 || d.length > 11) return { erro: "Telefone inválido. Use DDD + número." };
      return { valor: d };
    }
    case "documento": {
      const d = String(v).replace(/\D/g, "");
      if (d.length === 11 && cpfValido(d)) return { valor: d };
      if (d.length === 14 && cnpjValido(d)) return { valor: d };
      return { erro: "CPF/CNPJ inválido." };
    }
    case "inteiro": {
      const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
      if (!Number.isInteger(n)) return { erro: "Deve ser um número inteiro." };
      if (regra.min !== undefined && n < regra.min) return { erro: `Deve ser maior ou igual a ${regra.min}.` };
      return { valor: n };
    }
    case "decimal": {
      const n = typeof v === "string" && v.trim() !== "" ? Number(v.replace(",", ".")) : v;
      if (typeof n !== "number" || !Number.isFinite(n)) return { erro: "Deve ser um número." };
      if (regra.min !== undefined && n < regra.min) return { erro: `Deve ser maior ou igual a ${regra.min}.` };
      return { valor: Math.round(n * 100) / 100 };
    }
    case "enum": {
      if (!regra.valores.includes(v)) return { erro: `Valor inválido. Use um de: ${regra.valores.join(", ")}.` };
      return { valor: v };
    }
    case "booleano": {
      if (v === true || v === 1 || v === "true" || v === "1") return { valor: 1 };
      if (v === false || v === 0 || v === "false" || v === "0") return { valor: 0 };
      return { erro: "Deve ser verdadeiro ou falso." };
    }
    default:
      return { valor: v };
  }
}

/**
 * Valida o corpo da requisição segundo as regras e devolve só os campos conhecidos, já limpos.
 * Se algo estiver errado, lança AppError 400 com a lista de erros por campo.
 */
function validar(body, regras) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new AppError(400, "Corpo da requisição inválido. Envie um JSON.");

  const erros = {};
  const dados = {};

  for (const [campo, regra] of Object.entries(regras)) {
    const v = body[campo];
    const vazio = v === undefined || v === null || (typeof v === "string" && v.trim() === "");

    if (vazio) {
      if (regra.obrigatorio) erros[campo] = "Campo obrigatório.";
      else dados[campo] = regra.padrao !== undefined ? regra.padrao : null;
      continue;
    }

    const r = converter(v, regra);
    if (r.erro) erros[campo] = r.erro;
    else dados[campo] = r.valor;
  }

  if (Object.keys(erros).length) throw new AppError(400, "Dados inválidos.", erros);
  return dados;
}

module.exports = { validar, cpfValido, cnpjValido };
