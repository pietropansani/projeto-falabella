# SYNTAX.lab — Sistema de Manutenção de Equipamentos

Projeto reestruturado e organizado com arquitetura desacoplada entre **Front-end** e **Back-end**.

---

## 📁 Estrutura do Projeto

```text
projeto-falabella/
├── backend/                  # Servidor, APIs REST e regras de negócio
│   ├── atualizar-banco.js    # Script utilitário de migração/atualização do banco
│   ├── criar-admin.js        # Script seguro para provisionar conta de administrador
│   ├── package.json          # Dependências exclusivas do backend
│   ├── README.md             # Documentação das rotas de API
│   └── server.js             # Servidor Node.js Express + SQLite
│
├── frontend/                 # Interface do usuário (HTML, CSS, JS e Assets)
│   ├── css/                  # Folhas de estilo modularizadas
│   │   ├── admin-usuarios.css
│   │   ├── style.css
│   │   └── user-menu.css
│   ├── img/                  # Imagens e ícones do sistema
│   │   ├── chrome-referencia.png
│   │   ├── dafny.png
│   │   ├── joao.png
│   │   ├── julia.png
│   │   ├── logo-removebg-preview2.png
│   │   └── pietro.png
│   ├── js/                   # Scripts JavaScript separados (sem JS inline nos HTML)
│   │   ├── admin-usuarios.js # Gestão de usuários e permissões
│   │   ├── cadastrar.js      # Cadastro de técnicos
│   │   ├── cadastrarlogin.js # Cadastro de contas de usuário
│   │   ├── clientes.js       # Listagem, cadastro, edição e exclusão de clientes
│   │   ├── index.js          # Autenticação de login e modal de cadastro
│   │   ├── inicio.js         # Métricas e contadores da dashboard
│   │   ├── ordem.js          # Gestão completa de ordens de serviço (OS)
│   │   ├── relatorios.js     # Consulta de totais e status de OS
│   │   ├── tecnicos.js       # Listagem, cadastro, edição e exclusão de técnicos
│   │   └── user-menu.js      # Menu de perfil flutuante e modal de conta
│   │
│   ├── admin-usuarios.html   # Painel administrativo de usuários
│   ├── cadascliente.html     # Formulário de clientes
│   ├── cadastrar.html        # Formulário de técnicos
│   ├── cadastrarlogin.html   # Tela e template de criação de conta
│   ├── cadastrarOS.html      # Template de nova ordem de serviço
│   ├── clientes.html         # Gestão de clientes
│   ├── editar.html           # Edição estática de ordens
│   ├── index.html            # Tela inicial de Login
│   ├── inicio.html           # Dashboard principal
│   ├── menu-interativo.html  # Demonstração do menu de usuário
│   ├── ordem.html            # Painel de ordens de serviço
│   ├── relatorios.html       # Painel de relatórios
│   ├── sobre.html            # Apresentação da equipe e tecnologias
│   └── tecnicos.html         # Gestão da equipe de técnicos
│
├── prints/                   # Capturas de tela do projeto
├── banco.db                  # Banco de dados SQLite oficial
├── package.json              # Atalhos de execução na raiz
└── README.md                 # Documentação geral do projeto
```

---

## 🚀 Como Executar

### 1. Instalar as dependências
Na raiz do projeto ou dentro da pasta `backend`:
```bash
npm install
```

### 2. Iniciar o servidor
```bash
npm start
```

Ou em modo desenvolvimento (com recarregamento automático):
```bash
npm run dev
```

### 3. Acessar no navegador
Abra no navegador:
```text
http://localhost:3000/
```

---

## ✨ Melhorias Realizadas na Organização

1. **Separação Completa Front-end / Back-end**:
   - Todo o código do cliente foi isolado no diretório `frontend/`.
   - O servidor Express no `backend/server.js` entrega estaticamente apenas os arquivos públicos da pasta `frontend/`.
   - O backend não mais mistura arquivos estáticos com arquivos de servidor, eliminando vulnerabilidades de vazamento de código.

2. **Extração de Javascript Inline**:
   - Todas as tags `<script>` com lógica inline que existiam nos arquivos HTML foram extraídas para arquivos `.js` dedicados dentro de `frontend/js/`.
   - As páginas agora utilizam referências externas limpas `<script src="js/..."></script>`, facilitando manutenção, cache do navegador e testes.

3. **Organização de Estilos e Imagens**:
   - CSS organizado em `frontend/css/`.
   - Imagens centralizadas em `frontend/img/`, com suporte de compatibilidade no servidor para rotas `/img` e `/IMG`.
