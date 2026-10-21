const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Conexão com o SQLite
const db = new sqlite3.Database('./database.db');

db.serialize(async () => {
  // 1. Tabela de Usuários com campo 'role'
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'usuario'
    )
  `);

  // 2. Tabela de Tickets
  db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Aberto',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 3. Admin Padrão Automático
  const adminEmail = 'admin@sistema.com';
  db.get(`SELECT * FROM users WHERE email = ?`, [adminEmail], async (err, row) => {
    if (!row) {
      const defaultPassword = await bcrypt.hash('admin123', 10);
      db.run(
        `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
        ['Administrador Principal', adminEmail, defaultPassword, 'admin'],
        (err) => {
          if (!err) {
            console.log('\n=======================================');
            console.log('ADMIN PADRÃO CRIADO COM SUCESSO!');
            console.log('E-mail: admin@sistema.com | Senha: admin123');
            console.log('=======================================\n');
          }
        }
      );
    }
  });
});

// ----------------------------------------------------
// ROTAS DE AUTENTICAÇÃO
// ----------------------------------------------------

// Cadastro Público (Cria apenas contas do tipo 'usuario')
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'usuario')`,
      [name, email, hashedPassword],
      function (err) {
        if (err) {
          console.error('Erro no SQLite:', err.message);
          
          // Trata especificamente o erro de chave duplicada (e-mail já cadastrado)
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Este e-mail já está cadastrado no sistema.' });
          }
          
          return res.status(500).json({ error: 'Erro ao cadastrar usuário no banco de dados.' });
        }
        res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// Login Comum (Usuário e Técnico)
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    res.json({
      message: 'Login realizado com sucesso!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  });
});

// Login Exclusivo de Admin (Acionado pelo modal do Cadeado)
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;

  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado: você não possui permissão de Administrador.' });
    }

    res.json({
      message: 'Acesso administrativo concedido!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  });
});

// ----------------------------------------------------
// ROTAS DE GERENCIAMENTO DE USUÁRIOS (ADMIN)
// ----------------------------------------------------

app.get('/api/admin/users', (req, res) => {
  db.all(`SELECT id, name, email, role FROM users`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar usuários.' });
    res.json(rows);
  });
});

app.put('/api/admin/users/:id/role', (req, res) => {
  const { role } = req.body;
  const { id } = req.params;

  if (!['usuario', 'tecnico', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Função inválida.' });
  }

  db.run(`UPDATE users SET role = ? WHERE id = ?`, [role, id], function (err) {
    if (err) return res.status(500).json({ error: 'Erro ao atualizar função.' });
    res.json({ message: 'Função atualizada com sucesso!' });
  });
});

app.delete('/api/admin/users/:id', (req, res) => {
  const { id } = req.params;

  db.run(`DELETE FROM users WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: 'Erro ao excluir usuário.' });
    res.json({ message: 'Usuário removido com sucesso!' });
  });
});

// ----------------------------------------------------
// ROTAS DE TICKETS
// ----------------------------------------------------

app.post('/api/tickets', (req, res) => {
  const { userId, title, description } = req.body;

  if (!userId || !title || !description) {
    return res.status(400).json({ error: 'Preencha todos os campos do ticket.' });
  }

  db.run(
    `INSERT INTO tickets (user_id, title, description) VALUES (?, ?, ?)`,
    [userId, title, description],
    function (err) {
      if (err) return res.status(500).json({ error: 'Erro ao criar ticket.' });
      res.status(201).json({ message: 'Ticket aberto com sucesso!' });
    }
  );
});

app.get('/api/tickets/user/:userId', (req, res) => {
  const { userId } = req.params;

  db.all(
    `SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Erro ao buscar tickets.' });
      res.json(rows);
    }
  );
});

app.get('/api/tickets/all', (req, res) => {
  const query = `
    SELECT tickets.*, users.name as user_name, users.email as user_email 
    FROM tickets 
    JOIN users ON tickets.user_id = users.id 
    ORDER BY tickets.created_at DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar chamados.' });
    res.json(rows);
  });
});

app.put('/api/tickets/:id/status', (req, res) => {
  const { status } = req.body;
  const { id } = req.params;

  db.run(`UPDATE tickets SET status = ? WHERE id = ?`, [status, id], function (err) {
    if (err) return res.status(500).json({ error: 'Erro ao atualizar ticket.' });
    res.json({ message: 'Status do ticket atualizado com sucesso!' });
  });
});

app.listen(3000, () => {
  console.log('Servidor rodando em http://localhost:3000');
});