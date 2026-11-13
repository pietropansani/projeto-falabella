// Lógica da página cadastrarlogin.html (Cadastro de Conta de Usuário)

document.addEventListener('DOMContentLoaded', () => {
    const formDireto = document.getElementById('formCadastroDireto');
    const feedbackDireto = document.getElementById('cadastroFeedbackDireto');

    if (formDireto) {
        formDireto.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (feedbackDireto) feedbackDireto.textContent = '';
            const botao = formDireto.querySelector('[type="submit"]');
            if (botao) botao.disabled = true;

            try {
                const dados = Object.fromEntries(new FormData(formDireto));
                const res = await fetch('/api/usuarios/cadastro', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dados)
                });
                const resultado = await res.json();

                if (!res.ok) {
                    throw new Error(resultado.erro || 'Não foi possível cadastrar.');
                }

                if (feedbackDireto) {
                    feedbackDireto.style.color = 'var(--cor-sucesso, #168653)';
                    feedbackDireto.textContent = 'Conta criada com sucesso! Redirecionando para login...';
                }
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1200);
            } catch (err) {
                if (feedbackDireto) {
                    feedbackDireto.style.color = 'var(--cor-perigo, #dc3545)';
                    feedbackDireto.textContent = err.message;
                }
            } finally {
                if (botao) botao.disabled = false;
            }
        });
    }
});
