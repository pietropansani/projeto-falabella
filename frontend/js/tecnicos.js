// Lógica da página tecnicos.html (Gerenciamento e Cadastro de Técnicos)

document.addEventListener('DOMContentLoaded', () => {
    const listaTecnicos = document.getElementById('listaTecnicos');
    const feedbackTecnicos = document.getElementById('feedbackTecnicos');
    const botaoAbrirCadastroTecnico = document.getElementById('abrirModalCadastroTecnico');
    const modalCadastroTecnico = document.getElementById('modalCadastroTecnico');
    const formCadastroTecnico = document.getElementById('formCadastroTecnico');
    const modalEditarTecnico = document.getElementById('modalEditarTecnico');
    const formEditarTecnico = document.getElementById('formEditarTecnico');
    let tecnicoEmEdicao = null;
    let botaoEdicaoAtivo = null;

    function adicionarCelula(linha, valor) {
        const celula = document.createElement('td');
        celula.textContent = valor === null || valor === undefined || valor === '' ? '-' : String(valor);
        linha.append(celula);
    }

    async function cadastrarTecnico(evento) {
        evento.preventDefault();
        const botaoEnviar = formCadastroTecnico.querySelector('[type="submit"]');
        const erro = document.getElementById('erroCadastroTecnico');
        if (erro) erro.textContent = '';
        if (botaoEnviar) botaoEnviar.disabled = true;

        try {
            const resposta = await fetch('/api/tecnicos/cadastro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.fromEntries(new FormData(formCadastroTecnico)))
            });
            const resultado = await resposta.json();
            if (!resposta.ok) {
                throw new Error(resultado.erro || 'Não foi possível cadastrar o técnico.');
            }

            modalCadastroTecnico.close();
            formCadastroTecnico.reset();
            await carregarTecnicos();
            if (feedbackTecnicos) feedbackTecnicos.textContent = 'Técnico cadastrado com sucesso.';
        } catch (erroCadastro) {
            if (erro) erro.textContent = erroCadastro.message;
        } finally {
            if (botaoEnviar) botaoEnviar.disabled = false;
        }
    }

    async function carregarTecnicos() {
        if (!listaTecnicos) return;

        try {
            const resposta = await fetch('/api/tecnicos');
            const tecnicos = await resposta.json();
            if (!resposta.ok) throw new Error(tecnicos.erro || 'Não foi possível carregar os técnicos.');

            listaTecnicos.replaceChildren();
            if (!tecnicos.length) {
                const linha = document.createElement('tr');
                const celula = document.createElement('td');
                celula.colSpan = 6;
                celula.textContent = 'Nenhum técnico cadastrado.';
                linha.append(celula);
                listaTecnicos.append(linha);
                return;
            }

            tecnicos.forEach((tecnico) => {
                const linha = document.createElement('tr');
                adicionarCelula(linha, tecnico.nome);
                adicionarCelula(linha, tecnico.email);
                adicionarCelula(linha, tecnico.nivel);
                adicionarCelula(linha, tecnico.horario_contato);
                adicionarCelula(linha, tecnico.os_atribuidas);

                const celulaAcoes = document.createElement('td');
                const botaoEditar = document.createElement('button');
                botaoEditar.type = 'button';
                botaoEditar.className = 'botao-menu';
                botaoEditar.textContent = 'Editar';
                botaoEditar.addEventListener('click', () => abrirEdicaoTecnico(tecnico, botaoEditar));
                celulaAcoes.append(botaoEditar);
                linha.append(celulaAcoes);
                listaTecnicos.append(linha);
            });
        } catch (erro) {
            if (feedbackTecnicos) feedbackTecnicos.textContent = erro.message;
        }
    }

    function abrirEdicaoTecnico(tecnico, botao) {
        tecnicoEmEdicao = tecnico.id_tecnico;
        botaoEdicaoAtivo = botao;
        const identTec = document.getElementById('identificacaoTecnico');
        const erroEdit = document.getElementById('erroEditarTecnico');
        if (identTec) identTec.textContent = tecnico.nome;
        if (erroEdit) erroEdit.textContent = '';

        document.getElementById('tecnicoNome').value = tecnico.nome || '';
        document.getElementById('tecnicoEmail').value = tecnico.email || '';
        document.getElementById('tecnicoSenha').value = '';
        document.getElementById('tecnicoIdade').value = tecnico.idade || '';
        document.getElementById('tecnicoNascimento').value = tecnico.data_nascimento || '';
        document.getElementById('tecnicoGenero').value = tecnico.genero || '';
        document.getElementById('tecnicoNivel').value = tecnico.nivel || '';
        document.getElementById('tecnicoBio').value = tecnico.bio || '';
        document.getElementById('tecnicoHorario').value = tecnico.horario_contato || '';
        document.getElementById('tecnicoDisponibilidade').value = tecnico.data_disponivel || '';
        modalEditarTecnico.showModal();
    }

    if (formEditarTecnico) {
        formEditarTecnico.addEventListener('submit', async (evento) => {
            evento.preventDefault();
            const botaoSalvar = formEditarTecnico.querySelector('[type="submit"]');
            const erro = document.getElementById('erroEditarTecnico');
            if (erro) erro.textContent = '';
            if (botaoSalvar) botaoSalvar.disabled = true;

            try {
                const resposta = await fetch(`/api/tecnicos/${tecnicoEmEdicao}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(Object.fromEntries(new FormData(formEditarTecnico)))
                });
                const resultado = await resposta.json();
                if (!resposta.ok) throw new Error(resultado.erro || 'Não foi possível atualizar o técnico.');

                modalEditarTecnico.close();
                await carregarTecnicos();
                if (feedbackTecnicos) feedbackTecnicos.textContent = 'Técnico atualizado com sucesso.';
            } catch (erroAtualizacao) {
                if (erro) erro.textContent = erroAtualizacao.message;
            } finally {
                if (botaoSalvar) botaoSalvar.disabled = false;
            }
        });
    }

    const btnExcluirTecnico = document.getElementById('excluirTecnico');
    if (btnExcluirTecnico) {
        btnExcluirTecnico.addEventListener('click', async () => {
            const nomeTecnico = document.getElementById('tecnicoNome').value;
            if (!window.confirm(`Deseja excluir o técnico ${nomeTecnico}?`)) return;

            const botaoExcluir = document.getElementById('excluirTecnico');
            const erro = document.getElementById('erroEditarTecnico');
            if (erro) erro.textContent = '';
            botaoExcluir.disabled = true;

            try {
                const resposta = await fetch(`/api/tecnicos/${tecnicoEmEdicao}`, {
                    method: 'DELETE'
                });
                const resultado = await resposta.json();
                if (!resposta.ok) throw new Error(resultado.erro || 'Não foi possível excluir o técnico.');

                modalEditarTecnico.close();
                await carregarTecnicos();
                if (feedbackTecnicos) feedbackTecnicos.textContent = `Técnico ${nomeTecnico} excluído.`;
            } catch (erroExclusao) {
                if (erro) erro.textContent = erroExclusao.message;
            } finally {
                botaoExcluir.disabled = false;
            }
        });
    }

    const fecharModalTec = document.getElementById('fecharModalTecnico');
    if (fecharModalTec) {
        fecharModalTec.addEventListener('click', () => modalEditarTecnico.close());
    }

    if (botaoAbrirCadastroTecnico) {
        botaoAbrirCadastroTecnico.addEventListener('click', () => {
            const erroCad = document.getElementById('erroCadastroTecnico');
            if (erroCad) erroCad.textContent = '';
            modalCadastroTecnico.showModal();
            document.getElementById('cadastroTecnicoNome')?.focus();
        });
    }

    const fecharModalCadTec = document.getElementById('fecharModalCadastroTecnico');
    if (fecharModalCadTec) {
        fecharModalCadTec.addEventListener('click', () => modalCadastroTecnico.close());
    }

    if (formCadastroTecnico) {
        formCadastroTecnico.addEventListener('submit', cadastrarTecnico);
    }

    if (modalCadastroTecnico) {
        modalCadastroTecnico.addEventListener('click', (evento) => {
            if (evento.target === modalCadastroTecnico) modalCadastroTecnico.close();
        });
        modalCadastroTecnico.addEventListener('close', () => botaoAbrirCadastroTecnico?.focus());
    }

    if (modalEditarTecnico) {
        modalEditarTecnico.addEventListener('click', (evento) => {
            if (evento.target === modalEditarTecnico) modalEditarTecnico.close();
        });
        modalEditarTecnico.addEventListener('close', () => botaoEdicaoAtivo?.focus());
    }

    carregarTecnicos();
});
