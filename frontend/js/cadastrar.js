// Lógica da página cadastrar.html (Cadastro de Técnicos)

async function cadastrarTecnico(evento) {
    evento.preventDefault();

    const dados = {
        nome: document.getElementById('nome').value,
        email: document.getElementById('email').value,
        senha: document.getElementById('senha').value,
        idade: document.getElementById('idade').value,
        data_nascimento: document.getElementById('data-nascimento').value,
        genero: document.getElementById('genero').value,
        nivel: document.getElementById('nivel').value,
        bio: document.getElementById('bio').value,
        horario_contato: document.getElementById('horario').value,
        data_disponivel: document.getElementById('data-disponivel').value
    };

    try {
        const resposta = await fetch('/api/tecnicos/cadastro', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dados)
        });

        const resultado = await resposta.json();

        if (resposta.ok) {
            alert('Técnico cadastrado com sucesso!');
            window.location.href = 'inicio.html';
        } else {
            alert(resultado.erro || 'Erro ao cadastrar técnico.');
        }
    } catch (erro) {
        alert('Erro ao conectar com o servidor: ' + erro.message);
    }
}

window.cadastrarTecnico = cadastrarTecnico;
