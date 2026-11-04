# Back-end SYNTAX.lab — tudo em um arquivo

Este projeto usa **Node.js + Express + SQLite**.

O banco oficial fica em `../banco.db` (na raiz do projeto) e é criado automaticamente se não existir. Na primeira inicialização, o servidor mescla os registros do antigo `backend/banco.db` sem apagar nem substituir os dados existentes.

## Como rodar

```bash
npm install
npm start
```

Depois abra:

```text
http://localhost:3000/
```

Se aparecer a mensagem de que o back-end está funcionando, está certo.

## O que este back-end faz

- Cadastro de usuários
- Login de usuários
- Cadastro, listagem, edição e exclusão de clientes
- Cadastro, listagem, edição e exclusão de técnicos
- Cadastro, listagem, edição e exclusão de equipamentos
- Criação, listagem, edição, exclusão e mudança de status das ordens de serviço
- Relatórios por status, técnico e cliente

## Rotas principais

### Usuários

```text
POST /api/usuarios/cadastro
POST /api/usuarios/login
GET  /api/usuarios/me
PUT  /api/usuarios/me
POST /api/usuarios/logout
GET  /api/usuarios                 (somente administrador)
PUT  /api/usuarios/:id              (somente administrador)
DELETE /api/usuarios/:id            (somente administrador)
```

O cadastro público recebe o cargo `Cliente` por padrão. A conta administradora
pode atribuir `Visitante`, `Desenvolvedor / Equipe Syntax Lab` ou `Cliente`.
O login cria uma sessão em cookie HttpOnly, válida por até 8 horas.

### Provisionar a conta administradora

Depois de iniciar o servidor uma vez para criar/atualizar o banco, use o
PowerShell para fornecer a senha sem salvá-la no código ou no repositório:

```powershell
$env:SYNTAXLAB_ADMIN_PASSWORD = Read-Host "Senha da conta administradora"
node backend/criar-admin.js
Remove-Item Env:\SYNTAXLAB_ADMIN_PASSWORD
```

O script cria ou atualiza `Admin Syntax Lab` (`admin@syntaxlab.com.br`) e
armazena somente o hash bcrypt da senha. A tela de gestão fica em
`/admin-usuarios.html` e só pode ser usada pela sessão administradora.

### Clientes

```text
GET    /api/clientes
GET    /api/clientes/:id
POST   /api/clientes
PUT    /api/clientes/:id
DELETE /api/clientes/:id
```

### Técnicos

```text
GET    /api/tecnicos
GET    /api/tecnicos/:id
POST   /api/tecnicos
PUT    /api/tecnicos/:id
DELETE /api/tecnicos/:id
```

### Equipamentos

```text
GET    /api/equipamentos
GET    /api/equipamentos/:id
POST   /api/equipamentos
PUT    /api/equipamentos/:id
DELETE /api/equipamentos/:id
```

### Ordens de serviço

```text
GET    /api/ordens
GET    /api/ordens/:id
POST   /api/ordens
PUT    /api/ordens/:id
PATCH  /api/ordens/:id/status
DELETE /api/ordens/:id
```

### Relatórios

```text
GET /api/relatorios/resumo
GET /api/relatorios/tecnicos
GET /api/relatorios/clientes
```

## Cadastro de usuário

Faça um POST para:

```text
http://localhost:3000/api/usuarios/cadastro
```

Com este JSON:

```json
{
  "nome": "João",
  "email": "joao@teste.com",
  "senha": "123456"
}
```

## Login

Faça um POST para:

```text
http://localhost:3000/api/usuarios/login
```

Com este JSON:

```json
{
  "email": "joao@teste.com",
  "senha": "123456"
}
```

## Observação

Não é necessário criar o arquivo `banco.db` manualmente.
Ele será criado automaticamente quando você rodar:

```bash
npm start
```
