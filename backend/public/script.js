(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var ler = function (k, p) { try { return JSON.parse(localStorage.getItem(k)) || p; } catch (e) { return p; } };
  var gravar = function (k, v) { localStorage.setItem(k, JSON.stringify(v)); };
  var esc = function (t) { var d = document.createElement("div"); d.textContent = t == null ? "" : t; return d.innerHTML; };
  var agora = function () { return new Date().toLocaleString("pt-BR"); };
  var STATUS = ["Aberta", "Em andamento", "Concluída", "Cancelada"];
  var classe = { "Aberta": "aberta", "Em andamento": "andamento", "Concluída": "concluida", "Cancelada": "cancelada" };
  var badge = function (s) { return '<span class="badge ' + classe[s] + '">' + s + "</span>"; };
  var erro = function (m) { var e = $(".mensagem-erro"); if (e) e.textContent = m || ""; };
  var sucesso = function (m) { var e = $(".mensagem-sucesso"); if (e) e.textContent = m || ""; };

  /* ---------- Sessão ---------- */
  var usuarios = function () { return ler("usuarios", []); };
  var sessao = function () { return localStorage.getItem("sessao") || sessionStorage.getItem("sessao"); };
  var usuarioAtual = function () { return usuarios().filter(function (u) { return u.email === sessao(); })[0]; };
  var sair = function () { localStorage.removeItem("sessao"); sessionStorage.removeItem("sessao"); location.href = "index.html"; };
  var pagina = document.body.dataset.page;

  if ((pagina || $("#painel")) && !usuarioAtual()) { location.href = "index.html"; return; }
  if ($("#form-login") && usuarioAtual()) { location.href = "dashboard.html"; return; }

  /* ---------- Telas de acesso (estrutura original mantida) ---------- */
  var f = $("#form-login");
  if (f) f.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var email = $("#email").value.trim().toLowerCase(), senha = $("#senha").value;
    var u = usuarios().filter(function (x) { return x.email === email && x.senha === senha; })[0];
    if (!u) return erro("E-mail ou senha incorretos.");
    (f.lembrar.checked ? localStorage : sessionStorage).setItem("sessao", email);
    location.href = "dashboard.html";
  });

  f = $("#form-cadastro");
  if (f) f.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var email = $("#email").value.trim().toLowerCase(), lista = usuarios();
    if ($("#senha").value !== $("#confirmar-senha").value) return erro("As senhas não coincidem.");
    if (lista.some(function (u) { return u.email === email; })) return erro("Este e-mail já está cadastrado.");
    lista.push({ nome: $("#nome").value.trim(), email: email, senha: $("#senha").value });
    gravar("usuarios", lista);
    sessionStorage.setItem("sessao", email);
    location.href = "dashboard.html";
  });

  f = $("#form-recuperar");
  if (f) f.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var email = $("#email").value.trim().toLowerCase();
    erro(""); sucesso("");
    if (usuarios().some(function (u) { return u.email === email; })) sessionStorage.setItem("reset", email);
    sucesso("Se o e-mail estiver cadastrado, você receberá o link. Redirecionando...");
    setTimeout(function () { location.href = "redefinir-senha.html"; }, 1800);
  });

  f = $("#form-redefinir");
  if (f) f.addEventListener("submit", function (ev) {
    ev.preventDefault();
    erro(""); sucesso("");
    var email = sessionStorage.getItem("reset"), lista = usuarios();
    if ($("#senha").value !== $("#confirmar-senha").value) return erro("As senhas não coincidem.");
    var u = lista.filter(function (x) { return x.email === email; })[0];
    if (!u) return erro("Solicite um novo link de recuperação.");
    u.senha = $("#senha").value; gravar("usuarios", lista); sessionStorage.removeItem("reset");
    sucesso("Senha alterada! Redirecionando para o login...");
    setTimeout(function () { location.href = "index.html"; }, 1500);
  });

  if ($("#painel")) {
    var u0 = usuarioAtual();
    $("#boas-vindas").textContent = "Olá, " + u0.nome.split(" ")[0] + "!";
    $("#email-usuario").textContent = u0.email;
    $("#btn-sair").addEventListener("click", sair);
  }

  if (!pagina) return;

  /* ---------- Dados do sistema ---------- */
  var tecnicos = function () { return ler("tecnicos", []); };
  var ordens = function () { return ler("ordens", []); };
  var nomeTec = function (id) { var t = tecnicos().filter(function (x) { return x.id === id; })[0]; return t ? t.nome : "Sem técnico"; };
  var opcoes = function (arr, sel) { return arr.map(function (o) { return '<option value="' + esc(o.v) + '"' + (o.v === sel ? " selected" : "") + ">" + esc(o.t) + "</option>"; }).join(""); };
  var opcoesTec = function (sel, todos) {
    var base = [{ v: "", t: todos ? "Todos" : "Sem técnico" }];
    return opcoes(base.concat(tecnicos().map(function (t) { return { v: t.id, t: t.nome }; })), sel);
  };
  var vazio = function (msg, cols) { return '<tr><td colspan="' + cols + '" class="vazio">' + msg + "</td></tr>"; };

  /* ---------- Menu ---------- */
  var menu = [["dashboard", "Dashboard"], ["consulta", "Consultar OS"], ["cadastro", "Nova OS"], ["tecnicos", "Técnicos"]];
  var hrefs = { dashboard: "dashboard.html", consulta: "os-consulta.html", cadastro: "os-cadastro.html", tecnicos: "tecnicos.html" };
  var ativo = pagina === "detalhes" ? "consulta" : pagina;
  var bar = document.createElement("header");
  bar.className = "topbar";
  bar.innerHTML = '<span class="marca">OS Control</span><nav>' + menu.map(function (m) {
    return '<a href="' + hrefs[m[0]] + '"' + (m[0] === ativo ? ' class="ativo"' : "") + ">" + m[1] + "</a>";
  }).join("") + '</nav><button type="button" class="sair sec" id="sair">Sair</button>';
  document.body.insertBefore(bar, document.body.firstChild);
  $("#sair").addEventListener("click", sair);

  /* ---------- Dashboard ---------- */
  if (pagina === "dashboard") {
    var os = ordens();
    var conta = function (s) { return os.filter(function (o) { return o.status === s; }).length; };
    $("#stats").innerHTML = [["Total de OS", os.length, "destaque"], ["Abertas", conta("Aberta"), ""], ["Em andamento", conta("Em andamento"), ""], ["Concluídas", conta("Concluída"), ""]]
      .map(function (s) { return '<div class="card stat ' + s[2] + '"><strong>' + s[1] + "</strong><span>" + s[0] + "</span></div>"; }).join("");
    $("#recentes").innerHTML = os.length ? os.slice(-5).reverse().map(function (o) {
      return '<tr><td><a href="os-detalhes.html?id=' + o.id + '">#' + o.id + "</a></td><td>" + esc(o.cliente) + "</td><td>" + esc(o.equipamento) + "</td><td>" + esc(nomeTec(o.tecnico)) + "</td><td>" + badge(o.status) + "</td></tr>";
    }).join("") : vazio("Nenhuma OS cadastrada. Clique em Nova OS para começar.", 5);
    var tecs = tecnicos();
    $("#carga").innerHTML = tecs.length ? '<div class="tabela-wrap"><table><tbody>' + tecs.map(function (t) {
      var n = os.filter(function (o) { return o.tecnico === t.id && (o.status === "Aberta" || o.status === "Em andamento"); }).length;
      return "<tr><td>" + esc(t.nome) + "</td><td>" + esc(t.especialidade) + "</td><td>" + n + " OS em aberto</td></tr>";
    }).join("") + "</tbody></table></div>" : '<p class="vazio">Nenhum técnico cadastrado. <a href="tecnicos.html" style="color:#fff">Cadastrar técnico</a></p>';
  }

  /* ---------- Cadastro de OS ---------- */
  if (pagina === "cadastro") {
    $("#tecnico").innerHTML = opcoesTec("");
    $("#form-os").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var lista = ordens(), id = ler("proximaOS", 1);
      lista.push({
        id: id, cliente: $("#cliente").value.trim(), telefone: $("#telefone").value.trim(), equipamento: $("#equipamento").value.trim(),
        problema: $("#problema").value.trim(), prioridade: $("#prioridade").value, tecnico: $("#tecnico").value, previsao: $("#previsao").value,
        status: "Aberta", criada: agora(), historico: [{ data: agora(), texto: "OS aberta por " + usuarioAtual().nome }]
      });
      gravar("ordens", lista); gravar("proximaOS", id + 1);
      location.href = "os-detalhes.html?id=" + id;
    });
  }

  /* ---------- Consulta de OS ---------- */
  if (pagina === "consulta") {
    $("#f-status").innerHTML = opcoes([{ v: "", t: "Todos" }].concat(STATUS.map(function (s) { return { v: s, t: s }; })), "");
    $("#f-tecnico").innerHTML = opcoesTec("", true);
    var filtrar = function () {
      var q = $("#busca").value.trim().toLowerCase(), st = $("#f-status").value, tc = $("#f-tecnico").value;
      var r = ordens().filter(function (o) {
        return (!st || o.status === st) && (!tc || o.tecnico === tc) &&
          (!q || ("#" + o.id + " " + o.cliente + " " + o.equipamento).toLowerCase().indexOf(q.replace(/^#/, "")) > -1);
      }).reverse();
      $("#lista").innerHTML = r.length ? r.map(function (o) {
        return "<tr><td>#" + o.id + "</td><td>" + esc(o.cliente) + "</td><td>" + esc(o.equipamento) + "</td><td>" + o.prioridade + "</td><td>" +
          esc(nomeTec(o.tecnico)) + "</td><td>" + badge(o.status) + '</td><td><a class="btn sm" href="os-detalhes.html?id=' + o.id + '">Detalhes</a></td></tr>';
      }).join("") : vazio("Nenhuma OS encontrada com esses filtros.", 7);
    };
    ["#busca", "#f-status", "#f-tecnico"].forEach(function (s) { $(s).addEventListener("input", filtrar); });
    filtrar();
  }

  /* ---------- Detalhes da OS ---------- */
  if (pagina === "detalhes") {
    var id = Number(new URLSearchParams(location.search).get("id"));
    var o = ordens().filter(function (x) { return x.id === id; })[0];
    if (!o) { $("#dados").innerHTML = '<p class="vazio">OS não encontrada. Volte à consulta e escolha uma OS.</p>'; document.querySelectorAll(".card")[1].remove(); document.querySelectorAll(".card")[1].remove(); return; }
    var campo = function (t, v) { return "<div><dt>" + t + "</dt><dd>" + (v ? v : "—") + "</dd></div>"; };
    var desenhar = function () {
      $("#titulo").textContent = "OS #" + o.id;
      $("#dados").innerHTML = '<dl class="detalhes">' + campo("Status", badge(o.status)) + campo("Prioridade", o.prioridade) + campo("Cliente", esc(o.cliente)) +
        campo("Telefone", esc(o.telefone)) + campo("Equipamento", esc(o.equipamento)) + campo("Técnico", esc(nomeTec(o.tecnico))) +
        campo("Aberta em", o.criada) + campo("Previsão", o.previsao ? o.previsao.split("-").reverse().join("/") : "") + campo("Problema relatado", esc(o.problema)) + "</dl>";
      $("#historico").innerHTML = o.historico.slice().reverse().map(function (h) { return "<li><small>" + h.data + "</small><br>" + esc(h.texto) + "</li>"; }).join("");
    };
    $("#d-status").innerHTML = opcoes(STATUS.map(function (s) { return { v: s, t: s }; }), o.status);
    $("#d-tecnico").innerHTML = opcoesTec(o.tecnico);
    desenhar();
    $("#btn-atualizar").addEventListener("click", function () {
      var lista = ordens(), atual = lista.filter(function (x) { return x.id === id; })[0], obs = $("#d-obs").value.trim(), log = [];
      if ($("#d-status").value !== atual.status) log.push("Status alterado para " + $("#d-status").value);
      if ($("#d-tecnico").value !== atual.tecnico) log.push("Técnico alterado para " + nomeTec($("#d-tecnico").value));
      if (obs) log.push("Observação: " + obs);
      if (!log.length) return;
      atual.status = $("#d-status").value; atual.tecnico = $("#d-tecnico").value;
      log.forEach(function (t) { atual.historico.push({ data: agora(), texto: t }); });
      gravar("ordens", lista); o = atual; $("#d-obs").value = ""; desenhar();
    });
    $("#btn-excluir").addEventListener("click", function () {
      if (!confirm("Excluir a OS #" + id + "? Esta ação não pode ser desfeita.")) return;
      gravar("ordens", ordens().filter(function (x) { return x.id !== id; }));
      location.href = "os-consulta.html";
    });
  }

  /* ---------- Técnicos ---------- */
  if (pagina === "tecnicos") {
    var mostrar = function () {
      var os2 = ordens(), t = tecnicos();
      $("#lista-tecnicos").innerHTML = t.length ? t.map(function (x) {
        var n = os2.filter(function (o) { return o.tecnico === x.id && (o.status === "Aberta" || o.status === "Em andamento"); }).length;
        return '<article class="card"><h2>' + esc(x.nome) + "</h2><small>" + esc(x.especialidade) + "</small><small>" + esc(x.telefone || "Sem telefone") + "</small><small>" + n +
          ' OS em aberto</small><div class="acoes"><button type="button" class="sec sm" data-rm="' + x.id + '">Remover</button></div></article>';
      }).join("") : '<p class="vazio">Nenhum técnico cadastrado ainda.</p>';
    };
    $("#form-tecnico").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var lista = tecnicos();
      lista.push({ id: "t" + Date.now(), nome: $("#t-nome").value.trim(), especialidade: $("#t-esp").value.trim(), telefone: $("#t-tel").value.trim() });
      gravar("tecnicos", lista); ev.target.reset(); mostrar();
    });
    $("#lista-tecnicos").addEventListener("click", function (ev) {
      var id2 = ev.target.dataset.rm;
      if (!id2) return;
      if (ordens().some(function (o) { return o.tecnico === id2 && (o.status === "Aberta" || o.status === "Em andamento"); })) return erro("Este técnico tem OS em aberto. Reatribua as OS antes de remover.");
      gravar("tecnicos", tecnicos().filter(function (x) { return x.id !== id2; })); erro(""); mostrar();
    });
    mostrar();
  }
})();
