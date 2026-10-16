const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const db = require("./db");

const app = express();
app.use(express.json());
app.use(session({ secret: "troque-este-segredo", resave: false, saveUninitialized: false }));
app.use(express.static("public"));

const exigeLogin = (req, res, next) =>
  req.session.userId ? next() : res.status(401).json({ erro: "Não autenticado" });

// --- Autenticação ---
app.post("/api/cadastro", (req, res) => {
  const { nome, email, senha } = req.body;
  try {
    const r = db.prepare("INSERT INTO usuarios (nome,email,senha_hash) VALUES (?,?,?)")
      .run(nome, email.toLowerCase(), bcrypt.hashSync(senha, 10));
    req.session.userId = r.lastInsertRowid;
    res.json({ ok: true });
  } catch (e) {
    res.status(409).json({ erro: "Este e-mail já está cadastrado." });
  }
});

app.post("/api/login", (req, res) => {
  const u = db.prepare("SELECT * FROM usuarios WHERE email = ?").get(req.body.email.toLowerCase());
  if (!u || !bcrypt.compareSync(req.body.senha, u.senha_hash))
    return res.status(401).json({ erro: "E-mail ou senha incorretos." });
  req.session.userId = u.id;
  res.json({ ok: true, nome: u.nome });
});

app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));

// --- Ordens de serviço ---
app.get("/api/ordens", exigeLogin, (req, res) => {
  const { q = "", status = "", tecnico = "" } = req.query;
  res.json(db.prepare(`
    SELECT o.*, t.nome AS tecnico_nome FROM ordens o
    LEFT JOIN tecnicos t ON t.id = o.tecnico_id
    WHERE (o.cliente LIKE @q OR o.equipamento LIKE @q OR CAST(o.id AS TEXT) = @id)
      AND (@status = '' OR o.status = @status)
      AND (@tecnico = '' OR o.tecnico_id = @tecnico)
    ORDER BY o.id DESC`).all({ q: `%${q}%`, id: q.replace("#", ""), status, tecnico }));
});

app.post("/api/ordens", exigeLogin, (req, res) => {
  const o = req.body;
  const r = db.prepare(`INSERT INTO ordens (cliente,telefone,equipamento,problema,prioridade,previsao,tecnico_id)
    VALUES (?,?,?,?,?,?,?)`).run(o.cliente, o.telefone, o.equipamento, o.problema, o.prioridade, o.previsao || null, o.tecnico || null);
  db.prepare("INSERT INTO historico (os_id,texto) VALUES (?,?)").run(r.lastInsertRowid, "OS aberta");
  res.json({ id: r.lastInsertRowid });
});

app.get("/api/ordens/:id", exigeLogin, (req, res) => {
  const os = db.prepare("SELECT * FROM ordens WHERE id = ?").get(req.params.id);
  if (!os) return res.status(404).json({ erro: "OS não encontrada" });
  os.historico = db.prepare("SELECT * FROM historico WHERE os_id = ? ORDER BY id DESC").all(os.id);
  res.json(os);
});

app.put("/api/ordens/:id", exigeLogin, (req, res) => {
  const { status, tecnico, obs } = req.body;
  db.prepare("UPDATE ordens SET status = ?, tecnico_id = ? WHERE id = ?").run(status, tecnico || null, req.params.id);
  if (obs) db.prepare("INSERT INTO historico (os_id,texto) VALUES (?,?)").run(req.params.id, "Observação: " + obs);
  res.json({ ok: true });
});

app.delete("/api/ordens/:id", exigeLogin, (req, res) => {
  db.prepare("DELETE FROM ordens WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.listen(3000, () => console.log("http://localhost:3000"));