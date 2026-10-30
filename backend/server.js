// =========================================================
// SYNTAX.lab — BACK-END (VERSÃO TOTALMENTE COMENTADA)
//
// Este arquivo é um servidor web feito com Node.js + Express.
// Ele faz três coisas ao mesmo tempo:
//   1. Entrega os arquivos do site (HTML, CSS, JS, imagens).
//   2. Oferece uma API (rotas /api/...) que o front-end chama.
//   3. Guarda tudo em um banco SQLite (arquivo banco.db).
// =========================================================

// ---------------------------------------------------------
// IMPORTAÇÃO DAS BIBLIOTECAS
// ---------------------------------------------------------

// Express: framework que cria o servidor e as rotas HTTP.
const express = require('express');

// CORS: permite que páginas de outras origens chamem esta API.
const cors = require('cors');

// SQLite3: driver do banco de dados. ".verbose()" liga mensagens
// de erro mais detalhadas, úteis durante o desenvolvimento.
const sqlite3 = require('sqlite3').verbose();

// bcryptjs: gera e confere "hashes" de senha (nunca se guarda
// a senha pura no banco).
const bcrypt = require('bcryptjs');

// path: monta caminhos de arquivos de forma compatível com
// Windows, Linux e Mac.
const path = require('path');

// fs: lê o sistema de arquivos (aqui, só para ver se um arquivo existe).
const fs = require('fs');

// Cria a aplicação Express. Tudo (rotas, middlewares) é ligado nela.
const app = express();

// ---------------------------------------------------------
// MIDDLEWARES GLOBAIS (rodam em toda requisição)
// ---------------------------------------------------------

// Libera CORS para qualquer origem.
app.use(cors());

// Lê corpo de requisição em JSON e coloca em req.body.
// O limite de 100kb evita que alguém envie um JSON gigante.
app.use(express.json({ limit: '100kb' }));

// Lê corpo de formulários HTML tradicionais (application/x-www-form-urlencoded).
// "extended: false" usa a biblioteca simples de parse.
app.use(express.urlencoded({ extended: false }));

// ---------------------------------------------------------
// CAMINHOS DO BANCO DE DADOS
// ---------------------------------------------------------

// Banco ATUAL: fica na pasta acima da pasta deste arquivo (raiz do projeto).
// __dirname = pasta onde o server.js está; '..' sobe um nível.
const caminhoBanco = path.join(__dirname, '..', 'banco.db');

// Banco ANTIGO: ficava na mesma pasta do server.js (pasta backend).
// Só é usado para migrar os dados para o banco novo.
const caminhoBancoAnterior = path.join(__dirname, 'banco.db');

// Abre (ou cria, se não existir) o banco atual.
const db = new sqlite3.Database(caminhoBanco);

// =========================================================
// FUNÇÕES AUXILIARES DO BANCO
// O sqlite3 usa callbacks; aqui eles são embrulhados em
// Promises para poder usar async/await no resto do código.
// =========================================================

// Consulta VÁRIAS linhas (SELECT que devolve lista).
// "parametros" substitui os "?" do SQL com segurança
// (evita SQL Injection).
function consultar(sql, parametros = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, parametros, (erro, linhas) => {
            if (erro) reject(erro);      // falhou: rejeita a Promise
            else resolve(linhas);        // deu certo: devolve o array
        });
    });
}

// Consulta UMA linha (SELECT que devolve só o primeiro resultado).
// Devolve undefined se não achar nada.
function buscarUm(sql, parametros = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, parametros, (erro, linha) => {
            if (erro) reject(erro);
            else resolve(linha);
        });
    });
}

// Executa comandos que alteram dados ou estrutura:
// INSERT, UPDATE, DELETE, CREATE TABLE, ALTER TABLE etc.
function executar(sql, parametros = []) {
    return new Promise((resolve, reject) => {
        // function normal (e não arrow) para ter acesso ao "this"
        // do sqlite3, que contém lastID e changes.
        db.run(sql, parametros, function (erro) {
            if (erro) {
                reject(erro);
            } else {
                resolve({
                    id: this.lastID,         // id do último INSERT
                    alteradas: this.changes  // quantas linhas foram afetadas
                });
            }
        });
    });
}

// =========================================================
// VALIDAÇÕES E UTILITÁRIOS
// =========================================================

// Cria um erro que carrega um código HTTP (400, 404, 409...).
// O tratador de erros no final do arquivo usa esse "status"
// para responder ao cliente.
function erroHttp(status, mensagem) {
    const erro = new Error(mensagem);
    erro.status = status;
    return erro;
}

// Converte qualquer valor em texto "limpo":
// se for string, remove espaços nas pontas; senão devolve ''.
function texto(valor) {
    return typeof valor === 'string' ? valor.trim() : '';
}

// Verifica se o e-mail tem formato básico: algo@algo.algo
// (sem espaços e com exatamente um @ separando as partes).
function emailValido(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Confere o formato AAAA-MM-DD e se a data realmente existe
// (por exemplo, 2025-02-30 é rejeitada).
function dataValida(valor) {
    // 1º filtro: formato com 4 dígitos, hífen, 2, hífen, 2.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        return false;
    }

    // Cria a data em UTC (T00:00:00.000Z) para não sofrer
    // influência do fuso horário.
    const data = new Date(`${valor}T00:00:00.000Z`);

    // 2º filtro: a data é válida E, ao voltar para texto,
    // dá o mesmo valor. Se o JS "corrigiu" (ex.: 30/02 → 02/03),
    // os textos diferem e a data é inválida.
    return (
        !Number.isNaN(data.getTime()) &&
        data.toISOString().slice(0, 10) === valor
    );
}

// Valida os dados de uma pessoa (usuário ou técnico).
// Os três últimos parâmetros ligam exigências extras por tela:
//   exigirPerfil     -> idade, nascimento e gênero obrigatórios
//   exigirNascimento -> só o nascimento é obrigatório
//   exigirGenero     -> só o gênero é obrigatório
// Devolve um objeto limpo ou lança erro 400.
function validarPessoa(
    dados,
    exigirPerfil = false,
    exigirNascimento = false,
    exigirGenero = false
) {
    // Normaliza os campos básicos.
    const nome = texto(dados.nome);
    const email = texto(dados.email).toLowerCase(); // e-mail sempre minúsculo
    const senha = dados.senha; // senha NÃO é "trimada": espaços podem fazer parte dela

    // Campos obrigatórios.
    if (!nome || !email || typeof senha !== 'string' || !senha) {
        throw erroHttp(400, 'Nome, e-mail e senha são obrigatórios.');
    }

    // Limite de tamanho do nome.
    if (nome.length > 120) {
        throw erroHttp(400, 'O nome deve ter no máximo 120 caracteres.');
    }

    // Formato e tamanho máximo do e-mail (254 é o limite padrão).
    if (!emailValido(email) || email.length > 254) {
        throw erroHttp(400, 'E-mail inválido.');
    }

    // bcrypt só considera os primeiros 72 BYTES da senha.
    // Buffer.byteLength conta bytes (acentos/emoji ocupam mais de 1).
    if (senha.length < 6 || Buffer.byteLength(senha, 'utf8') > 72) {
        throw erroHttp(
            400,
            'A senha deve ter pelo menos 6 caracteres e no máximo 72 bytes.'
        );
    }

    // Descobre se a idade foi enviada (não nula, não vazia).
    const idadeInformada =
        dados.idade !== undefined &&
        dados.idade !== null &&
        String(dados.idade).trim() !== '';

    // Converte para número, ou null se não veio.
    const idade = idadeInformada ? Number(dados.idade) : null;

    // Se a idade é exigida OU foi informada, ela precisa ser
    // um inteiro entre 18 e 99.
    if (
        (exigirPerfil || idadeInformada) &&
        (!Number.isInteger(idade) || idade < 18 || idade > 99)
    ) {
        throw erroHttp(400, 'Informe uma idade entre 18 e 99 anos.');
    }

    const nascimento = texto(dados.data_nascimento);

    // Mesma lógica: se exigida ou preenchida, tem de ser uma data real.
    if ((exigirPerfil || exigirNascimento || nascimento) && !dataValida(nascimento)) {
        throw erroHttp(400, 'Informe uma data de nascimento válida.');
    }

    // Impede data de nascimento no futuro.
    if (nascimento) {
        const hoje = new Date();
        const ano = hoje.getFullYear();
        // getMonth() começa em 0, por isso +1; padStart garante 2 dígitos.
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const dia = String(hoje.getDate()).padStart(2, '0');

        // Comparar textos AAAA-MM-DD funciona porque a ordem
        // alfabética coincide com a ordem cronológica.
        if (nascimento > `${ano}-${mes}-${dia}`) {
            throw erroHttp(400, 'A data de nascimento não pode ser futura.');
        }
    }

    const genero = texto(dados.genero);
    const generos = ['Masculino', 'Feminino', 'Prefiro_nao_dizer'];

    // Só aceita um dos valores permitidos.
    if (
        (exigirPerfil || exigirGenero || genero) &&
        !generos.includes(genero)
    ) {
        throw erroHttp(400, 'Selecione um gênero válido.');
    }

    // Devolve os dados já tratados. Campos vazios viram null
    // para serem gravados como NULL no banco.
    return {
        nome,
        email,
        senha,
        idade,
        data_nascimento: nascimento || null,
        genero: genero || null
    };
}

// "Envelope" para rotas async. O Express 4 não captura erros de
// funções async sozinho; este wrapper manda qualquer erro
// (throw ou Promise rejeitada) para o tratador final via next(erro).
const rota = (funcao) => (req, res, next) => {
    Promise.resolve()
        .then(() => funcao(req, res, next))
        .catch(next);
};

// =========================================================
// PREPARAÇÃO DO BANCO (criação e atualização de tabelas)
// =========================================================

// Adiciona APENAS as colunas que ainda não existem na tabela.
// Útil para atualizar bancos antigos sem perder dados.
// Atenção: nomes de tabela/coluna vêm do código (não do usuário),
// por isso é seguro interpolá-los no SQL.
async function adicionarCampos(tabela, campos) {
    // PRAGMA table_info lista as colunas atuais da tabela.
    const estrutura = await consultar(`PRAGMA table_info(${tabela})`);

    // Set com os nomes existentes, para busca rápida.
    const existentes = new Set(estrutura.map((coluna) => coluna.name));

    // Para cada coluna desejada que não existe, faz ALTER TABLE.
    for (const [nome, tipo] of Object.entries(campos)) {
        if (!existentes.has(nome)) {
            await executar(
                `ALTER TABLE ${tabela} ADD COLUMN ${nome} ${tipo}`
            );

            console.log(`Campo adicionado: ${tabela}.${nome}`);
        }
    }
}

// Cria todas as tabelas e dados iniciais necessários.
async function prepararBanco() {
    // Liga a verificação de chaves estrangeiras (no SQLite vem
    // desligada por padrão).
    await executar('PRAGMA foreign_keys = ON');

    // Se o banco estiver ocupado, espera até 5 s antes de dar erro.
    await executar('PRAGMA busy_timeout = 5000');

    // ---- Tabela de usuários (tela de entrada do site) ----
    await executar(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            senha_hash TEXT NOT NULL,
            idade INTEGER,
            data_nascimento TEXT,
            genero TEXT
        )
    `);

    // Garante colunas que versões antigas da tabela podem não ter
    // (incluindo "rm", que não está no CREATE acima).
    await adicionarCampos('usuarios', {
        rm: 'TEXT',
        idade: 'INTEGER',
        data_nascimento: 'TEXT',
        genero: 'TEXT'
    });

    // Índice único no RM, ignorando maiúsculas/minúsculas.
    // Impede dois usuários com o mesmo RM. (NULLs são permitidos
    // várias vezes no SQLite.)
    await executar(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_rm_unico
        ON usuarios (rm COLLATE NOCASE)
    `);

    // ---- Tabela de técnicos (separada dos usuários) ----
    await executar(`
        CREATE TABLE IF NOT EXISTS tecnicos (
            id_tecnico INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE,
            senha_hash TEXT,
            idade INTEGER,
            data_nascimento TEXT,
            genero TEXT,
            nivel TEXT,
            bio TEXT,
            horario_contato TEXT,
            data_disponivel TEXT
        )
    `);

    // Atualiza bancos antigos que não tinham todas essas colunas.
    await adicionarCampos('tecnicos', {
        email: 'TEXT',
        senha_hash: 'TEXT',
        idade: 'INTEGER',
        data_nascimento: 'TEXT',
        genero: 'TEXT',
        nivel: 'TEXT',
        bio: 'TEXT',
        horario_contato: 'TEXT',
        data_disponivel: 'TEXT'
    });

    // ---- Tabela de clientes ----
    await executar(`
        CREATE TABLE IF NOT EXISTS clientes (
            id_cliente INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            telefone TEXT,
            email TEXT
        )
    `);

    // ---- Tabela de equipamentos ----
    await executar(`
        CREATE TABLE IF NOT EXISTS equipamentos (
            id_equipamento INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL
        )
    `);

    // ---- Tabela de status possíveis de uma OS ----
    await executar(`
        CREATE TABLE IF NOT EXISTS status_os (
            id_status INTEGER PRIMARY KEY,
            descricao TEXT NOT NULL
        )
    `);

    // ---- Tabela de ordens de serviço (OS) ----
    // Liga cliente, técnico, equipamento e status por chaves estrangeiras.
    await executar(`
        CREATE TABLE IF NOT EXISTS ordens_servico (
            id_os INTEGER PRIMARY KEY AUTOINCREMENT,
            descricao_problema TEXT NOT NULL,
            data_os TEXT,
            id_cliente INTEGER,
            id_tecnico INTEGER,
            id_equipamento INTEGER,
            id_status INTEGER,
            FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
            FOREIGN KEY (id_tecnico) REFERENCES tecnicos(id_tecnico),
            FOREIGN KEY (id_equipamento)
                REFERENCES equipamentos(id_equipamento),
            FOREIGN KEY (id_status) REFERENCES status_os(id_status)
        )
    `);

    // Coluna adicionada depois: nível de emergência da OS.
    await adicionarCampos('ordens_servico', {
        nivel_emergencia: 'TEXT'
    });

    // Insere os 3 status fixos. "OR IGNORE" evita erro/duplicata
    // se eles já existirem.
    await executar(`
        INSERT OR IGNORE INTO status_os (id_status, descricao)
        VALUES
            (1, 'Em andamento'),
            (2, 'Concluída'),
            (3, 'Pendente')
    `);
}

// Copia os dados do banco antigo (pasta backend) para o banco
// novo (raiz), uma única vez.
async function migrarBancoAnterior() {
    // Se o banco antigo não existe, não há o que migrar.
    if (!fs.existsSync(caminhoBancoAnterior)) return;

    // Tabela de controle: registra quais migrações já rodaram.
    await executar(`
        CREATE TABLE IF NOT EXISTS migracoes_banco (
            chave TEXT PRIMARY KEY
        )
    `);

    // Identificador desta migração.
    const chaveMigracao = 'migrar-backend-para-raiz-v1';

    // Já foi feita? Então sai, para não repetir.
    const migracaoConcluida = await buscarUm(
        'SELECT chave FROM migracoes_banco WHERE chave = ?',
        [chaveMigracao]
    );
    if (migracaoConcluida) return;

    // ATTACH "pluga" o banco antigo na conexão atual com o apelido
    // banco_anterior, permitindo SELECT entre os dois bancos.
    await executar('ATTACH DATABASE ? AS banco_anterior', [caminhoBancoAnterior]);

    // Controla se há transação aberta (para saber se precisa de ROLLBACK).
    let transacaoAberta = false;

    try {
        // Transação: ou tudo é copiado, ou nada.
        await executar('BEGIN TRANSACTION');
        transacaoAberta = true;

        // Cada INSERT OR IGNORE ... SELECT copia as linhas do banco
        // antigo e ignora as que já existem (mesma chave).
        await executar(`
            INSERT OR IGNORE INTO status_os (id_status, descricao)
            SELECT id_status, descricao FROM banco_anterior.status_os
        `);
        await executar(`
            INSERT OR IGNORE INTO usuarios
                (id_usuario, nome, email, senha_hash, idade, data_nascimento, genero, rm)
            SELECT id_usuario, nome, email, senha_hash, idade, data_nascimento, genero, rm
            FROM banco_anterior.usuarios
        `);
        await executar(`
            INSERT OR IGNORE INTO tecnicos
                (id_tecnico, nome, email, senha_hash, idade, data_nascimento,
                 genero, nivel, bio, horario_contato, data_disponivel)
            SELECT id_tecnico, nome, email, senha_hash, idade, data_nascimento,
                   genero, nivel, bio, horario_contato, data_disponivel
            FROM banco_anterior.tecnicos
        `);
        await executar(`
            INSERT OR IGNORE INTO clientes (id_cliente, nome, telefone, email)
            SELECT id_cliente, nome, telefone, email FROM banco_anterior.clientes
        `);
        await executar(`
            INSERT OR IGNORE INTO equipamentos (id_equipamento, nome)
            SELECT id_equipamento, nome FROM banco_anterior.equipamentos
        `);
        await executar(`
            INSERT OR IGNORE INTO ordens_servico
                (id_os, descricao_problema, data_os, nivel_emergencia,
                 id_cliente, id_tecnico, id_equipamento, id_status)
            SELECT id_os, descricao_problema, data_os, nivel_emergencia,
                   id_cliente, id_tecnico, id_equipamento, id_status
            FROM banco_anterior.ordens_servico
        `);

        // Marca a migração como concluída.
        await executar(
            'INSERT INTO migracoes_banco (chave) VALUES (?)',
            [chaveMigracao]
        );

        // Confirma tudo.
        await executar('COMMIT');
        transacaoAberta = false;
        console.log('Dados do banco anterior mesclados no banco raiz.');
    } catch (erro) {
        // Algo falhou: desfaz o que foi feito na transação.
        if (transacaoAberta) {
            try {
                await executar('ROLLBACK');
            } catch (erroRollback) {
                console.error('Erro ao desfazer migração do banco:', erroRollback.message);
            }
        }
        // Repassa o erro original para quem chamou.
        throw erro;
    } finally {
        // Sempre desconecta o banco antigo, deu certo ou não.
        await executar('DETACH DATABASE banco_anterior');
    }
}

// =========================================================
// ENTRADA DO SITE: USUÁRIOS (cadastro e login)
// =========================================================

// POST /api/usuarios/cadastro
// Cadastra um usuário. O HTML redireciona depois do sucesso.
app.post('/api/usuarios/cadastro', rota(async (req, res) => {
    // req.body pode ser undefined; "|| {}" evita erro.
    const dados = req.body || {};

    // Valida nome/e-mail/senha e exige nascimento e gênero.
    const pessoa = validarPessoa(dados, false, true, true);

    // RM (registro de matrícula): obrigatório, até 4 caracteres.
    const rm = texto(dados.rm);

    if (!rm || rm.length > 4) {
        throw erroHttp(400, 'Informe um RM válido com até 4 caracteres.');
    }

    // E-mail já usado? (COLLATE NOCASE ignora maiúsculas/minúsculas)
    const existente = await buscarUm(
        'SELECT id_usuario FROM usuarios WHERE email = ? COLLATE NOCASE',
        [pessoa.email]
    );

    // 409 = Conflict (recurso já existe).
    if (existente) {
        throw erroHttp(
            409,
            'Este e-mail já está cadastrado. Nenhum novo registro foi criado.'
        );
    }

    // RM já usado?
    const rmExistente = await buscarUm(
        'SELECT id_usuario FROM usuarios WHERE rm = ? COLLATE NOCASE',
        [rm]
    );

    if (rmExistente) {
        throw erroHttp(409, 'Este RM já está cadastrado.');
    }

    // Gera o hash da senha. O "10" é o custo (rounds) do bcrypt:
    // quanto maior, mais lento e mais seguro.
    const senhaHash = await bcrypt.hash(pessoa.senha, 10);

    // Grava o novo usuário (só o hash, nunca a senha pura).
    const resultado = await executar(
        `INSERT INTO usuarios
            (nome, email, senha_hash, rm, idade, data_nascimento, genero)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            pessoa.nome,
            pessoa.email,
            senhaHash,
            rm,
            pessoa.idade,
            pessoa.data_nascimento,
            pessoa.genero
        ]
    );

    // 201 = Created.
    res.status(201).json({
        mensagem: 'Dados salvos com sucesso.',
        id_usuario: resultado.id
    });
}));

// POST /api/usuarios/login
// Confere e-mail e senha de um usuário.
app.post('/api/usuarios/login', rota(async (req, res) => {
    const dados = req.body || {};
    const email = texto(dados.email).toLowerCase();
    const senha = dados.senha;

    if (!email || typeof senha !== 'string' || !senha) {
        throw erroHttp(400, 'E-mail e senha são obrigatórios.');
    }

    if (!emailValido(email)) {
        throw erroHttp(400, 'E-mail inválido.');
    }

    // Busca o usuário pelo e-mail.
    const usuario = await buscarUm(
        'SELECT id_usuario, nome, email, senha_hash FROM usuarios WHERE email = ? COLLATE NOCASE',
        [email]
    );

    // Mesma mensagem para "não existe" e "senha errada":
    // assim não se revela quais e-mails estão cadastrados.
    // bcrypt.compare compara a senha digitada com o hash salvo.
    if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash))) {
        throw erroHttp(401, 'E-mail ou senha incorretos.');
    }

    // Devolve dados básicos (sem o hash).
    res.json({
        mensagem: 'Login realizado com sucesso.',
        usuario: {
            id_usuario: usuario.id_usuario,
            nome: usuario.nome,
            email: usuario.email
        }
    });
}));

// =========================================================
// CLIENTES (CRUD: criar, listar, editar, excluir)
// =========================================================

// POST /api/clientes — cria um cliente.
app.post('/api/clientes', rota(async (req, res) => {
    const dados = req.body || {};
    const nome = texto(dados.nome);
    const telefone = texto(dados.telefone);
    const email = texto(dados.email).toLowerCase();

    // Nome obrigatório e com limite de tamanho.
    if (!nome || nome.length > 120) {
        throw erroHttp(400, 'Informe um nome com até 120 caracteres.');
    }

    // Telefone e e-mail são opcionais, mas se vierem precisam ser válidos.
    if (telefone.length > 40 || email.length > 254 || (email && !emailValido(email))) {
        throw erroHttp(400, 'Confira o telefone e o e-mail informados.');
    }

    // "|| null" grava NULL quando o campo está vazio.
    const resultado = await executar(
        'INSERT INTO clientes (nome, telefone, email) VALUES (?, ?, ?)',
        [nome, telefone || null, email || null]
    );

    res.status(201).json({
        mensagem: 'Cliente cadastrado com sucesso.',
        id_cliente: resultado.id
    });
}));

// GET /api/clientes — lista clientes com a contagem de OS de cada um.
app.get('/api/clientes', rota(async (req, res) => {
    // LEFT JOIN mantém clientes sem nenhuma OS (contagem 0).
    // GROUP BY agrupa por cliente para o COUNT funcionar.
    const clientes = await consultar(`
        SELECT
            clientes.id_cliente,
            clientes.nome,
            clientes.telefone,
            clientes.email,
            COUNT(ordens_servico.id_os) AS os_atribuidas
        FROM clientes
        LEFT JOIN ordens_servico
            ON ordens_servico.id_cliente = clientes.id_cliente
        GROUP BY clientes.id_cliente
        ORDER BY clientes.nome COLLATE NOCASE
    `);

    res.json(clientes);
}));

// PUT /api/clientes/:id — edita um cliente existente.
app.put('/api/clientes/:id', rota(async (req, res) => {
    // :id da URL vem como texto; converte para número.
    const idCliente = Number(req.params.id);
    const dados = req.body || {};
    const nome = texto(dados.nome);
    const telefone = texto(dados.telefone);
    const email = texto(dados.email).toLowerCase();

    // O id precisa ser inteiro positivo.
    if (!Number.isInteger(idCliente) || idCliente < 1) {
        throw erroHttp(400, 'Identificador de cliente inválido.');
    }

    if (!nome || nome.length > 120) {
        throw erroHttp(400, 'Informe um nome com até 120 caracteres.');
    }

    if (telefone.length > 40 || email.length > 254 || (email && !emailValido(email))) {
        throw erroHttp(400, 'Confira o telefone e o e-mail informados.');
    }

    // Confirma que o cliente existe antes de atualizar.
    const cliente = await buscarUm(
        'SELECT id_cliente FROM clientes WHERE id_cliente = ?',
        [idCliente]
    );
    if (!cliente) throw erroHttp(404, 'Cliente não encontrado.');

    await executar(
        'UPDATE clientes SET nome = ?, telefone = ?, email = ? WHERE id_cliente = ?',
        [nome, telefone || null, email || null, idCliente]
    );

    res.json({ mensagem: 'Cliente atualizado com sucesso.' });
}));

// DELETE /api/clientes/:id — exclui um cliente (se não tiver OS).
app.delete('/api/clientes/:id', rota(async (req, res) => {
    const idCliente = Number(req.params.id);

    if (!Number.isInteger(idCliente) || idCliente < 1) {
        throw erroHttp(400, 'Identificador de cliente inválido.');
    }

    const cliente = await buscarUm(
        'SELECT id_cliente FROM clientes WHERE id_cliente = ?',
        [idCliente]
    );
    if (!cliente) throw erroHttp(404, 'Cliente não encontrado.');

    // Regra de negócio: não apaga cliente que tem OS vinculadas.
    const ordensVinculadas = await buscarUm(
        'SELECT COUNT(*) AS total FROM ordens_servico WHERE id_cliente = ?',
        [idCliente]
    );
    if (ordensVinculadas.total > 0) {
        throw erroHttp(409, 'Não é possível excluir este cliente enquanto houver OS vinculadas.');
    }

    await executar('DELETE FROM clientes WHERE id_cliente = ?', [idCliente]);
    res.json({ mensagem: 'Cliente excluído com sucesso.' });
}));

// =========================================================
// TÉCNICOS (cadastro, listagem, edição, exclusão, login)
// Mantidos separados dos usuários da tela de entrada.
// =========================================================

// POST /api/tecnicos/cadastro — cadastra um técnico.
app.post('/api/tecnicos/cadastro', rota(async (req, res) => {
    const dados = req.body || {};

    // Validação comum, sem exigir idade/nascimento/gênero.
    const pessoa = validarPessoa(dados);

    // E-mail já usado por outro técnico?
    const existente = await buscarUm(
        'SELECT id_tecnico FROM tecnicos WHERE email = ? COLLATE NOCASE',
        [pessoa.email]
    );

    if (existente) {
        throw erroHttp(409, 'Este e-mail já está cadastrado como técnico.');
    }

    const senhaHash = await bcrypt.hash(pessoa.senha, 10);

    // Grava o técnico, incluindo campos extras (nível, bio, horário...).
    const resultado = await executar(
        `INSERT INTO tecnicos
            (nome, email, senha_hash, idade, data_nascimento,
             genero, nivel, bio, horario_contato, data_disponivel)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            pessoa.nome,
            pessoa.email,
            senhaHash,
            pessoa.idade,
            pessoa.data_nascimento,
            pessoa.genero,
            texto(dados.nivel) || null,
            texto(dados.bio) || null,
            texto(dados.horario_contato) || null,
            texto(dados.data_disponivel) || null
        ]
    );

    res.status(201).json({
        mensagem: 'Técnico cadastrado com sucesso.',
        id_tecnico: resultado.id
    });
}));

// GET /api/tecnicos — lista técnicos com a quantidade de OS de cada um.
// (A senha_hash não é incluída no SELECT, de propósito.)
app.get('/api/tecnicos', rota(async (req, res) => {
    const tecnicos = await consultar(`
        SELECT
            tecnicos.id_tecnico,
            tecnicos.nome,
            tecnicos.email,
            tecnicos.idade,
            tecnicos.data_nascimento,
            tecnicos.genero,
            tecnicos.nivel,
            tecnicos.bio,
            tecnicos.horario_contato,
            tecnicos.data_disponivel,
            COUNT(ordens_servico.id_os) AS os_atribuidas
        FROM tecnicos
        LEFT JOIN ordens_servico
            ON ordens_servico.id_tecnico = tecnicos.id_tecnico
        GROUP BY tecnicos.id_tecnico
        ORDER BY tecnicos.nome
    `);

    res.json(tecnicos);
}));

// PUT /api/tecnicos/:id — edita um técnico.
// A senha é opcional: se vier vazia, mantém a antiga.
app.put('/api/tecnicos/:id', rota(async (req, res) => {
    const idTecnico = Number(req.params.id);
    const dados = req.body || {};
    const nome = texto(dados.nome);
    const email = texto(dados.email).toLowerCase();
    const senha = dados.senha;
    const idadeTexto = texto(dados.idade);
    const idade = idadeTexto ? Number(idadeTexto) : null;
    const nascimento = texto(dados.data_nascimento);
    const genero = texto(dados.genero);
    const nivel = texto(dados.nivel);
    const bio = texto(dados.bio);
    const horarioContato = texto(dados.horario_contato);
    const dataDisponivel = texto(dados.data_disponivel);

    if (!Number.isInteger(idTecnico) || idTecnico < 1) {
        throw erroHttp(400, 'Identificador de técnico inválido.');
    }

    // Nome e e-mail são obrigatórios e precisam ser válidos.
    if (!nome || nome.length > 120 || !email || email.length > 254 || !emailValido(email)) {
        throw erroHttp(400, 'Informe nome e e-mail válidos.');
    }

    // Idade só é validada se foi informada.
    if (idadeTexto && (!Number.isInteger(idade) || idade < 18 || idade > 99)) {
        throw erroHttp(400, 'A idade deve estar entre 18 e 99 anos.');
    }

    if (nascimento && !dataValida(nascimento)) {
        throw erroHttp(400, 'Informe uma data de nascimento válida.');
    }

    if (genero && !['Masculino', 'Feminino', 'Prefiro_nao_dizer'].includes(genero)) {
        throw erroHttp(400, 'Selecione um gênero válido.');
    }

    // Níveis aceitos para o técnico.
    if (nivel && !['JÚNIOR', 'PLENO', 'SÊNIOR'].includes(nivel)) {
        throw erroHttp(400, 'Selecione um nível de conhecimento válido.');
    }

    // Se mandou nova senha, ela precisa respeitar as regras.
    if (senha && (typeof senha !== 'string' || senha.length < 6 || Buffer.byteLength(senha, 'utf8') > 72)) {
        throw erroHttp(400, 'A senha deve ter pelo menos 6 caracteres e no máximo 72 bytes.');
    }

    // Limites de bio, horário e validade da data de disponibilidade.
    if (bio.length > 1000 || horarioContato.length > 30 || (dataDisponivel && !dataValida(dataDisponivel))) {
        throw erroHttp(400, 'Confira a experiência, o horário e a data de disponibilidade.');
    }

    // Busca o técnico (também precisa do hash atual, se a senha não mudar).
    const tecnico = await buscarUm(
        'SELECT id_tecnico, senha_hash FROM tecnicos WHERE id_tecnico = ?',
        [idTecnico]
    );
    if (!tecnico) throw erroHttp(404, 'Técnico não encontrado.');

    // O novo e-mail não pode pertencer a OUTRO técnico (<> id atual).
    const emailExistente = await buscarUm(
        'SELECT id_tecnico FROM tecnicos WHERE email = ? COLLATE NOCASE AND id_tecnico <> ?',
        [email, idTecnico]
    );
    if (emailExistente) throw erroHttp(409, 'Este e-mail já pertence a outro técnico.');

    // Gera novo hash se veio senha nova; senão reaproveita o antigo.
    const senhaHash = senha ? await bcrypt.hash(senha, 10) : tecnico.senha_hash;

    await executar(
        `UPDATE tecnicos
         SET nome = ?, email = ?, senha_hash = ?, idade = ?, data_nascimento = ?,
             genero = ?, nivel = ?, bio = ?, horario_contato = ?, data_disponivel = ?
         WHERE id_tecnico = ?`,
        [
            nome,
            email,
            senhaHash,
            idade,
            nascimento || null,
            genero || null,
            nivel || null,
            bio || null,
            horarioContato || null,
            dataDisponivel || null,
            idTecnico
        ]
    );

    res.json({ mensagem: 'Técnico atualizado com sucesso.' });
}));

// DELETE /api/tecnicos/:id — exclui um técnico (se não tiver OS).
app.delete('/api/tecnicos/:id', rota(async (req, res) => {
    const idTecnico = Number(req.params.id);

    if (!Number.isInteger(idTecnico) || idTecnico < 1) {
        throw erroHttp(400, 'Identificador de técnico inválido.');
    }

    const tecnico = await buscarUm(
        'SELECT id_tecnico FROM tecnicos WHERE id_tecnico = ?',
        [idTecnico]
    );
    if (!tecnico) throw erroHttp(404, 'Técnico não encontrado.');

    // Regra de negócio: técnico com OS atribuídas não pode ser apagado.
    const ordensVinculadas = await buscarUm(
        'SELECT COUNT(*) AS total FROM ordens_servico WHERE id_tecnico = ?',
        [idTecnico]
    );
    if (ordensVinculadas.total > 0) {
        throw erroHttp(409, 'Não é possível excluir este técnico enquanto houver OS atribuídas a ele.');
    }

    await executar('DELETE FROM tecnicos WHERE id_tecnico = ?', [idTecnico]);
    res.json({ mensagem: 'Técnico excluído com sucesso.' });
}));

// =========================================================
// ORDENS DE SERVIÇO (OS)
// =========================================================

// GET /api/ordens/opcoes — devolve listas para preencher
// os <select> do formulário (técnicos e status).
app.get('/api/ordens/opcoes', rota(async (req, res) => {
    const tecnicos = await consultar(
        'SELECT id_tecnico, nome FROM tecnicos ORDER BY nome'
    );
    const status = await consultar(
        'SELECT id_status, descricao FROM status_os ORDER BY id_status'
    );

    res.json({ tecnicos, status });
}));

// GET /api/ordens — lista todas as OS, já com nomes legíveis
// (cliente, equipamento, técnico, status) vindos de JOINs.
app.get('/api/ordens', rota(async (req, res) => {
    const ordens = await consultar(`
        SELECT
            os.id_os,
            os.data_os,
            os.descricao_problema,
            os.nivel_emergencia,
            os.id_status,
            os.id_cliente,
            os.id_tecnico,
            os.id_equipamento,
            status_os.descricao AS status,
            clientes.nome AS cliente,
            equipamentos.nome AS equipamento,
            tecnicos.nome AS tecnico
        FROM ordens_servico AS os
        LEFT JOIN status_os ON status_os.id_status = os.id_status
        LEFT JOIN clientes ON clientes.id_cliente = os.id_cliente
        LEFT JOIN equipamentos ON equipamentos.id_equipamento = os.id_equipamento
        LEFT JOIN tecnicos ON tecnicos.id_tecnico = os.id_tecnico
        ORDER BY os.id_os DESC
    `);

    res.json(ordens);
}));

// POST /api/ordens — cria uma nova OS.
// O cliente e o equipamento chegam como TEXTO; se não existirem
// no banco, são criados automaticamente.
app.post('/api/ordens', rota(async (req, res) => {
    const dados = req.body || {};
    const cliente = texto(dados.cliente);
    const equipamento = texto(dados.equipamento);
    const descricao = texto(dados.descricao_problema);
    const dataOs = texto(dados.data_os);
    const nivelEmergencia = texto(dados.nivel_emergencia);
    const idTecnico = Number(dados.id_tecnico);
    // Toda OS nova nasce com status 1 = "Em andamento".
    const idStatus = 1;
    const niveisEmergencia = ['Baixo', 'Médio', 'Grave'];

    if (!cliente || cliente.length > 120) {
        throw erroHttp(400, 'Informe um cliente com até 120 caracteres.');
    }

    if (!equipamento || equipamento.length > 120) {
        throw erroHttp(400, 'Informe um equipamento com até 120 caracteres.');
    }

    if (!descricao || descricao.length > 1000) {
        throw erroHttp(400, 'Informe a descrição do problema com até 1000 caracteres.');
    }

    if (!dataValida(dataOs)) {
        throw erroHttp(400, 'Informe uma data válida para a solicitação da OS.');
    }

    if (!niveisEmergencia.includes(nivelEmergencia)) {
        throw erroHttp(400, 'Selecione um nível de emergência válido.');
    }

    if (!Number.isInteger(idTecnico) || idTecnico < 1) {
        throw erroHttp(400, 'Selecione um técnico válido.');
    }

    // Confere se técnico e status realmente existem no banco.
    const tecnico = await buscarUm(
        'SELECT id_tecnico FROM tecnicos WHERE id_tecnico = ?',
        [idTecnico]
    );
    const status = await buscarUm(
        'SELECT id_status FROM status_os WHERE id_status = ?',
        [idStatus]
    );

    if (!tecnico) throw erroHttp(400, 'O técnico selecionado não existe.');
    if (!status) throw erroHttp(400, 'O status selecionado não existe.');

    let transacaoAberta = false;

    try {
        // Transação: cliente + equipamento + OS são gravados juntos.
        // Se algo falhar, nada fica pela metade.
        await executar('BEGIN TRANSACTION');
        transacaoAberta = true;

        // Procura o cliente pelo nome; se não existe, cria.
        let clienteSalvo = await buscarUm(
            'SELECT id_cliente FROM clientes WHERE nome = ? COLLATE NOCASE',
            [cliente]
        );

        if (!clienteSalvo) {
            const resultadoCliente = await executar(
                'INSERT INTO clientes (nome) VALUES (?)',
                [cliente]
            );
            clienteSalvo = { id_cliente: resultadoCliente.id };
        }

        // Mesma lógica para o equipamento.
        let equipamentoSalvo = await buscarUm(
            'SELECT id_equipamento FROM equipamentos WHERE nome = ? COLLATE NOCASE',
            [equipamento]
        );

        if (!equipamentoSalvo) {
            const resultadoEquipamento = await executar(
                'INSERT INTO equipamentos (nome) VALUES (?)',
                [equipamento]
            );
            equipamentoSalvo = { id_equipamento: resultadoEquipamento.id };
        }

        // Cria a OS ligando todos os ids.
        const resultadoOrdem = await executar(
            `INSERT INTO ordens_servico
                (descricao_problema, data_os, nivel_emergencia, id_cliente,
                 id_tecnico, id_equipamento, id_status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                descricao,
                dataOs,
                nivelEmergencia,
                clienteSalvo.id_cliente,
                idTecnico,
                equipamentoSalvo.id_equipamento,
                idStatus
            ]
        );

        // Confirma a transação.
        await executar('COMMIT');
        transacaoAberta = false;

        res.status(201).json({
            mensagem: 'Ordem de serviço criada com sucesso.',
            id_os: resultadoOrdem.id
        });
    } catch (erro) {
        // Falhou no meio: desfaz tudo.
        if (transacaoAberta) {
            try {
                await executar('ROLLBACK');
            } catch (erroRollback) {
                console.error('Erro ao desfazer cadastro da OS:', erroRollback.message);
            }
        }

        throw erro;
    }
}));

// PUT /api/ordens/:id — edita uma OS completa (inclusive o status).
app.put('/api/ordens/:id', rota(async (req, res) => {
    const idOrdem = Number(req.params.id);
    const dados = req.body || {};
    const cliente = texto(dados.cliente);
    const equipamento = texto(dados.equipamento);
    const descricao = texto(dados.descricao_problema);
    const dataOs = texto(dados.data_os);
    const nivelEmergencia = texto(dados.nivel_emergencia);
    const idTecnico = Number(dados.id_tecnico);
    const idStatus = Number(dados.id_status);

    if (!Number.isInteger(idOrdem) || idOrdem < 1) {
        throw erroHttp(400, 'Identificador de OS inválido.');
    }

    if (!cliente || cliente.length > 120) {
        throw erroHttp(400, 'Informe um cliente com até 120 caracteres.');
    }

    if (!equipamento || equipamento.length > 120) {
        throw erroHttp(400, 'Informe um equipamento com até 120 caracteres.');
    }

    if (!descricao || descricao.length > 1000) {
        throw erroHttp(400, 'Informe a descrição do problema com até 1000 caracteres.');
    }

    if (!dataValida(dataOs)) {
        throw erroHttp(400, 'Informe uma data válida para a solicitação da OS.');
    }

    if (!['Baixo', 'Médio', 'Grave'].includes(nivelEmergencia)) {
        throw erroHttp(400, 'Selecione um nível de emergência válido.');
    }

    if (!Number.isInteger(idTecnico) || idTecnico < 1) {
        throw erroHttp(400, 'Selecione um técnico válido.');
    }

    // Só os status 1, 2 e 3 existem.
    if (![1, 2, 3].includes(idStatus)) {
        throw erroHttp(400, 'Selecione um status válido.');
    }

    // Confere se a OS e o técnico existem.
    const ordemExistente = await buscarUm(
        'SELECT id_os FROM ordens_servico WHERE id_os = ?',
        [idOrdem]
    );
    const tecnico = await buscarUm(
        'SELECT id_tecnico FROM tecnicos WHERE id_tecnico = ?',
        [idTecnico]
    );

    if (!ordemExistente) throw erroHttp(404, 'Ordem de serviço não encontrada.');
    if (!tecnico) throw erroHttp(400, 'O técnico selecionado não existe.');

    let transacaoAberta = false;

    try {
        await executar('BEGIN TRANSACTION');
        transacaoAberta = true;

        // Reaproveita ou cria o cliente (igual ao POST).
        let clienteSalvo = await buscarUm(
            'SELECT id_cliente FROM clientes WHERE nome = ? COLLATE NOCASE',
            [cliente]
        );
        if (!clienteSalvo) {
            const resultadoCliente = await executar(
                'INSERT INTO clientes (nome) VALUES (?)',
                [cliente]
            );
            clienteSalvo = { id_cliente: resultadoCliente.id };
        }

        // Reaproveita ou cria o equipamento.
        let equipamentoSalvo = await buscarUm(
            'SELECT id_equipamento FROM equipamentos WHERE nome = ? COLLATE NOCASE',
            [equipamento]
        );
        if (!equipamentoSalvo) {
            const resultadoEquipamento = await executar(
                'INSERT INTO equipamentos (nome) VALUES (?)',
                [equipamento]
            );
            equipamentoSalvo = { id_equipamento: resultadoEquipamento.id };
        }

        // Atualiza todos os campos da OS.
        await executar(
            `UPDATE ordens_servico
             SET descricao_problema = ?, data_os = ?, nivel_emergencia = ?,
                 id_cliente = ?, id_tecnico = ?, id_equipamento = ?, id_status = ?
             WHERE id_os = ?`,
            [
                descricao,
                dataOs,
                nivelEmergencia,
                clienteSalvo.id_cliente,
                idTecnico,
                equipamentoSalvo.id_equipamento,
                idStatus,
                idOrdem
            ]
        );

        await executar('COMMIT');
        transacaoAberta = false;
        res.json({ mensagem: 'Ordem de serviço atualizada com sucesso.' });
    } catch (erro) {
        if (transacaoAberta) {
            try {
                await executar('ROLLBACK');
            } catch (erroRollback) {
                console.error('Erro ao desfazer edição da OS:', erroRollback.message);
            }
        }

        throw erro;
    }
}));

// DELETE /api/ordens/:id — exclui uma OS.
app.delete('/api/ordens/:id', rota(async (req, res) => {
    const idOrdem = Number(req.params.id);

    if (!Number.isInteger(idOrdem) || idOrdem < 1) {
        throw erroHttp(400, 'Identificador de OS inválido.');
    }

    const resultado = await executar(
        'DELETE FROM ordens_servico WHERE id_os = ?',
        [idOrdem]
    );

    // "alteradas" = 0 significa que nenhuma linha foi apagada,
    // ou seja, a OS não existia.
    if (!resultado.alteradas) {
        throw erroHttp(404, 'Ordem de serviço não encontrada.');
    }

    res.json({ mensagem: 'Ordem de serviço excluída com sucesso.' });
}));

// PUT /api/ordens/:id/status — altera SÓ o status de uma OS
// (atalho para botões como "concluir").
app.put('/api/ordens/:id/status', rota(async (req, res) => {
    const idOrdem = Number(req.params.id);
    const idStatus = Number((req.body || {}).id_status);

    if (!Number.isInteger(idOrdem) || idOrdem < 1) {
        throw erroHttp(400, 'Identificador de OS inválido.');
    }

    if (![1, 2, 3].includes(idStatus)) {
        throw erroHttp(400, 'Selecione um status válido.');
    }

    const resultado = await executar(
        'UPDATE ordens_servico SET id_status = ? WHERE id_os = ?',
        [idStatus, idOrdem]
    );

    if (!resultado.alteradas) {
        throw erroHttp(404, 'Ordem de serviço não encontrada.');
    }

    res.json({ mensagem: 'Status da OS atualizado com sucesso.' });
}));

// =========================================================
// ROTA DE MÉTRICAS DA DASHBOARD (inicio.html)
// =========================================================

// GET /api/ordens/resumo — devolve totais para os cartões do painel.
app.get('/api/ordens/resumo', rota(async (req, res) => {
    // Total geral de OS.
    const totalOs = await buscarUm('SELECT COUNT(*) AS total FROM ordens_servico');

    // Concluídas (status 2).
    const concluidas = await buscarUm('SELECT COUNT(*) AS total FROM ordens_servico WHERE id_status = 2');

    // Em andamento (status 1).
    const emAndamento = await buscarUm('SELECT COUNT(*) AS total FROM ordens_servico WHERE id_status = 1');

    // Atrasadas: em andamento (1) ou pendentes (3) com data anterior a hoje.
    // toISOString() usa UTC, então "hoje" pode divergir do horário local.
    const hoje = new Date().toISOString().slice(0, 10);
    const atrasadas = await buscarUm(
        `SELECT COUNT(*) AS total FROM ordens_servico
         WHERE id_status IN (1, 3) AND data_os < ?`,
        [hoje]
    );

    // "|| 0" é uma proteção caso algum valor venha vazio.
    res.json({
        total: totalOs.total || 0,
        concluidas: concluidas.total || 0,
        emAndamento: emAndamento.total || 0,
        atrasadas: atrasadas.total || 0
    });
}));

// POST /api/tecnicos/login — login de técnicos (a tela de entrada
// do site NÃO usa esta rota; ela usa /api/usuarios/login).
app.post('/api/tecnicos/login', rota(async (req, res) => {
    const dados = req.body || {};
    const email = texto(dados.email).toLowerCase();
    const senha = dados.senha;

    if (!email || typeof senha !== 'string' || !senha) {
        throw erroHttp(400, 'E-mail e senha são obrigatórios.');
    }

    const tecnico = await buscarUm(
        'SELECT * FROM tecnicos WHERE email = ? COLLATE NOCASE',
        [email]
    );

    // Falha se: não existe, não tem senha cadastrada,
    // ou a senha não bate com o hash.
    if (
        !tecnico ||
        !tecnico.senha_hash ||
        !(await bcrypt.compare(senha, tecnico.senha_hash))
    ) {
        throw erroHttp(401, 'E-mail ou senha incorretos.');
    }

    res.json({
        mensagem: 'Login realizado com sucesso.',
        tecnico: {
            id_tecnico: tecnico.id_tecnico,
            nome: tecnico.nome,
            email: tecnico.email
        }
    });
}));

// GET /api/saude — rota de teste: confirma que a API e o banco respondem.
app.get('/api/saude', rota(async (req, res) => {
    await buscarUm('SELECT 1 AS ok');
    res.json({ api: 'ok', banco: 'ok' });
}));

// =========================================================
// ENTREGA DO FRONT-END (arquivos estáticos)
// =========================================================

// Só estas extensões podem ser baixadas pelo navegador.
const extensoesPublicas = new Set([
    '.html', '.css', '.js', '.png', '.jpg', '.jpeg',
    '.gif', '.svg', '.webp', '.ico', '.woff', '.woff2', '.ttf'
]);

// Arquivos .js do back-end que NUNCA devem ser entregues,
// mesmo sendo .js (código-fonte do servidor).
const arquivosInternos = new Set([
    'server.js', 'api.js', 'database.js', 'consulta.js',
    'estrutura.js', 'validacao.js', 'erros.js', 'clientes.js',
    'tecnicos.js', 'equipamentos.js', 'ordens.js',
    'relatorios.js', 'usuarios.js', 'banco.js', 'pessoas.js',
    'atualizar-banco.js'
]);

// Middleware que decide se a requisição pode virar um arquivo estático.
app.use((req, res, next) => {
    // Arquivos só são entregues em GET/HEAD; outros métodos seguem adiante.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
    }

    let caminho;

    try {
        // Decodifica %20, %2e etc. para ver o caminho real.
        caminho = decodeURIComponent(req.path);
    } catch {
        // URL malformada.
        return res.status(400).send('Endereço inválido.');
    }

    // Nome do arquivo e extensão, em minúsculas.
    const nome = path.basename(caminho).toLowerCase();
    const extensao = path.extname(caminho).toLowerCase();

    // Bloqueia (passa para o 404) se: estiver em node_modules,
    // for arquivo interno, ou tiver extensão não permitida
    // (a raiz "/" é exceção, pois serve o index.html).
    if (
        caminho.includes('/node_modules/') ||
        arquivosInternos.has(nome) ||
        (caminho !== '/' && !extensoesPublicas.has(extensao))
    ) {
        return next();
    }

    // Entrega o arquivo a partir da pasta do server.js.
    // dotfiles: 'deny' bloqueia arquivos que começam com ponto
    // (.env, .git...). index.html é a página padrão da raiz.
    return express.static(__dirname, {
        dotfiles: 'deny',
        index: 'index.html'
    })(req, res, next);
});

// =========================================================
// TRATAMENTO DE ERROS (devem vir por último)
// =========================================================

// Nenhuma rota atendeu: devolve 404 em JSON.
app.use((req, res) => {
    res.status(404).json({
        erro: `Rota não encontrada: ${req.method} ${req.originalUrl}`
    });
});

// Tratador central de erros (4 parâmetros = middleware de erro).
// Recebe tudo o que foi lançado com throw ou passado para next(erro).
app.use((erro, req, res, next) => {
    // Registra no terminal para o desenvolvedor.
    console.error(erro);

    // JSON enviado com sintaxe quebrada.
    if (erro.type === 'entity.parse.failed') {
        return res.status(400).json({ erro: 'JSON inválido.' });
    }

    // Erros criados por erroHttp(): usa o status e a mensagem deles.
    if (erro.status) {
        return res.status(erro.status).json({ erro: erro.message });
    }

    // Violação de UNIQUE no SQLite (e-mail/RM duplicado numa disputa
    // entre duas requisições simultâneas, por exemplo).
    if (
        erro.code === 'SQLITE_CONSTRAINT' &&
        /UNIQUE/i.test(erro.message)
    ) {
        return res.status(409).json({
            erro: 'Já existe um cadastro com esses dados.'
        });
    }

    // Qualquer outro erro: resposta genérica, sem expor detalhes internos.
    res.status(500).json({
        erro: 'Erro interno. Confira a mensagem no terminal.'
    });
});

// =========================================================
// INICIALIZAÇÃO: só sobe o servidor depois do banco pronto
// =========================================================

prepararBanco()                 // 1) cria/atualiza tabelas
    .then(migrarBancoAnterior)  // 2) migra dados do banco antigo (uma vez)
    .then(() => {
        // Porta vem da variável de ambiente PORT, ou 3000 por padrão.
        const porta = Number(process.env.PORT) || 3000;

        // Escuta só em 127.0.0.1: acessível apenas do próprio computador.
        const servidor = app.listen(porta, '127.0.0.1', () => {
            console.log('==========================================');
            console.log('SITE + BACK-END FUNCIONANDO');
            console.log(`Abra: http://localhost:${porta}/index.html`);
            console.log('Banco:', caminhoBanco);
            console.log('==========================================');
        });

        // Erro ao abrir a porta (ex.: já está em uso).
        servidor.on('error', (erro) => {
            console.error('Não foi possível iniciar:', erro.message);
            db.close();
            process.exitCode = 1;
        });
    })
    .catch((erro) => {
        // Erro na preparação/migração do banco: encerra com falha.
        console.error('Erro ao preparar o banco:', erro.message);
        db.close();
        process.exitCode = 1;
    });