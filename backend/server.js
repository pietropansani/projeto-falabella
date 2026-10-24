// =========================================================
// SYNTAX.lab — BACK-END
//
// - Abre os arquivos HTML e CSS do seu site.
// - Salva os dados da tela de entrada na tabela usuarios.
// - Mantém cadastro e login de técnicos separados.
// - Usa o banco.db localizado na raiz do projeto.
// - Não apaga as tabelas nem os registros existentes.
// =========================================================

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));

// Usa o banco na raiz do projeto e mantém o antigo da pasta backend como origem da migração.
const caminhoBanco = path.join(__dirname, '..', 'banco.db');
const caminhoBancoAnterior = path.join(__dirname, 'banco.db');

const db = new sqlite3.Database(caminhoBanco);

// =========================================================
// FUNÇÕES DO BANCO
// =========================================================

// Consulta várias linhas.
function consultar(sql, parametros = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, parametros, (erro, linhas) => {
            if (erro) reject(erro);
            else resolve(linhas);
        });
    });
}

// Consulta uma linha.
function buscarUm(sql, parametros = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, parametros, (erro, linha) => {
            if (erro) reject(erro);
            else resolve(linha);
        });
    });
}

// Executa INSERT, UPDATE, DELETE e comandos de estrutura.
function executar(sql, parametros = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, parametros, function (erro) {
            if (erro) {
                reject(erro);
            } else {
                resolve({
                    id: this.lastID,
                    alteradas: this.changes
                });
            }
        });
    });
}

// =========================================================
// VALIDAÇÕES
// =========================================================

function erroHttp(status, mensagem) {
    const erro = new Error(mensagem);
    erro.status = status;
    return erro;
}

function texto(valor) {
    return typeof valor === 'string' ? valor.trim() : '';
}

function emailValido(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Confere o formato e se a data existe no calendário.
function dataValida(valor) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        return false;
    }

    const data = new Date(`${valor}T00:00:00.000Z`);

    return (
        !Number.isNaN(data.getTime()) &&
        data.toISOString().slice(0, 10) === valor
    );
}

// Valida os dados comuns; campos extras podem ser exigidos por tela.
function validarPessoa(
    dados,
    exigirPerfil = false,
    exigirNascimento = false,
    exigirGenero = false
) {
    const nome = texto(dados.nome);
    const email = texto(dados.email).toLowerCase();
    const senha = dados.senha;

    if (!nome || !email || typeof senha !== 'string' || !senha) {
        throw erroHttp(400, 'Nome, e-mail e senha são obrigatórios.');
    }

    if (nome.length > 120) {
        throw erroHttp(400, 'O nome deve ter no máximo 120 caracteres.');
    }

    if (!emailValido(email) || email.length > 254) {
        throw erroHttp(400, 'E-mail inválido.');
    }

    // bcrypt trabalha com até 72 bytes de senha.
    if (senha.length < 6 || Buffer.byteLength(senha, 'utf8') > 72) {
        throw erroHttp(
            400,
            'A senha deve ter pelo menos 6 caracteres e no máximo 72 bytes.'
        );
    }

    const idadeInformada =
        dados.idade !== undefined &&
        dados.idade !== null &&
        String(dados.idade).trim() !== '';

    const idade = idadeInformada ? Number(dados.idade) : null;

    if (
        (exigirPerfil || idadeInformada) &&
        (!Number.isInteger(idade) || idade < 18 || idade > 99)
    ) {
        throw erroHttp(400, 'Informe uma idade entre 18 e 99 anos.');
    }

    const nascimento = texto(dados.data_nascimento);

    if ((exigirPerfil || exigirNascimento || nascimento) && !dataValida(nascimento)) {
        throw erroHttp(400, 'Informe uma data de nascimento válida.');
    }

    if (nascimento) {
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const dia = String(hoje.getDate()).padStart(2, '0');

        if (nascimento > `${ano}-${mes}-${dia}`) {
            throw erroHttp(400, 'A data de nascimento não pode ser futura.');
        }
    }

    const genero = texto(dados.genero);
    const generos = ['Masculino', 'Feminino', 'Prefiro_nao_dizer'];

    if (
        (exigirPerfil || exigirGenero || genero) &&
        !generos.includes(genero)
    ) {
        throw erroHttp(400, 'Selecione um gênero válido.');
    }

    return {
        nome,
        email,
        senha,
        idade,
        data_nascimento: nascimento || null,
        genero: genero || null
    };
}

// Encaminha os erros das rotas async para o tratamento final.
const rota = (funcao) => (req, res, next) => {
    Promise.resolve()
        .then(() => funcao(req, res, next))
        .catch(next);
};

// =========================================================
// PREPARAÇÃO DO BANCO
// =========================================================

// Adiciona somente as colunas ausentes.
// Os nomes de tabela e coluna são definidos no código.
async function adicionarCampos(tabela, campos) {
    const estrutura = await consultar(`PRAGMA table_info(${tabela})`);
    const existentes = new Set(estrutura.map((coluna) => coluna.name));

    for (const [nome, tipo] of Object.entries(campos)) {
        if (!existentes.has(nome)) {
            await executar(
                `ALTER TABLE ${tabela} ADD COLUMN ${nome} ${tipo}`
            );

            console.log(`Campo adicionado: ${tabela}.${nome}`);
        }
    }
}

async function prepararBanco() {
    await executar('PRAGMA foreign_keys = ON');
    await executar('PRAGMA busy_timeout = 5000');

    // Pessoas cadastradas pela tela de entrada.
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

    // Atualiza também a tabela usuarios de versões anteriores.
    await adicionarCampos('usuarios', {
        rm: 'TEXT',
        idade: 'INTEGER',
        data_nascimento: 'TEXT',
        genero: 'TEXT'
    });

    await executar(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_rm_unico
        ON usuarios (rm COLLATE NOCASE)
    `);

    // Cadastro de técnicos: separado dos usuários da entrada.
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

    // Mantém as demais tabelas do seu projeto.
    await executar(`
        CREATE TABLE IF NOT EXISTS clientes (
            id_cliente INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            telefone TEXT,
            email TEXT
        )
    `);

    await executar(`
        CREATE TABLE IF NOT EXISTS equipamentos (
            id_equipamento INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL
        )
    `);

    await executar(`
        CREATE TABLE IF NOT EXISTS status_os (
            id_status INTEGER PRIMARY KEY,
            descricao TEXT NOT NULL
        )
    `);

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

    await adicionarCampos('ordens_servico', {
        nivel_emergencia: 'TEXT'
    });

    await executar(`
        INSERT OR IGNORE INTO status_os (id_status, descricao)
        VALUES
            (1, 'Em andamento'),
            (2, 'Concluída'),
            (3, 'Pendente')
    `);
}

async function migrarBancoAnterior() {
    if (!fs.existsSync(caminhoBancoAnterior)) return;

    await executar(`
        CREATE TABLE IF NOT EXISTS migracoes_banco (
            chave TEXT PRIMARY KEY
        )
    `);

    const chaveMigracao = 'migrar-backend-para-raiz-v1';
    const migracaoConcluida = await buscarUm(
        'SELECT chave FROM migracoes_banco WHERE chave = ?',
        [chaveMigracao]
    );
    if (migracaoConcluida) return;

    await executar('ATTACH DATABASE ? AS banco_anterior', [caminhoBancoAnterior]);
    let transacaoAberta = false;

    try {
        await executar('BEGIN TRANSACTION');
        transacaoAberta = true;

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
        await executar(
            'INSERT INTO migracoes_banco (chave) VALUES (?)',
            [chaveMigracao]
        );

        await executar('COMMIT');
        transacaoAberta = false;
        console.log('Dados do banco anterior mesclados no banco raiz.');
    } catch (erro) {
        if (transacaoAberta) {
            try {
                await executar('ROLLBACK');
            } catch (erroRollback) {
                console.error('Erro ao desfazer migração do banco:', erroRollback.message);
            }
        }
        throw erro;
    } finally {
        await executar('DETACH DATABASE banco_anterior');
    }
}

// =========================================================
// ENTRADA DO SITE: SALVAR USUÁRIO
// =========================================================

// Não é uma verificação de login.
// Cadastra a pessoa; o HTML redireciona após receber sucesso.
app.post('/api/usuarios/cadastro', rota(async (req, res) => {
    const dados = req.body || {};
    const pessoa = validarPessoa(dados, false, true, true);
    const rm = texto(dados.rm);

    if (!rm || rm.length > 4) {
        throw erroHttp(400, 'Informe um RM válido com até 4 caracteres.');
    }

    const existente = await buscarUm(
        'SELECT id_usuario FROM usuarios WHERE email = ? COLLATE NOCASE',
        [pessoa.email]
    );

    if (existente) {
        throw erroHttp(
            409,
            'Este e-mail já está cadastrado. Nenhum novo registro foi criado.'
        );
    }

    const rmExistente = await buscarUm(
        'SELECT id_usuario FROM usuarios WHERE rm = ? COLLATE NOCASE',
        [rm]
    );

    if (rmExistente) {
        throw erroHttp(409, 'Este RM já está cadastrado.');
    }

    const senhaHash = await bcrypt.hash(pessoa.senha, 10);

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

    res.status(201).json({
        mensagem: 'Dados salvos com sucesso.',
        id_usuario: resultado.id
    });
}));

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

    const usuario = await buscarUm(
        'SELECT id_usuario, nome, email, senha_hash FROM usuarios WHERE email = ? COLLATE NOCASE',
        [email]
    );

    if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash))) {
        throw erroHttp(401, 'E-mail ou senha incorretos.');
    }

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
// CLIENTES
// =========================================================

app.post('/api/clientes', rota(async (req, res) => {
    const dados = req.body || {};
    const nome = texto(dados.nome);
    const telefone = texto(dados.telefone);
    const email = texto(dados.email).toLowerCase();

    if (!nome || nome.length > 120) {
        throw erroHttp(400, 'Informe um nome com até 120 caracteres.');
    }

    if (telefone.length > 40 || email.length > 254 || (email && !emailValido(email))) {
        throw erroHttp(400, 'Confira o telefone e o e-mail informados.');
    }

    const resultado = await executar(
        'INSERT INTO clientes (nome, telefone, email) VALUES (?, ?, ?)',
        [nome, telefone || null, email || null]
    );

    res.status(201).json({
        mensagem: 'Cliente cadastrado com sucesso.',
        id_cliente: resultado.id
    });
}));

app.get('/api/clientes', rota(async (req, res) => {
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

app.put('/api/clientes/:id', rota(async (req, res) => {
    const idCliente = Number(req.params.id);
    const dados = req.body || {};
    const nome = texto(dados.nome);
    const telefone = texto(dados.telefone);
    const email = texto(dados.email).toLowerCase();

    if (!Number.isInteger(idCliente) || idCliente < 1) {
        throw erroHttp(400, 'Identificador de cliente inválido.');
    }

    if (!nome || nome.length > 120) {
        throw erroHttp(400, 'Informe um nome com até 120 caracteres.');
    }

    if (telefone.length > 40 || email.length > 254 || (email && !emailValido(email))) {
        throw erroHttp(400, 'Confira o telefone e o e-mail informados.');
    }

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
// CADASTRO DE TÉCNICOS — MANTIDO SEPARADO
// =========================================================

app.post('/api/tecnicos/cadastro', rota(async (req, res) => {
    const dados = req.body || {};
    const pessoa = validarPessoa(dados);

    const existente = await buscarUm(
        'SELECT id_tecnico FROM tecnicos WHERE email = ? COLLATE NOCASE',
        [pessoa.email]
    );

    if (existente) {
        throw erroHttp(409, 'Este e-mail já está cadastrado como técnico.');
    }

    const senhaHash = await bcrypt.hash(pessoa.senha, 10);

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

    if (!nome || nome.length > 120 || !email || email.length > 254 || !emailValido(email)) {
        throw erroHttp(400, 'Informe nome e e-mail válidos.');
    }

    if (idadeTexto && (!Number.isInteger(idade) || idade < 18 || idade > 99)) {
        throw erroHttp(400, 'A idade deve estar entre 18 e 99 anos.');
    }

    if (nascimento && !dataValida(nascimento)) {
        throw erroHttp(400, 'Informe uma data de nascimento válida.');
    }

    if (genero && !['Masculino', 'Feminino', 'Prefiro_nao_dizer'].includes(genero)) {
        throw erroHttp(400, 'Selecione um gênero válido.');
    }

    if (nivel && !['JÚNIOR', 'PLENO', 'SÊNIOR'].includes(nivel)) {
        throw erroHttp(400, 'Selecione um nível de conhecimento válido.');
    }

    if (senha && (typeof senha !== 'string' || senha.length < 6 || Buffer.byteLength(senha, 'utf8') > 72)) {
        throw erroHttp(400, 'A senha deve ter pelo menos 6 caracteres e no máximo 72 bytes.');
    }

    if (bio.length > 1000 || horarioContato.length > 30 || (dataDisponivel && !dataValida(dataDisponivel))) {
        throw erroHttp(400, 'Confira a experiência, o horário e a data de disponibilidade.');
    }

    const tecnico = await buscarUm(
        'SELECT id_tecnico, senha_hash FROM tecnicos WHERE id_tecnico = ?',
        [idTecnico]
    );
    if (!tecnico) throw erroHttp(404, 'Técnico não encontrado.');

    const emailExistente = await buscarUm(
        'SELECT id_tecnico FROM tecnicos WHERE email = ? COLLATE NOCASE AND id_tecnico <> ?',
        [email, idTecnico]
    );
    if (emailExistente) throw erroHttp(409, 'Este e-mail já pertence a outro técnico.');

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

app.get('/api/ordens/opcoes', rota(async (req, res) => {
    const tecnicos = await consultar(
        'SELECT id_tecnico, nome FROM tecnicos ORDER BY nome'
    );
    const status = await consultar(
        'SELECT id_status, descricao FROM status_os ORDER BY id_status'
    );

    res.json({ tecnicos, status });
}));

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

app.post('/api/ordens', rota(async (req, res) => {
    const dados = req.body || {};
    const cliente = texto(dados.cliente);
    const equipamento = texto(dados.equipamento);
    const descricao = texto(dados.descricao_problema);
    const dataOs = texto(dados.data_os);
    const nivelEmergencia = texto(dados.nivel_emergencia);
    const idTecnico = Number(dados.id_tecnico);
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
        await executar('BEGIN TRANSACTION');
        transacaoAberta = true;

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

        await executar('COMMIT');
        transacaoAberta = false;

        res.status(201).json({
            mensagem: 'Ordem de serviço criada com sucesso.',
            id_os: resultadoOrdem.id
        });
    } catch (erro) {
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

    if (![1, 2, 3].includes(idStatus)) {
        throw erroHttp(400, 'Selecione um status válido.');
    }

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

app.delete('/api/ordens/:id', rota(async (req, res) => {
    const idOrdem = Number(req.params.id);

    if (!Number.isInteger(idOrdem) || idOrdem < 1) {
        throw erroHttp(400, 'Identificador de OS inválido.');
    }

    const resultado = await executar(
        'DELETE FROM ordens_servico WHERE id_os = ?',
        [idOrdem]
    );

    if (!resultado.alteradas) {
        throw erroHttp(404, 'Ordem de serviço não encontrada.');
    }

    res.json({ mensagem: 'Ordem de serviço excluída com sucesso.' });
}));

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
app.get('/api/ordens/resumo', rota(async (req, res) => {
    // Consulta os totais direto da tabela ordens_servico
    const totalOs = await buscarUm('SELECT COUNT(*) AS total FROM ordens_servico');
    const concluidas = await buscarUm('SELECT COUNT(*) AS total FROM ordens_servico WHERE id_status = 2');
    const emAndamento = await buscarUm('SELECT COUNT(*) AS total FROM ordens_servico WHERE id_status = 1');

    // Calcula atrasadas (OS em andamento ou pendentes cuja data é menor que a data de hoje)
    const hoje = new Date().toISOString().slice(0, 10);
    const atrasadas = await buscarUm(
        `SELECT COUNT(*) AS total FROM ordens_servico
         WHERE id_status IN (1, 3) AND data_os < ?`,
        [hoje]
    );

    res.json({
        total: totalOs.total || 0,
        concluidas: concluidas.total || 0,
        emAndamento: emAndamento.total || 0,
        atrasadas: atrasadas.total || 0
    });
}));

// Mantém a rota de login de técnicos que já estava no projeto.
// A tela de entrada NÃO usa esta rota.
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

// Rota simples para conferir a conexão.
app.get('/api/saude', rota(async (req, res) => {
    await buscarUm('SELECT 1 AS ok');
    res.json({ api: 'ok', banco: 'ok' });
}));

// =========================================================
// ABRIR SEU FRONT-END
// =========================================================

// Libera somente arquivos do front.
// Não expõe banco.db, server.js ou node_modules pelo navegador.
const extensoesPublicas = new Set([
    '.html', '.css', '.js', '.png', '.jpg', '.jpeg',
    '.gif', '.svg', '.webp', '.ico', '.woff', '.woff2', '.ttf'
]);

const arquivosInternos = new Set([
    'server.js', 'api.js', 'database.js', 'consulta.js',
    'estrutura.js', 'validacao.js', 'erros.js', 'clientes.js',
    'tecnicos.js', 'equipamentos.js', 'ordens.js',
    'relatorios.js', 'usuarios.js', 'banco.js', 'pessoas.js',
    'atualizar-banco.js'
]);

app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
    }

    let caminho;

    try {
        caminho = decodeURIComponent(req.path);
    } catch {
        return res.status(400).send('Endereço inválido.');
    }

    const nome = path.basename(caminho).toLowerCase();
    const extensao = path.extname(caminho).toLowerCase();

    if (
        caminho.includes('/node_modules/') ||
        arquivosInternos.has(nome) ||
        (caminho !== '/' && !extensoesPublicas.has(extensao))
    ) {
        return next();
    }

    return express.static(__dirname, {
        dotfiles: 'deny',
        index: 'index.html'
    })(req, res, next);
});

// =========================================================
// TRATAMENTO DE ERROS
// =========================================================

app.use((req, res) => {
    res.status(404).json({
        erro: `Rota não encontrada: ${req.method} ${req.originalUrl}`
    });
});

app.use((erro, req, res, next) => {
    console.error(erro);

    if (erro.type === 'entity.parse.failed') {
        return res.status(400).json({ erro: 'JSON inválido.' });
    }

    if (erro.status) {
        return res.status(erro.status).json({ erro: erro.message });
    }

    if (
        erro.code === 'SQLITE_CONSTRAINT' &&
        /UNIQUE/i.test(erro.message)
    ) {
        return res.status(409).json({
            erro: 'Já existe um cadastro com esses dados.'
        });
    }

    res.status(500).json({
        erro: 'Erro interno. Confira a mensagem no terminal.'
    });
});

// =========================================================
// INICIAR SOMENTE DEPOIS DE PREPARAR O BANCO
// =========================================================

prepararBanco()
    .then(migrarBancoAnterior)
    .then(() => {
        const porta = Number(process.env.PORT) || 3000;
        const servidor = app.listen(porta, '127.0.0.1', () => {
            console.log('==========================================');
            console.log('SITE + BACK-END FUNCIONANDO');
            console.log(`Abra: http://localhost:${porta}/index.html`);
            console.log('Banco:', caminhoBanco);
            console.log('==========================================');
        });

        servidor.on('error', (erro) => {
            console.error('Não foi possível iniciar:', erro.message);
            db.close();
            process.exitCode = 1;
        });
    })
    .catch((erro) => {
        console.error('Erro ao preparar o banco:', erro.message);
        db.close();
        process.exitCode = 1;
    });
