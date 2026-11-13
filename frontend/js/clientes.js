// Lógica da página clientes.html (Gerenciamento de Clientes)

document.addEventListener('DOMContentLoaded', () => {
    const listaClientes = document.getElementById('listaClientes');
    const feedbackClientes = document.getElementById('feedbackClientes');
    const botaoAbrirCadastroCliente = document.getElementById('abrirModalCadastroCliente');
    const modalCadastroCliente = document.getElementById('modalCadastroCliente');
    const formCadastroCliente = document.getElementById('formCadastroCliente');
    const modalEditarCliente = document.getElementById('modalEditarCliente');
    const formEditarCliente = document.getElementById('formEditarCliente');
    let clienteEmEdicao = null;
    let botaoEdicaoAtivo = null;

    function adicionarCelula(linha, valor) {
        const celula = document.createElement('td');
        celula.textContent = valor === null || valor === undefined || valor === ''
            ? '-'
            : String(valor);
        linha.append(celula);
    }

    async function cadastrarCliente(evento) {
        evento.preventDefault();
        const botaoCadastrar = formCadastroCliente.querySelector('[type="submit"]');
        const erro = document.getElementById('erroCadastroCliente');
        if (erro) erro.textContent = '';
        if (botaoCadastrar) botaoCadastrar.disabled = true;

        try {
            const resposta = await fetch('/api/clientes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.fromEntries(new FormData(formCadastroCliente)))
            });
            const resultado = await resposta.json();
            if (!resposta.ok) {
                throw new Error(resultado.erro || 'Não foi possível cadastrar o cliente.');
            }

            modalCadastroCliente.close();
            formCadastroCliente.reset();
            await carregarClientes();
            if (feedbackClientes) feedbackClientes.textContent = 'Cliente cadastrado com sucesso.';
        } catch (erroCadastro) {
            if (erro) erro.textContent = erroCadastro.message;
        } finally {
            if (botaoCadastrar) botaoCadastrar.disabled = false;
        }
    }

    async function carregarClientes() {
        if (!listaClientes) return;

        try {
            const resposta = await fetch('/api/clientes');
            const clientes = await resposta.json();
            if (!resposta.ok) {
                throw new Error(clientes.erro || 'Não foi possível carregar os clientes.');
            }

            listaClientes.replaceChildren();
            if (!clientes.length) {
                const linha = document.createElement('tr');
                const celula = document.createElement('td');
                celula.colSpan = 5;
                celula.textContent = 'Nenhum cliente cadastrado.';
                linha.append(celula);
                listaClientes.append(linha);
                return;
            }

            clientes.forEach((cliente) => {
                const linha = document.createElement('tr');
                adicionarCelula(linha, cliente.nome);
                adicionarCelula(linha, cliente.telefone);
                adicionarCelula(linha, cliente.email);
                adicionarCelula(linha, cliente.os_atribuidas);

                const celulaAcoes = document.createElement('td');
                const botaoEditar = document.createElement('button');
                botaoEditar.type = 'button';
                botaoEditar.className = 'botao-menu';
                botaoEditar.textContent = 'Editar';
                botaoEditar.addEventListener('click', () => abrirEdicaoCliente(cliente, botaoEditar));
                celulaAcoes.append(botaoEditar);
                linha.append(celulaAcoes);
                listaClientes.append(linha);
            });
        } catch (erro) {
            if (feedbackClientes) feedbackClientes.textContent = erro.message;
        }
    }

    function abrirEdicaoCliente(cliente, botao) {
        clienteEmEdicao = cliente.id_cliente;
        botaoEdicaoAtivo = botao;
        const ident = document.getElementById('identificacaoCliente');
        const erroEdit = document.getElementById('erroEditarCliente');
        if (ident) ident.textContent = cliente.nome;
        if (erroEdit) erroEdit.textContent = '';
        const inputNome = document.getElementById('clienteNome');
        const inputTel = document.getElementById('clienteTelefone');
        const inputEmail = document.getElementById('clienteEmail');
        if (inputNome) inputNome.value = cliente.nome || '';
        if (inputTel) inputTel.value = cliente.telefone || '';
        if (inputEmail) inputEmail.value = cliente.email || '';
        if (modalEditarCliente) modalEditarCliente.showModal();
    }

    if (formEditarCliente) {
        formEditarCliente.addEventListener('submit', async (evento) => {
            evento.preventDefault();
            const botaoSalvar = formEditarCliente.querySelector('[type="submit"]');
            const erro = document.getElementById('erroEditarCliente');
            if (erro) erro.textContent = '';
            if (botaoSalvar) botaoSalvar.disabled = true;

            try {
                const resposta = await fetch(`/api/clientes/${clienteEmEdicao}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(Object.fromEntries(new FormData(formEditarCliente)))
                });
                const resultado = await resposta.json();
                if (!resposta.ok) {
                    throw new Error(resultado.erro || 'Não foi possível atualizar o cliente.');
                }

                modalEditarCliente.close();
                await carregarClientes();
                if (feedbackClientes) feedbackClientes.textContent = 'Cliente atualizado com sucesso.';
            } catch (erroAtualizacao) {
                if (erro) erro.textContent = erroAtualizacao.message;
            } finally {
                if (botaoSalvar) botaoSalvar.disabled = false;
            }
        });
    }

    const btnExcluir = document.getElementById('excluirCliente');
    if (btnExcluir) {
        btnExcluir.addEventListener('click', async (evento) => {
            const nomeCliente = document.getElementById('identificacaoCliente')?.textContent || 'este cliente';
            if (!window.confirm(`Deseja excluir o cliente ${nomeCliente}?`)) {
                return;
            }

            const botaoExcluir = evento.currentTarget;
            const erro = document.getElementById('erroEditarCliente');
            if (erro) erro.textContent = '';
            botaoExcluir.disabled = true;

            try {
                const resposta = await fetch(`/api/clientes/${clienteEmEdicao}`, {
                    method: 'DELETE'
                });
                const resultado = await resposta.json();
                if (!resposta.ok) {
                    throw new Error(resultado.erro || 'Não foi possível excluir o cliente.');
                }

                modalEditarCliente.close();
                botaoEdicaoAtivo = null;
                clienteEmEdicao = null;
                await carregarClientes();
                if (feedbackClientes) feedbackClientes.textContent = 'Cliente excluído com sucesso.';
            } catch (erroExclusao) {
                if (erro) erro.textContent = erroExclusao.message;
            } finally {
                botaoExcluir.disabled = false;
            }
        });
    }

    const btnFecharModalCliente = document.getElementById('fecharModalCliente');
    if (btnFecharModalCliente) {
        btnFecharModalCliente.addEventListener('click', () => modalEditarCliente.close());
    }

    if (botaoAbrirCadastroCliente) {
        botaoAbrirCadastroCliente.addEventListener('click', () => {
            const erroCad = document.getElementById('erroCadastroCliente');
            if (erroCad) erroCad.textContent = '';
            modalCadastroCliente.showModal();
            document.getElementById('novoClienteNome')?.focus();
        });
    }

    const btnFecharModalCad = document.getElementById('fecharModalCadastroCliente');
    if (btnFecharModalCad) {
        btnFecharModalCad.addEventListener('click', () => modalCadastroCliente.close());
    }

    if (formCadastroCliente) {
        formCadastroCliente.addEventListener('submit', cadastrarCliente);
    }

    if (modalCadastroCliente) {
        modalCadastroCliente.addEventListener('click', (evento) => {
            if (evento.target === modalCadastroCliente) modalCadastroCliente.close();
        });
        modalCadastroCliente.addEventListener('close', () => botaoAbrirCadastroCliente?.focus());
    }

    if (modalEditarCliente) {
        modalEditarCliente.addEventListener('click', (evento) => {
            if (evento.target === modalEditarCliente) modalEditarCliente.close();
        });
        modalEditarCliente.addEventListener('close', () => botaoEdicaoAtivo?.focus());
    }

    carregarClientes();
});
