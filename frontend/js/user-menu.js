/**
 * SYNTAX LAB — MENU DE USUÁRIO DINÂMICO & MINIMALISTA
 * Carrega e sincroniza usuários reais do banco de dados SQLite (/api/usuarios)
 */

(function () {
    'use strict';

    // Pietro é o perfil padrão inicial garantido do banco
    const PERFIL_PADRAO = {
        id: 'pietro',
        nome: 'Pietro Pansani',
        email: 'pietropansani038@gmail.com',
        cargo: 'Back-end',
        foto: 'IMG/pietro.png'
    };

    let listaPerfis = carregarPerfisLocais();
    let usuarioAtual = carregarUsuarioSalvo();
    let sessaoVerificada = false;

    function carregarPerfisLocais() {
        try {
            const salvos = localStorage.getItem('syntaxlab_todos_usuarios');
            if (salvos) {
                const parsed = JSON.parse(salvos);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {
            console.warn('Erro ao carregar lista de usuários salvos', e);
        }
        return [PERFIL_PADRAO];
    }

    function salvarPerfisLocais(perfis) {
        listaPerfis = perfis;
        try {
            localStorage.setItem('syntaxlab_todos_usuarios', JSON.stringify(perfis));
        } catch (e) {
            console.warn('Erro ao salvar lista de usuários', e);
        }
    }

    function carregarUsuarioSalvo() {
        try {
            const salvo = localStorage.getItem('syntaxlab_usuario');
            if (salvo) return JSON.parse(salvo);
        } catch (e) {
            console.warn('Erro ao carregar usuário salvo', e);
        }
        return listaPerfis[0] || PERFIL_PADRAO;
    }

    function salvarUsuario(usuario) {
        usuarioAtual = usuario;
        try {
            localStorage.setItem('syntaxlab_usuario', JSON.stringify(usuario));
        } catch (e) {
            console.warn('Erro ao salvar no localStorage', e);
        }
        atualizarInterface();
    }

    async function sincronizarUsuarioDaSessao() {
        try {
            const resposta = await fetch('/api/usuarios/me');
            if (resposta.status === 401) {
                localStorage.removeItem('syntaxlab_usuario');
                window.location.replace('index.html');
                return;
            }
            if (!resposta.ok) return;

            const resultado = await resposta.json();
            const usuario = resultado.usuario;
            sessaoVerificada = true;
            salvarUsuario({
                id: String(usuario.id_usuario),
                nome: usuario.nome,
                email: usuario.email,
                cargo: usuario.cargo,
                foto: usuario.cargo === 'Administrador'
                    ? 'IMG/logo-removebg-preview2.png'
                    : usuarioAtual.foto || 'IMG/pietro.png',
                status: 'Online'
            });
        } catch (e) {
            console.error('Não foi possível validar a sessão.', e);
        }
    }

    // Gera um avatar elegante com as iniciais para novos usuários criados
    function gerarAvatarSvg(nome) {
        const partes = (nome || 'U').trim().split(' ');
        const iniciais = (partes[0][0] + (partes[1] ? partes[1][0] : '')).toUpperCase();
        const cores = ['#0284c7', '#7c3aed', '#059669', '#d97706', '#db2777', '#4f46e5'];
        const indiceCor = Math.abs(nome.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % cores.length;
        const bg = cores[indiceCor];

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
            <rect width="64" height="64" rx="32" fill="${bg}"/>
            <text x="50%" y="54%" font-family="sans-serif" font-size="24" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${iniciais}</text>
        </svg>`;
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }

    function renderizarListaPerfis() {
        const container = document.getElementById('userQuickProfiles');
        if (!container) return;

        container.innerHTML = listaPerfis.map(p => {
            const isAtivo = p.id === usuarioAtual.id || p.email.toLowerCase() === usuarioAtual.email.toLowerCase();
            const primeiroNome = p.nome.split(' ')[0];
            return `
                <button type="button" class="quick-profile-pill ${isAtivo ? 'active' : ''}" data-profile-id="${p.id}" data-profile-email="${p.email}" title="${p.nome}">
                    <img src="${p.foto}" alt="${p.nome}" class="quick-profile-thumb">
                    <span>${primeiroNome}</span>
                </button>
            `;
        }).join('');

        vincularCliquesPerfis();
    }

    function vincularCliquesPerfis() {
        document.querySelectorAll('.quick-profile-pill').forEach(pill => {
            pill.onclick = function (e) {
                e.stopPropagation();
                const email = this.getAttribute('data-profile-email');
                const perfilEncontrado = listaPerfis.find(p => p.email.toLowerCase() === email.toLowerCase());
                if (perfilEncontrado) {
                    salvarUsuario(perfilEncontrado);
                    renderizarListaPerfis();
                    mostrarToast(`Perfil ativo: ${perfilEncontrado.nome}`);
                }
            };
        });
    }

    function renderizarComponente() {
        let container = document.getElementById('user-menu-root');
        if (!container) {
            container = document.createElement('div');
            container.id = 'user-menu-root';
            container.className = 'user-menu-wrapper user-menu-fixed-top';
            document.body.appendChild(container);
        }

        container.innerHTML = `
            <!-- Botão Gatilho Compacto -->
            <button type="button" class="user-trigger-btn" id="btnUserMenuTrigger" aria-label="Menu da conta" aria-expanded="false">
                <div class="user-trigger-avatar-box">
                    <img src="${usuarioAtual.foto}" alt="${usuarioAtual.nome}" class="user-trigger-avatar" id="umTriggerAvatar">
                    <span class="user-status-dot"></span>
                </div>
                <div class="user-trigger-info">
                    <span class="user-trigger-name" id="umTriggerName">${usuarioAtual.nome.split(' ')[0]}</span>
                    <span class="user-trigger-role" id="umTriggerRole">${usuarioAtual.cargo}</span>
                </div>
                <svg class="user-trigger-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>

            <!-- Card Dropdown Compacto e Minimalista -->
            <div class="user-dropdown-card" id="userDropdownMenu" role="menu">
                
                <!-- Cabeçalho do Perfil -->
                <div class="user-card-header">
                    <div class="user-header-avatar-wrap">
                        <img src="${usuarioAtual.foto}" alt="${usuarioAtual.nome}" class="user-header-avatar" id="umHeaderAvatar">
                        <span class="user-header-badge" title="Online"></span>
                    </div>
                    
                    <h3 class="user-header-name">
                        <span id="umHeaderName">${usuarioAtual.nome}</span>
                        <svg class="user-verified-icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                    </h3>

                    <div class="user-header-email-row" id="btnCopiarEmail" title="Clique para copiar">
                        <span class="user-header-email" id="umHeaderEmail">${usuarioAtual.email}</span>
                        <svg class="user-header-copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </div>

                    <!-- Botão Gerenciar Conta -->
                    <button type="button" class="btn-manage-account" id="btnAbrirManageAccount">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                        </svg>
                        <span>Gerenciar sua Conta</span>
                    </button>
                    <button type="button" class="btn-manage-account" id="btnAdminUsuarios" hidden>
                        <span>Gerenciar usuários</span>
                    </button>
                </div>

                <!-- Ações Essenciais: Adicionar Perfil e Sair -->
                <div class="user-menu-body">
                    
                    <!-- Adicionar Perfil -->
                    <button type="button" class="user-menu-item" id="btnAdicionarPerfil">
                        <div class="user-item-icon-box">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="8.5" cy="7" r="4"></circle>
                                <line x1="20" y1="8" x2="20" y2="14"></line>
                                <line x1="23" y1="11" x2="17" y2="11"></line>
                            </svg>
                        </div>
                        <div class="user-item-content">
                            <span class="user-item-title">Adicionar novo perfil</span>
                        </div>
                        <svg class="user-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>

                    <!-- Sair (Log Out) -->
                    <button type="button" class="user-menu-item danger" id="btnLogOut">
                        <div class="user-item-icon-box">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                        </div>
                        <div class="user-item-content">
                            <span class="user-item-title">Sair do sistema</span>
                        </div>
                        <svg class="user-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>

                </div>

            </div>
        `;

        criarModaisNoDOM();
        vincularEventos();
        sincronizarUsuarioDaSessao();
    }

    function criarModaisNoDOM() {
        if (document.getElementById('umModaisContainer')) return;

        const modais = document.createElement('div');
        modais.id = 'umModaisContainer';
        modais.innerHTML = `
            <!-- Modal Compacto: Gerenciar Conta -->
            <div class="um-modal-backdrop" id="modalManageAccount">
                <div class="um-modal-card">
                    <div class="um-modal-header">
                        <div class="um-modal-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                            <span>Gerenciar Conta</span>
                        </div>
                        <button type="button" class="um-modal-close" data-close-modal="modalManageAccount">&times;</button>
                    </div>
                    <form id="formGerenciarConta" class="um-modal-body">
                        <div class="um-form-group">
                            <label class="um-form-label" for="inputNomeUsuario">Nome Completo</label>
                            <input type="text" id="inputNomeUsuario" class="um-form-input" value="${usuarioAtual.nome}" required>
                        </div>
                        <div class="um-form-group">
                            <label class="um-form-label" for="inputEmailUsuario">E-mail</label>
                            <input type="email" id="inputEmailUsuario" class="um-form-input" value="${usuarioAtual.email}" required>
                        </div>
                        <div class="um-form-group">
                            <label class="um-form-label" for="inputCargoUsuario">Cargo</label>
                            <input type="text" id="inputCargoUsuario" class="um-form-input" value="${usuarioAtual.cargo}" readonly>
                        </div>
                        <div class="um-modal-footer" style="padding: 12px 0 0 0; background: transparent; border: none;">
                            <button type="button" class="um-btn-secondary" data-close-modal="modalManageAccount">Cancelar</button>
                            <button type="submit" class="um-btn-primary">Salvar</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Modal: Cadastro Direto de Nova Conta / Novo Perfil -->
            <div class="um-modal-backdrop" id="modalNovoCadastro">
                <div class="um-modal-card" style="max-width: 420px; max-height: calc(100vh - 40px); overflow-y: auto;">
                    <div class="um-modal-header">
                        <div class="um-modal-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="8.5" cy="7" r="4"></circle>
                                <line x1="20" y1="8" x2="20" y2="14"></line>
                                <line x1="23" y1="11" x2="17" y2="11"></line>
                            </svg>
                            <span>Cadastrar Novo Usuário</span>
                        </div>
                        <button type="button" class="um-modal-close" data-close-modal="modalNovoCadastro">&times;</button>
                    </div>
                    <form id="formNovoCadastroModal" class="um-modal-body">
                        <div class="um-form-group">
                            <label class="um-form-label" for="cadModalNome">Nome Completo</label>
                            <input type="text" id="cadModalNome" name="nome" class="um-form-input" placeholder="Digite seu nome" required>
                        </div>
                        <div class="um-form-group">
                            <label class="um-form-label" for="cadModalEmail">E-mail</label>
                            <input type="email" id="cadModalEmail" name="email" class="um-form-input" placeholder="seuemail@exemplo.com" required>
                        </div>
                        <div class="um-form-group">
                            <label class="um-form-label" for="cadModalSenha">Senha</label>
                            <input type="password" id="cadModalSenha" name="senha" class="um-form-input" placeholder="Mínimo 6 caracteres" minlength="6" required>
                        </div>
                        <div class="um-form-group">
                            <label class="um-form-label" for="cadModalRm">RM (até 4 caracteres)</label>
                            <input type="text" id="cadModalRm" name="rm" class="um-form-input" placeholder="Ex: 1234" maxlength="4" required>
                        </div>
                        <div class="um-form-group">
                            <label class="um-form-label" for="cadModalNasc">Data de Nascimento</label>
                            <input type="date" id="cadModalNasc" name="data_nascimento" class="um-form-input" required>
                        </div>
                        <div class="um-form-group">
                            <label class="um-form-label" for="cadModalGenero">Gênero</label>
                            <select id="cadModalGenero" name="genero" class="um-form-input" required>
                                <option value="" disabled selected>Selecione seu gênero</option>
                                <option value="Masculino">Masculino</option>
                                <option value="Feminino">Feminino</option>
                                <option value="Prefiro_nao_dizer">Prefiro não dizer</option>
                            </select>
                        </div>
                        <p id="cadModalFeedback" style="font-size: 12px; min-height: 1.2em; margin: 0;"></p>
                        <div class="um-modal-footer" style="padding: 10px 0 0 0; background: transparent; border: none;">
                            <button type="button" class="um-btn-secondary" data-close-modal="modalNovoCadastro">Cancelar</button>
                            <button type="submit" class="um-btn-primary">Criar Conta</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Modal Compacto: Confirmação de Logout -->
            <div class="um-modal-backdrop" id="modalConfirmarLogout">
                <div class="um-modal-card">
                    <div class="um-modal-header">
                        <div class="um-modal-title" style="color: #f87171;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                            <span>Deseja sair?</span>
                        </div>
                        <button type="button" class="um-modal-close" data-close-modal="modalConfirmarLogout">&times;</button>
                    </div>
                    <div class="um-modal-body">
                        <p style="font-size: 13px; color: #cbd5e1; line-height: 1.4;">
                            Deseja desconectar a sessão de <strong>${usuarioAtual.nome}</strong>?
                        </p>
                    </div>
                    <div class="um-modal-footer">
                        <button type="button" class="um-btn-secondary" data-close-modal="modalConfirmarLogout">Cancelar</button>
                        <button type="button" class="um-btn-danger" id="btnConfirmarLogoutExecutar">Sim, sair</button>
                    </div>
                </div>
            </div>

            <!-- Toast Compacto -->
            <div class="um-toast" id="umToast">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span id="umToastMsg">Ação concluída</span>
            </div>
        `;
        document.body.appendChild(modais);
    }

    function atualizarInterface() {
        const tAvatar = document.getElementById('umTriggerAvatar');
        const tName = document.getElementById('umTriggerName');
        const tRole = document.getElementById('umTriggerRole');
        const hAvatar = document.getElementById('umHeaderAvatar');
        const hName = document.getElementById('umHeaderName');
        const hEmail = document.getElementById('umHeaderEmail');

        if (tAvatar) tAvatar.src = usuarioAtual.foto;
        if (tName) tName.textContent = usuarioAtual.nome.split(' ')[0];
        if (tRole) tRole.textContent = usuarioAtual.cargo;
        if (hAvatar) hAvatar.src = usuarioAtual.foto;
        if (hName) hName.textContent = usuarioAtual.nome;
        if (hEmail) hEmail.textContent = usuarioAtual.email;

        const inNome = document.getElementById('inputNomeUsuario');
        const inEmail = document.getElementById('inputEmailUsuario');
        const inCargo = document.getElementById('inputCargoUsuario');
        const btnAdmin = document.getElementById('btnAdminUsuarios');
        if (inNome) inNome.value = usuarioAtual.nome;
        if (inEmail) inEmail.value = usuarioAtual.email;
        if (inCargo) inCargo.value = usuarioAtual.cargo;
        if (btnAdmin) btnAdmin.hidden = !sessaoVerificada || usuarioAtual.cargo !== 'Administrador';

        document.querySelectorAll('.quick-profile-pill').forEach(pill => {
            const email = pill.getAttribute('data-profile-email');
            if (email && email.toLowerCase() === usuarioAtual.email.toLowerCase()) {
                pill.classList.add('active');
            } else {
                pill.classList.remove('active');
            }
        });
    }

    function mostrarToast(mensagem) {
        const toast = document.getElementById('umToast');
        const msg = document.getElementById('umToastMsg');
        if (!toast || !msg) return;

        msg.textContent = mensagem;
        toast.classList.add('show');
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 2600);
    }

    function vincularEventos() {
        const trigger = document.getElementById('btnUserMenuTrigger');
        const menu = document.getElementById('userDropdownMenu');

        if (!trigger || !menu) return;

        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            const isOpen = menu.classList.contains('show');
            fecharMenu();
            if (!isOpen) {
                menu.classList.add('show');
                trigger.classList.add('active');
                trigger.setAttribute('aria-expanded', 'true');
            }
        });

        document.addEventListener('click', function (e) {
            if (!menu.contains(e.target) && !trigger.contains(e.target)) {
                fecharMenu();
            }
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                fecharMenu();
                fecharTodosModais();
            }
        });

        function fecharMenu() {
            menu.classList.remove('show');
            trigger.classList.remove('active');
            trigger.setAttribute('aria-expanded', 'false');
        }

        const btnCopiar = document.getElementById('btnCopiarEmail');
        if (btnCopiar) {
            btnCopiar.addEventListener('click', function (e) {
                e.stopPropagation();
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(usuarioAtual.email).then(() => {
                        mostrarToast('E-mail copiado!');
                    });
                } else {
                    mostrarToast('E-mail copiado: ' + usuarioAtual.email);
                }
            });
        }

        const btnManage = document.getElementById('btnAbrirManageAccount');
        if (btnManage) {
            btnManage.addEventListener('click', function (e) {
                e.stopPropagation();
                fecharMenu();
                abrirModal('modalManageAccount');
            });
        }

        const btnAdminUsuarios = document.getElementById('btnAdminUsuarios');
        if (btnAdminUsuarios) {
            btnAdminUsuarios.addEventListener('click', () => {
                window.location.href = 'admin-usuarios.html';
            });
        }

        const formManage = document.getElementById('formGerenciarConta');
        if (formManage) {
            formManage.addEventListener('submit', async function (e) {
                e.preventDefault();
                const novoNome = document.getElementById('inputNomeUsuario').value.trim();
                const novoEmail = document.getElementById('inputEmailUsuario').value.trim();
                if (!novoNome || !novoEmail) return;

                try {
                    const resposta = await fetch('/api/usuarios/me', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ nome: novoNome, email: novoEmail })
                    });
                    const resultado = await resposta.json();
                    if (!resposta.ok) throw new Error(resultado.erro || 'Não foi possível atualizar a conta.');

                    usuarioAtual.nome = novoNome;
                    usuarioAtual.email = novoEmail;
                    salvarUsuario(usuarioAtual);
                    fecharTodosModais();
                    mostrarToast('Conta atualizada!');
                } catch (erro) {
                    mostrarToast(erro.message);
                }
            });
        }

        const btnLogOut = document.getElementById('btnLogOut');
        if (btnLogOut) {
            btnLogOut.addEventListener('click', function (e) {
                e.stopPropagation();
                fecharMenu();
                abrirModal('modalConfirmarLogout');
            });
        }

        const btnConfirmarLogoutExecutar = document.getElementById('btnConfirmarLogoutExecutar');
        if (btnConfirmarLogoutExecutar) {
            btnConfirmarLogoutExecutar.addEventListener('click', async function () {
                mostrarToast('Saindo...');
                try {
                    await fetch('/api/usuarios/logout', { method: 'POST' });
                } finally {
                    localStorage.removeItem('syntaxlab_usuario');
                    window.location.href = 'index.html';
                }
            });
        }

        // Adicionar Perfil: abre o modal de cadastro de novo usuário
        const btnAdicionarPerfil = document.getElementById('btnAdicionarPerfil');
        if (btnAdicionarPerfil) {
            btnAdicionarPerfil.addEventListener('click', function (e) {
                e.stopPropagation();
                fecharMenu();
                abrirModal('modalNovoCadastro');
            });
        }

        // Submissão do formulário de cadastro de novo usuário
        const formNovoCad = document.getElementById('formNovoCadastroModal');
        const feedbackCad = document.getElementById('cadModalFeedback');
        if (formNovoCad) {
            formNovoCad.addEventListener('submit', async function (e) {
                e.preventDefault();
                if (feedbackCad) feedbackCad.textContent = '';
                const btnSubmit = formNovoCad.querySelector('[type="submit"]');
                btnSubmit.disabled = true;

                try {
                    const dados = Object.fromEntries(new FormData(formNovoCad));
                    const res = await fetch('/api/usuarios/cadastro', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dados)
                    });
                    const resultado = await res.json();

                    if (!res.ok) {
                        throw new Error(resultado.erro || 'Não foi possível cadastrar.');
                    }

                    if (feedbackCad) {
                        feedbackCad.style.color = '#10b981';
                        feedbackCad.textContent = 'Conta criada. O novo usuário pode entrar pela tela de login.';
                    }
                    mostrarToast('Conta criada com cargo Cliente.');
                    setTimeout(() => {
                        fecharModal('modalNovoCadastro');
                        formNovoCad.reset();
                    }, 900);
                } catch (err) {
                    if (feedbackCad) {
                        feedbackCad.style.color = '#f87171';
                        feedbackCad.textContent = err.message;
                    }
                } finally {
                    btnSubmit.disabled = false;
                }
            });
        }

        document.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', function () {
                const modalId = this.getAttribute('data-close-modal');
                fecharModal(modalId);
            });
        });

        document.querySelectorAll('.um-modal-backdrop').forEach(modal => {
            modal.addEventListener('click', function (e) {
                if (e.target === this) {
                    this.classList.remove('open');
                }
            });
        });
    }

    function abrirModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.add('open');
    }

    function fecharModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('open');
    }

    function fecharTodosModais() {
        document.querySelectorAll('.um-modal-backdrop').forEach(m => m.classList.remove('open'));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderizarComponente);
    } else {
        renderizarComponente();
    }

    window.SyntaxLabUserMenu = {
        recarregarUsuario: sincronizarUsuarioDaSessao,
        abrirGerenciarConta: function () {
            abrirModal('modalManageAccount');
        },
        abrirCadastroConta: function () {
            abrirModal('modalNovoCadastro');
        },
        fazerLogout: function () {
            abrirModal('modalConfirmarLogout');
        }
    };

})();
