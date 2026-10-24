// Atualiza a tabela de técnicos sem apagar os registros existentes.
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Abre somente um banco existente, evitando criar outro por engano.
const caminho = path.join(__dirname, '..', 'banco.db');

const db = new sqlite3.Database(
    caminho,
    sqlite3.OPEN_READWRITE,
    async (erro) => {
        if (erro) {
            console.error('Não foi possível abrir o banco:', erro.message);
            return;
        }

        // Executa comandos SQL usando await.
        function executar(sql) {
            return new Promise((resolve, reject) => {
                db.run(sql, (erro) => {
                    if (erro) reject(erro);
                    else resolve();
                });
            });
        }

        // Consulta a estrutura atual da tabela.
        function consultar(sql) {
            return new Promise((resolve, reject) => {
                db.all(sql, (erro, linhas) => {
                    if (erro) reject(erro);
                    else resolve(linhas);
                });
            });
        }

        let transacaoAberta = false;

        try {
            await executar('BEGIN TRANSACTION');
            transacaoAberta = true;

            const estrutura = await consultar('PRAGMA table_info(tecnicos)');

            if (estrutura.length === 0) {
                throw new Error('A tabela tecnicos não existe neste banco.');
            }

            const existentes = new Set(
                estrutura.map((coluna) => coluna.name)
            );

            // Os nomes abaixo são fixos, definidos pelo nosso código.
            const campos = {
                email: 'TEXT',
                senha_hash: 'TEXT',
                idade: 'INTEGER',
                data_nascimento: 'TEXT',
                genero: 'TEXT',
                nivel: 'TEXT',
                bio: 'TEXT',
                horario_contato: 'TEXT',
                data_disponivel: 'TEXT'
            };

            // Adiciona apenas as colunas que ainda não existem.
            for (const [nome, tipo] of Object.entries(campos)) {
                if (!existentes.has(nome)) {
                    await executar(
                        `ALTER TABLE tecnicos ADD COLUMN ${nome} ${tipo}`
                    );

                    console.log(`Campo adicionado: ${nome}`);
                }
            }

            // Impede cadastros novos com o mesmo e-mail,
            // desconsiderando diferenças entre maiúsculas e minúsculas.
            await executar(`
                CREATE UNIQUE INDEX IF NOT EXISTS
                idx_tecnicos_email_unico
                ON tecnicos (email COLLATE NOCASE)
            `);

            await executar('COMMIT');
            transacaoAberta = false;

            console.log('Banco atualizado com sucesso!');
            console.log('Agora execute: node server.js');
        } catch (erro) {
            if (transacaoAberta) {
                try {
                    await executar('ROLLBACK');
                } catch (erroRollback) {
                    console.error('Erro ao desfazer:', erroRollback.message);
                }
            }

            console.error('Não foi possível atualizar:', erro.message);
            process.exitCode = 1;
        } finally {
            db.close();
        }
    }
);