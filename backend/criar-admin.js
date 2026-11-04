const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const senha = process.env.SYNTAXLAB_ADMIN_PASSWORD;
const email = 'admin@syntaxlab.com.br';
const nome = 'Admin Syntax Lab';

if (typeof senha !== 'string' || senha.length < 6 || Buffer.byteLength(senha, 'utf8') > 72) {
    console.error('Defina SYNTAXLAB_ADMIN_PASSWORD com uma senha de 6 a 72 bytes.');
    process.exit(1);
}

const db = new sqlite3.Database(path.join(__dirname, '..', 'banco.db'));

function executar(sql, parametros = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, parametros, function (erro) {
            if (erro) reject(erro);
            else resolve({ id: this.lastID });
        });
    });
}

function buscarUm(sql, parametros = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, parametros, (erro, linha) => {
            if (erro) reject(erro);
            else resolve(linha);
        });
    });
}

async function criarAdmin() {
    const colunas = await new Promise((resolve, reject) => {
        db.all('PRAGMA table_info(usuarios)', (erro, linhas) => {
            if (erro) reject(erro);
            else resolve(linhas.map((linha) => linha.name));
        });
    });

    if (!colunas.includes('cargo')) {
        await executar("ALTER TABLE usuarios ADD COLUMN cargo TEXT NOT NULL DEFAULT 'Cliente'");
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const existente = await buscarUm(
        'SELECT id_usuario FROM usuarios WHERE email = ? COLLATE NOCASE',
        [email]
    );

    if (existente) {
        await executar(
            "UPDATE usuarios SET nome = ?, senha_hash = ?, cargo = 'Administrador' WHERE id_usuario = ?",
            [nome, senhaHash, existente.id_usuario]
        );
    } else {
        await executar(
            "INSERT INTO usuarios (nome, email, senha_hash, cargo) VALUES (?, ?, ?, 'Administrador')",
            [nome, email, senhaHash]
        );
    }

    console.log('Conta administradora configurada.');
}

criarAdmin()
    .catch((erro) => {
        console.error('Não foi possível configurar a conta administradora:', erro.message);
        process.exitCode = 1;
    })
    .finally(() => db.close());