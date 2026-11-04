(function () {
    'use strict';

    const cargos = [
        'Visitante',
        'Desenvolvedor / Equipe Syntax Lab',
        'Cliente'
    ];
    const lista = document.getElementById('listaUsuarios');
    const feedback = document.getElementById('feedbackUsuarios');
    const total = document.getElementById('totalUsuarios');
    let idAdministrador;

    async function requisicao(url, opcoes = {}) {
        const resposta = await fetch(url, {
            ...opcoes,
            headers: {
                ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}),
                ...opcoes.headers
            }
        });
        const resultado = await resposta.json();

        if (resposta.status === 401) {
            localStorage.removeItem('syntaxlab_usuario');
            window.location.href = 'index.html';
            throw new Error('Faça login para continuar.');
        }
        if (!resposta.ok) throw new Error(resultado.erro || 'Não foi possível concluir a operação.');
        return resultado;
    }

    function campoTexto(valor, rotulo, tipo = 'text') {
        const campo = document.createElement('input');
        campo.type = tipo;
        campo.value = valor || '';
        campo.setAttribute('aria-label', rotulo);
        campo.maxLength = tipo === 'email' ? 254 : 120;
        campo.required = true;
        return campo;
    }

    function criarLinha(usuario) {
        const linha = document.createElement('tr');
        const celulaNome = document.createElement('td');
        const celulaEmail = document.createElement('td');
        const celulaCargo = document.createElement('td');
        const celulaAcoes = document.createElement('td');
        const contaPrincipal = usuario.cargo === 'Administrador';
        const nome = campoTexto(usuario.nome, `Nome de ${usuario.email}`);
        const email = campoTexto(usuario.email, `E-mail de ${usuario.nome}`, 'email');
        const cargo = document.createElement('select');
        const acoes = document.createElement('div');
        const salvar = document.createElement('button');
        const excluir = document.createElement('button');

        if (contaPrincipal) {
            const opcaoAdmin = document.createElement('option');
            opcaoAdmin.value = 'Administrador';
            opcaoAdmin.textContent = 'Administrador';
            opcaoAdmin.selected = true;
            cargo.append(opcaoAdmin);
        }

        for (const opcaoCargo of cargos) {
            const opcao = document.createElement('option');
            opcao.value = opcaoCargo;
            opcao.textContent = opcaoCargo;
            opcao.selected = usuario.cargo === opcaoCargo;
            cargo.append(opcao);
        }

        nome.disabled = contaPrincipal;
        email.disabled = contaPrincipal;
        cargo.disabled = contaPrincipal;
        cargo.setAttribute('aria-label', `Cargo de ${usuario.nome}`);
        salvar.type = 'button';
        salvar.textContent = 'Salvar';
        salvar.disabled = contaPrincipal;
        excluir.type = 'button';
        excluir.className = 'admin-excluir';
        excluir.textContent = 'Excluir';
        excluir.disabled = contaPrincipal || usuario.id_usuario === idAdministrador;
        acoes.className = 'admin-acoes';

        salvar.addEventListener('click', async () => {
            feedback.textContent = '';
            salvar.disabled = true;
            try {
                await requisicao(`/api/usuarios/${usuario.id_usuario}`, {
                    method: 'PUT',
                    body: JSON.stringify({ nome: nome.value, email: email.value, cargo: cargo.value })
                });
                feedback.textContent = 'Cadastro atualizado.';
                await carregarUsuarios();
            } catch (erro) {
                feedback.textContent = erro.message;
            } finally {
                salvar.disabled = contaPrincipal;
            }
        });

        excluir.addEventListener('click', async () => {
            if (!window.confirm(`Excluir o cadastro de ${usuario.nome}?`)) return;
            feedback.textContent = '';
            excluir.disabled = true;
            try {
                await requisicao(`/api/usuarios/${usuario.id_usuario}`, { method: 'DELETE' });
                feedback.textContent = 'Usuário excluído.';
                await carregarUsuarios();
            } catch (erro) {
                feedback.textContent = erro.message;
                excluir.disabled = contaPrincipal || usuario.id_usuario === idAdministrador;
            }
        });

        celulaNome.append(nome);
        celulaEmail.append(email);
        celulaCargo.append(cargo);
        acoes.append(salvar, excluir);
        celulaAcoes.append(acoes);
        linha.append(celulaNome, celulaEmail, celulaCargo, celulaAcoes);
        return linha;
    }

    async function carregarUsuarios() {
        const usuarios = await requisicao('/api/usuarios');
        lista.replaceChildren(...usuarios.map(criarLinha));
        total.textContent = `${usuarios.length} ${usuarios.length === 1 ? 'usuário' : 'usuários'}`;
    }

    async function iniciar() {
        try {
            const resultado = await requisicao('/api/usuarios/me');
            if (resultado.usuario.cargo !== 'Administrador') {
                window.location.href = 'inicio.html';
                return;
            }
            idAdministrador = resultado.usuario.id_usuario;
            await carregarUsuarios();
        } catch (erro) {
            feedback.textContent = erro.message;
        }
    }

    iniciar();
})();