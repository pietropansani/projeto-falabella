// Lógica da página index.html (Login e Abertura do Modal de Cadastro)

document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('formLogin');
    const loginFeedback = document.getElementById('loginFeedback');
    const modalCadastro = document.getElementById('modalCadastro');
    const botaoAbrirCadastro = document.getElementById('abrirCadastro');
    let cadastroCarregado = false;

    if (formLogin) {
        formLogin.addEventListener('submit', async (evento) => {
            evento.preventDefault();
            if (loginFeedback) loginFeedback.textContent = '';

            try {
                const resposta = await fetch('/api/usuarios/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: document.getElementById('email').value,
                        senha: document.getElementById('senha').value
                    })
                });
                const resultado = await resposta.json();

                if (!resposta.ok) {
                    throw new Error(resultado.erro || 'Não foi possível entrar.');
                }

                if (resultado.usuario) {
                    const u = resultado.usuario;
                    const nomeLower = (u.nome || '').toLowerCase();
                    let fotoPadrao = 'img/pietro.png';
                    if (u.cargo === 'Administrador') {
                        fotoPadrao = 'img/logo-removebg-preview2.png';
                    } else if (nomeLower.includes('pietro')) {
                        fotoPadrao = 'img/pietro.png';
                    } else if (nomeLower.includes('júlia') || nomeLower.includes('julia')) {
                        fotoPadrao = 'img/julia.png';
                    } else if (nomeLower.includes('dafny')) {
                        fotoPadrao = 'img/dafny.png';
                    } else if (nomeLower.includes('joão') || nomeLower.includes('joao')) {
                        fotoPadrao = 'img/joao.png';
                    }

                    localStorage.setItem('syntaxlab_usuario', JSON.stringify({
                        id: u.id_usuario,
                        nome: u.nome,
                        email: u.email,
                        cargo: u.cargo,
                        foto: u.foto || fotoPadrao,
                        status: 'Online'
                    }));
                }
                window.location.href = 'inicio.html';
            } catch (erro) {
                if (loginFeedback) loginFeedback.textContent = erro.message;
            }
        });
    }

    const linkSenha = document.getElementById('linkSenha');
    if (linkSenha) {
        linkSenha.addEventListener('click', (evento) => {
            evento.preventDefault();
            if (loginFeedback) loginFeedback.textContent = 'A recuperação de senha ainda não está disponível.';
        });
    }

    if (botaoAbrirCadastro && modalCadastro) {
        botaoAbrirCadastro.addEventListener('click', async () => {
            if (loginFeedback) loginFeedback.textContent = '';

            if (!cadastroCarregado) {
                try {
                    const resposta = await fetch('cadastrarlogin.html');
                    if (!resposta.ok) throw new Error('Não foi possível abrir o cadastro.');

                    const documento = new DOMParser().parseFromString(
                        await resposta.text(),
                        'text/html'
                    );
                    const template = documento.getElementById('cadastro-modal-template');
                    if (!template) throw new Error('O formulário de cadastro não foi encontrado.');

                    modalCadastro.replaceChildren(template.content.cloneNode(true));
                    const formCadastro = modalCadastro.querySelector('#formCadastro');
                    const cadastroFeedback = modalCadastro.querySelector('#cadastroFeedback');

                    const btnFecharModal = modalCadastro.querySelector('[data-fechar-modal]');
                    if (btnFecharModal) {
                        btnFecharModal.addEventListener('click', () => {
                            modalCadastro.close();
                        });
                    }

                    if (formCadastro) {
                        formCadastro.addEventListener('submit', async (eventoCadastro) => {
                            eventoCadastro.preventDefault();
                            if (cadastroFeedback) cadastroFeedback.textContent = '';
                            const botaoEnviar = formCadastro.querySelector('[type="submit"]');
                            if (botaoEnviar) botaoEnviar.disabled = true;

                            try {
                                const dados = Object.fromEntries(new FormData(formCadastro));
                                const respostaCadastro = await fetch('/api/usuarios/cadastro', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(dados)
                                });
                                const resultadoCadastro = await respostaCadastro.json();

                                if (!respostaCadastro.ok) {
                                    throw new Error(resultadoCadastro.erro || 'Não foi possível cadastrar.');
                                }

                                const campoEmail = document.getElementById('email');
                                const campoSenha = document.getElementById('senha');
                                if (campoEmail) campoEmail.value = dados.email;
                                if (campoSenha) campoSenha.focus();
                                modalCadastro.close();
                                if (loginFeedback) loginFeedback.textContent = 'Cadastro concluído. Agora entre com sua senha.';
                            } catch (erroCadastro) {
                                if (cadastroFeedback) cadastroFeedback.textContent = erroCadastro.message;
                            } finally {
                                if (botaoEnviar) botaoEnviar.disabled = false;
                            }
                        });
                    }

                    cadastroCarregado = true;
                } catch (erro) {
                    if (loginFeedback) loginFeedback.textContent = erro.message;
                    return;
                }
            }

            modalCadastro.showModal();
            const inputNomeCad = modalCadastro.querySelector('#nomeCadastro');
            if (inputNomeCad) inputNomeCad.focus();
        });

        modalCadastro.addEventListener('click', (evento) => {
            if (evento.target === modalCadastro) modalCadastro.close();
        });

        modalCadastro.addEventListener('close', () => botaoAbrirCadastro.focus());
    }
});
