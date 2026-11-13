// Lógica da página relatorios.html (Resumo e Estatísticas de Ordens)

async function carregarResumoOS() {
    const erroResumoOS = document.getElementById('erroResumoOS');

    try {
        const resposta = await fetch('/api/ordens');
        if (!resposta.ok) throw new Error('Falha ao consultar as ordens.');

        const ordens = await resposta.json();
        const totais = { 1: 0, 2: 0, 3: 0 };

        ordens.forEach((ordem) => {
            if (Object.hasOwn(totais, ordem.id_status)) {
                totais[ordem.id_status] += 1;
            }
        });

        const elEmAndamento = document.getElementById('totalEmAndamento');
        const elConcluidas = document.getElementById('totalConcluidas');
        const elPendentes = document.getElementById('totalPendentes');

        if (elEmAndamento) elEmAndamento.textContent = totais[1];
        if (elConcluidas) elConcluidas.textContent = totais[2];
        if (elPendentes) elPendentes.textContent = totais[3];
    } catch (erro) {
        if (erroResumoOS) erroResumoOS.textContent = 'Não foi possível carregar o resumo das ordens.';
        const elEmAndamento = document.getElementById('totalEmAndamento');
        const elConcluidas = document.getElementById('totalConcluidas');
        const elPendentes = document.getElementById('totalPendentes');

        if (elEmAndamento) elEmAndamento.textContent = '-';
        if (elConcluidas) elConcluidas.textContent = '-';
        if (elPendentes) elPendentes.textContent = '-';
    }
}

document.addEventListener('DOMContentLoaded', carregarResumoOS);
