// Lógica da página ordem.html (Gerenciamento de Ordens de Serviço)

document.addEventListener('DOMContentLoaded', () => {
    const modalNovaOS = document.getElementById('modalNovaOS');
    const botaoNovaOS = document.getElementById('abrirModalOS');
    const feedbackOS = document.getElementById('feedbackOS');
    const listaOrdens = document.getElementById('listaOrdens');
    const modalEditarOS = document.getElementById('modalEditarOS');
    const formEditarOS = document.getElementById('formEditarOS');
    let templateOSCarregado = false;
    let ordemEmEdicao = null;
    let botaoEditarAtivo = null;

    function adicionarCelula(linha, conteudo) {
        const celula = document.createElement('td');
        celula.textContent = conteudo || '-';
        linha.append(celula);
    }

    function formatarDataOS(data) {
        return data ? data.split('-').reverse().join('/') : '-';
    }

    async function carregarOrdens() {
        if (!listaOrdens) return;

        try {
            const resposta = await fetch('/api/ordens');
            if (!resposta.ok) return;
            const ordens = await resposta.json();
            listaOrdens.replaceChildren();

            if (!ordens.length) {
                const linha = document.createElement('tr');
                const celula = document.createElement('td');
                celula.colSpan = 8;
                celula.textContent = 'Nenhuma ordem cadastrada.';
                linha.append(celula);
                listaOrdens.append(linha);
                return;
            }

            ordens.forEach((ordem) => {
                const linha = document.createElement('tr');
                adicionarCelula(linha, String(ordem.id_os).padStart(3, '0'));
                adicionarCelula(linha, ordem.cliente);
                adicionarCelula(linha, ordem.equipamento);
                adicionarCelula(linha, ordem.tecnico);

                const celulaStatus = document.createElement('td');
                const status = document.createElement('span');
                status.className = ordem.id_status === 2 ? 'concluida' : ordem.id_status === 3 ? 'pendente' : 'andamento';
                status.textContent = ordem.status;
                celulaStatus.append(status);
                linha.append(celulaStatus);

                adicionarCelula(linha, formatarDataOS(ordem.data_os));
                adicionarCelula(linha, ordem.nivel_emergencia);

                const celulaAcoes = document.createElement('td');
                const botaoEditar = document.createElement('button');
                botaoEditar.type = 'button';
                botaoEditar.className = 'botao-menu';
                botaoEditar.textContent = 'Editar';
                botaoEditar.addEventListener('click', () => abrirEdicaoOS(ordem, botaoEditar));
                celulaAcoes.append(botaoEditar);
                linha.append(celulaAcoes);
                listaOrdens.append(linha);
            });

        } catch (erro) {
            if (feedbackOS) feedbackOS.textContent = 'Não foi possível carregar as ordens salvas.';
        }
    }

    async function abrirCadastroOS() {
        if (feedbackOS) feedbackOS.textContent = '';

        try {
            if (!templateOSCarregado) {
                const respostaTemplate = await fetch('cadastrarOS.html');
                if (!respostaTemplate.ok) throw new Error('Não foi possível abrir o formulário de OS.');

                const documento = new DOMParser().parseFromString(await respostaTemplate.text(), 'text/html');
                const template = documento.getElementById('cadastro-os-template');
                if (!template) throw new Error('O formulário de OS não foi encontrado.');
                modalNovaOS.replaceChildren(template.content.cloneNode(true));

                const respostaOpcoes = await fetch('/api/ordens/opcoes');
                const opcoes = await respostaOpcoes.json();
                if (!respostaOpcoes.ok) throw new Error(opcoes.erro || 'Não foi possível carregar as opções.');

                const seletorTecnico = modalNovaOS.querySelector('#osTecnico');
                seletorTecnico.replaceChildren(new Option('Selecione um técnico', ''));
                opcoes.tecnicos.forEach((tecnico) => {
                    seletorTecnico.add(new Option(tecnico.nome, tecnico.id_tecnico));
                });

                if (!opcoes.tecnicos.length) {
                    throw new Error('Cadastre um técnico antes de abrir uma ordem de serviço.');
                }

                modalNovaOS.querySelector('[data-fechar-os]').addEventListener('click', () => modalNovaOS.close());
                modalNovaOS.querySelector('#formNovaOS').addEventListener('submit', salvarOS);
                templateOSCarregado = true;
            }

            const dataLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
            modalNovaOS.querySelector('#osData').value = dataLocal;
            modalNovaOS.showModal();
            modalNovaOS.querySelector('#osCliente').focus();
        } catch (erro) {
            if (feedbackOS) feedbackOS.textContent = erro.message;
        }
    }

    async function salvarOS(evento) {
        evento.preventDefault();
        const formulario = evento.currentTarget;
        const feedback = modalNovaOS.querySelector('#osFeedback');
        const botaoEnviar = formulario.querySelector('[type="submit"]');
        if (feedback) feedback.textContent = '';
        if (botaoEnviar) botaoEnviar.disabled = true;

        try {
            const resposta = await fetch('/api/ordens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.fromEntries(new FormData(formulario)))
            });
            const resultado = await resposta.json();
            if (!resposta.ok) throw new Error(resultado.erro || 'Não foi possível criar a OS.');

            modalNovaOS.close();
            formulario.reset();
            await carregarOrdens();
            if (feedbackOS) feedbackOS.textContent = 'Ordem de serviço criada com sucesso.';
        } catch (erro) {
            if (feedback) feedback.textContent = erro.message;
        } finally {
            if (botaoEnviar) botaoEnviar.disabled = false;
        }
    }

    async function abrirEdicaoOS(ordem, botao) {
        ordemEmEdicao = ordem.id_os;
        botaoEditarAtivo = botao;
        const numOS = document.getElementById('numeroOSemEdicao');
        const novoStatus = document.getElementById('novoStatusOS');
        const fbStatus = document.getElementById('feedbackEditarStatus');
        if (numOS) numOS.textContent = `OS #${String(ordem.id_os).padStart(3, '0')}`;
        if (novoStatus) novoStatus.value = String(ordem.id_status);
        if (fbStatus) fbStatus.textContent = '';

        try {
            const resposta = await fetch('/api/ordens/opcoes');
            const opcoes = await resposta.json();
            if (!resposta.ok) throw new Error(opcoes.erro || 'Não foi possível carregar os técnicos.');

            const seletorTecnico = document.getElementById('editarTecnico');
            seletorTecnico.replaceChildren(new Option('Selecione um técnico', ''));
            opcoes.tecnicos.forEach((tecnico) => {
                seletorTecnico.add(new Option(tecnico.nome, tecnico.id_tecnico));
            });

            document.getElementById('editarCliente').value = ordem.cliente || '';
            document.getElementById('editarEquipamento').value = ordem.equipamento || '';
            seletorTecnico.value = String(ordem.id_tecnico || '');
            document.getElementById('editarData').value = ordem.data_os || '';
            document.getElementById('editarEmergencia').value = ordem.nivel_emergencia || 'Baixo';
            document.getElementById('editarDescricao').value = ordem.descricao_problema || '';
            modalEditarOS.showModal();
            document.getElementById('editarCliente').focus();
        } catch (erro) {
            if (feedbackOS) feedbackOS.textContent = erro.message;
        }
    }

    if (formEditarOS) {
        formEditarOS.addEventListener('submit', async (evento) => {
            evento.preventDefault();
            const botaoSalvar = formEditarOS.querySelector('[type="submit"]');
            const feedback = document.getElementById('feedbackEditarStatus');
            if (feedback) feedback.textContent = '';
            if (botaoSalvar) botaoSalvar.disabled = true;

            try {
                const resposta = await fetch(`/api/ordens/${ordemEmEdicao}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(Object.fromEntries(new FormData(formEditarOS)))
                });
                const resultado = await resposta.json();
                if (!resposta.ok) throw new Error(resultado.erro || 'Não foi possível editar a OS.');

                modalEditarOS.close();
                await carregarOrdens();
                if (feedbackOS) feedbackOS.textContent = 'Ordem de serviço atualizada.';
            } catch (erro) {
                if (feedback) feedback.textContent = erro.message;
            } finally {
                if (botaoSalvar) botaoSalvar.disabled = false;
            }
        });
    }

    const btnExcluirOS = document.getElementById('excluirOS');
    if (btnExcluirOS) {
        btnExcluirOS.addEventListener('click', async () => {
            const numeroOS = String(ordemEmEdicao).padStart(3, '0');
            if (!window.confirm(`Deseja excluir permanentemente a OS #${numeroOS}?`)) return;

            const botaoExcluir = document.getElementById('excluirOS');
            const feedback = document.getElementById('feedbackEditarStatus');
            if (feedback) feedback.textContent = '';
            if (botaoExcluir) botaoExcluir.disabled = true;

            try {
                const resposta = await fetch(`/api/ordens/${ordemEmEdicao}`, {
                    method: 'DELETE'
                });
                const resultado = await resposta.json();
                if (!resposta.ok) throw new Error(resultado.erro || 'Não foi possível excluir a OS.');

                modalEditarOS.close();
                await carregarOrdens();
                if (feedbackOS) feedbackOS.textContent = `OS #${numeroOS} excluída.`;
            } catch (erro) {
                if (feedback) feedback.textContent = erro.message;
            } finally {
                if (botaoExcluir) botaoExcluir.disabled = false;
            }
        });
    }

    if (botaoNovaOS) {
        botaoNovaOS.addEventListener('click', abrirCadastroOS);
    }
    if (modalNovaOS) {
        modalNovaOS.addEventListener('click', (evento) => {
            if (evento.target === modalNovaOS) modalNovaOS.close();
        });
        modalNovaOS.addEventListener('close', () => botaoNovaOS?.focus());
    }
    const fecharEdicaoOS = document.getElementById('fecharEdicaoOS');
    if (fecharEdicaoOS) {
        fecharEdicaoOS.addEventListener('click', () => modalEditarOS.close());
    }
    if (modalEditarOS) {
        modalEditarOS.addEventListener('click', (evento) => {
            if (evento.target === modalEditarOS) modalEditarOS.close();
        });
        modalEditarOS.addEventListener('close', () => botaoEditarAtivo?.focus());
    }

    carregarOrdens();
});
