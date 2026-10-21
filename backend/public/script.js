/* =========================================================
   SYNTAX.lab — Edição de registros nas tabelas
   Uso: <table data-editavel="chave-unica"> com botões
   <button class="btn-editar">Editar</button> na coluna "Ações".
   As alterações ficam salvas no navegador (localStorage).
   ========================================================= */

(function () {
    "use strict";

    var STATUS_OPCOES = [
        { texto: "Pendente", classe: "pendente" },
        { texto: "Em andamento", classe: "andamento" },
        { texto: "Concluída", classe: "concluida" }
    ];

    /* Tipo de campo conforme o título da coluna */
    function tipoDoCampo(titulo) {
        var t = titulo.toLowerCase();
        if (t.indexOf("mail") !== -1) return "email";
        if (t.indexOf("telefone") !== -1) return "tel";
        if (t.indexOf("os atribu") !== -1) return "number";
        if (t === "status") return "status";
        if (t === "data") return "data";
        if (t.indexOf("especialidade") !== -1) return "especialidade";
        return "text";
    }

    var ESPECIALIDADES = ["Eletrônica", "Refrigeração", "Mecânica", "Informática", "Elétrica"];

    /* dd/mm/aaaa <-> aaaa-mm-dd */
    function dataParaInput(br) {
        var p = br.split("/");
        return p.length === 3 ? p[2] + "-" + p[1] + "-" + p[0] : "";
    }
    function dataParaBR(iso) {
        var p = iso.split("-");
        return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso;
    }

    function classeDoStatus(texto) {
        for (var i = 0; i < STATUS_OPCOES.length; i++) {
            if (STATUS_OPCOES[i].texto === texto) return STATUS_OPCOES[i].classe;
        }
        return "pendente";
    }

    /* ---------- Leitura e escrita da tabela ---------- */

    function colunas(tabela) {
        var ths = tabela.querySelectorAll("thead th");
        var lista = [];
        ths.forEach(function (th, i) {
            lista.push({ indice: i, titulo: th.textContent.trim() });
        });
        return lista;
    }

    function ehColunaAcoes(titulo) {
        return titulo.toLowerCase().indexOf("ações") !== -1 || titulo.toLowerCase().indexOf("acoes") !== -1;
    }

    function lerLinha(tr) {
        return Array.prototype.map.call(tr.children, function (td) {
            return td.textContent.trim();
        });
    }

    function escreverCelula(td, valor, tipo) {
        if (tipo === "status") {
            var span = document.createElement("span");
            span.className = classeDoStatus(valor);
            span.textContent = valor;
            td.textContent = "";
            td.appendChild(span);
        } else {
            td.textContent = valor;
        }
    }

    /* ---------- Persistência ---------- */

    function chaveStorage(tabela) {
        return "syntaxlab:" + tabela.getAttribute("data-editavel");
    }

    function salvar(tabela) {
        var cols = colunas(tabela);
        var dados = [];
        tabela.querySelectorAll("tbody tr").forEach(function (tr) {
            var linha = lerLinha(tr);
            cols.forEach(function (c) {
                if (ehColunaAcoes(c.titulo)) linha[c.indice] = null;
            });
            dados.push(linha);
        });
        try {
            localStorage.setItem(chaveStorage(tabela), JSON.stringify(dados));
        } catch (e) { /* armazenamento indisponível: segue sem salvar */ }
    }

    function restaurar(tabela) {
        var bruto;
        try { bruto = localStorage.getItem(chaveStorage(tabela)); } catch (e) { return; }
        if (!bruto) return;
        var dados;
        try { dados = JSON.parse(bruto); } catch (e) { return; }
        var cols = colunas(tabela);
        var linhas = tabela.querySelectorAll("tbody tr");
        if (!Array.isArray(dados) || dados.length !== linhas.length) return;

        linhas.forEach(function (tr, i) {
            cols.forEach(function (c) {
                if (ehColunaAcoes(c.titulo)) return;
                var valor = dados[i][c.indice];
                if (valor === null || valor === undefined) return;
                escreverCelula(tr.children[c.indice], valor, tipoDoCampo(c.titulo));
            });
        });
    }

    /* ---------- Janela (modal) de edição ---------- */

    var dialogo, formulario, camposBox, tituloModal, erroBox;
    var linhaAtual = null;
    var tabelaAtual = null;

    function criarDialogo() {
        dialogo = document.createElement("dialog");
        dialogo.className = "modal-editar";
        dialogo.innerHTML =
            '<form method="dialog" class="modal-form" novalidate>' +
            '  <h2 class="modal-titulo">Editar registro</h2>' +
            '  <div class="modal-campos"></div>' +
            '  <p class="modal-erro" role="alert" hidden></p>' +
            '  <div class="form-acoes modal-acoes">' +
            '    <button type="submit" class="botao botao-preenchido" value="salvar">Salvar alterações</button>' +
            '    <button type="button" class="botao botao-contorno" data-cancelar>Cancelar</button>' +
            '  </div>' +
            '</form>';
        document.body.appendChild(dialogo);

        formulario = dialogo.querySelector("form");
        camposBox = dialogo.querySelector(".modal-campos");
        tituloModal = dialogo.querySelector(".modal-titulo");
        erroBox = dialogo.querySelector(".modal-erro");

        dialogo.querySelector("[data-cancelar]").addEventListener("click", function () {
            dialogo.close();
        });

        /* fecha ao clicar fora da caixa */
        dialogo.addEventListener("click", function (ev) {
            if (ev.target === dialogo) dialogo.close();
        });

        formulario.addEventListener("submit", function (ev) {
            ev.preventDefault();
            confirmarEdicao();
        });
    }

    function criarCampo(coluna, valor) {
        var tipo = tipoDoCampo(coluna.titulo);
        var id = "edit-campo-" + coluna.indice;

        var wrap = document.createElement("div");
        wrap.className = "campo";

        var label = document.createElement("label");
        label.setAttribute("for", id);
        label.textContent = coluna.titulo;
        wrap.appendChild(label);

        var input;
        if (tipo === "status") {
            input = document.createElement("select");
            STATUS_OPCOES.forEach(function (o) {
                var opt = document.createElement("option");
                opt.value = o.texto;
                opt.textContent = o.texto;
                if (o.texto === valor) opt.selected = true;
                input.appendChild(opt);
            });
        } else if (tipo === "especialidade") {
            input = document.createElement("select");
            var lista = ESPECIALIDADES.slice();
            if (lista.indexOf(valor) === -1) lista.push(valor);
            lista.forEach(function (e) {
                var opt = document.createElement("option");
                opt.value = e;
                opt.textContent = e;
                if (e === valor) opt.selected = true;
                input.appendChild(opt);
            });
        } else {
            input = document.createElement("input");
            if (tipo === "data") {
                input.type = "date";
                input.value = dataParaInput(valor);
            } else if (tipo === "number") {
                input.type = "number";
                input.min = "0";
                input.value = valor;
            } else {
                input.type = tipo; // text, email, tel
                input.value = valor;
            }
        }
        input.id = id;
        input.name = id;
        input.setAttribute("data-indice", coluna.indice);
        input.setAttribute("data-tipo", tipo);
        wrap.appendChild(input);
        return wrap;
    }

    function abrirEdicao(tabela, tr) {
        if (!dialogo) criarDialogo();
        linhaAtual = tr;
        tabelaAtual = tabela;

        var valores = lerLinha(tr);
        camposBox.innerHTML = "";
        erroBox.hidden = true;

        var cols = colunas(tabela).filter(function (c) { return !ehColunaAcoes(c.titulo); });
        cols.forEach(function (c) {
            camposBox.appendChild(criarCampo(c, valores[c.indice]));
        });

        var nome = valores[0] || "registro";
        var pagina = tabela.getAttribute("data-rotulo") || "registro";
        tituloModal.textContent = "Editar " + pagina + (pagina === "OS" ? " nº " + nome : ": " + nome);

        dialogo.showModal();
        var primeiro = camposBox.querySelector("input, select");
        if (primeiro) primeiro.focus();
    }

    function mostrarErro(msg, campo) {
        erroBox.textContent = msg;
        erroBox.hidden = false;
        if (campo) campo.focus();
    }

    function confirmarEdicao() {
        var campos = camposBox.querySelectorAll("[data-indice]");
        var novos = [];

        for (var i = 0; i < campos.length; i++) {
            var campo = campos[i];
            var tipo = campo.getAttribute("data-tipo");
            var valor = campo.value.trim();

            if (valor === "") {
                var rotulo = campo.previousElementSibling.textContent;
                return mostrarErro('O campo "' + rotulo + '" não pode ficar vazio.', campo);
            }
            if (tipo === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
                return mostrarErro("Informe um e-mail válido.", campo);
            }
            if (tipo === "tel" && valor.replace(/\D/g, "").length < 8) {
                return mostrarErro("Informe um telefone válido (mínimo 8 dígitos).", campo);
            }
            if (tipo === "number" && (isNaN(Number(valor)) || Number(valor) < 0)) {
                return mostrarErro("Informe um número válido.", campo);
            }
            if (tipo === "data") valor = dataParaBR(valor);

            novos.push({ indice: Number(campo.getAttribute("data-indice")), valor: valor, tipo: tipo });
        }

        novos.forEach(function (n) {
            escreverCelula(linhaAtual.children[n.indice], n.valor, n.tipo);
        });

        salvar(tabelaAtual);
        dialogo.close();
        piscar(linhaAtual);
    }

    /* destaque rápido na linha alterada */
    function piscar(tr) {
        tr.classList.add("linha-atualizada");
        setTimeout(function () { tr.classList.remove("linha-atualizada"); }, 1600);
    }

    /* ---------- Inicialização ---------- */

    function iniciar() {
        document.querySelectorAll("table[data-editavel]").forEach(function (tabela) {
            restaurar(tabela);

            tabela.addEventListener("click", function (ev) {
                var botao = ev.target.closest(".btn-editar");
                if (!botao) return;
                var tr = botao.closest("tr");
                if (tr) abrirEdicao(tabela, tr);
            });
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar);
    } else {
        iniciar();
    }
})();
