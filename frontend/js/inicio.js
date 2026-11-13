// Lógica da página inicio.html (Dashboard de Métricas de OS)

async function carregarMetricas() {
    try {
        const resposta = await fetch('/api/ordens/resumo');
        if (!resposta.ok) throw new Error('Erro ao buscar métricas');

        const dados = await resposta.json();

        // Atualiza os valores na tela
        const elTotal = document.getElementById('qtdTotal');
        const elConcluidas = document.getElementById('qtdConcluidas');
        const elEmAndamento = document.getElementById('qtdEmAndamento');
        const elAtrasadas = document.getElementById('qtdAtrasadas');

        if (elTotal) elTotal.textContent = dados.total ?? 0;
        if (elConcluidas) elConcluidas.textContent = dados.concluidas ?? 0;
        if (elEmAndamento) elEmAndamento.textContent = dados.emAndamento ?? 0;
        if (elAtrasadas) elAtrasadas.textContent = dados.atrasadas ?? 0;
    } catch (erro) {
        console.error('Falha ao carregar métricas:', erro);
    }
}

// Executa ao carregar a página
document.addEventListener('DOMContentLoaded', carregarMetricas);
