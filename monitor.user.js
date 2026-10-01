// ==UserScript==
// @name         Monitor de Packing Meli - V1.8.2 (Botão Móvel + Alerta de Tempo)
// @namespace    http://tampermonkey.net/
// @version      1.8.2
// @description  Detecta mudanças, varre novas caixas, botão arrastável e alerta de tempo inativo
// @match        https://wms.adminml.com/reports/units/totes*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let buscando = false;

    setTimeout(async () => {
        let btn = document.createElement('button');
        btn.innerText = "🔍 BUSCAR MOVIMENTOS AGORA";
        btn.style.position = 'fixed';
        btn.style.bottom = '20px';
        btn.style.left = '20px';
        btn.style.zIndex = '999999';
        btn.style.padding = '15px';
        btn.style.background = '#2980b9';
        btn.style.color = 'white';
        btn.style.fontWeight = 'bold';
        btn.style.border = 'none';
        btn.style.borderRadius = '5px';
        btn.style.cursor = 'move'; // Muda o mouse para indicar que é arrastável
        document.body.appendChild(btn);

        // --- INÍCIO DA LÓGICA DO BOTÃO MÓVEL ---
        let isDragging = false;
        let startPosX = 0, startPosY = 0;

        btn.addEventListener('mousedown', function(e) {
            isDragging = false;
            startPosX = e.clientX - btn.getBoundingClientRect().left;
            startPosY = e.clientY - btn.getBoundingClientRect().top;
            
            function onMouseMove(eMove) {
                isDragging = true;
                btn.style.bottom = 'auto'; // Remove o travamento no fundo
                btn.style.right = 'auto';
                btn.style.left = (eMove.clientX - startPosX) + 'px';
                btn.style.top = (eMove.clientY - startPosY) + 'px';
            }
            
            function onMouseUp() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
        // --- FIM DA LÓGICA DO BOTÃO MÓVEL ---

        // Modificamos o onclick para não pesquisar se o usuário estiver apenas arrastando
        btn.onclick = async function(e) {
            if (isDragging) {
                e.preventDefault();
                return;
            }
            if (!buscando) {
                await iniciarVarreduraCompleta(btn);
            }
        };

        // RADAR RÁPIDO: A cada 2 segundos, olha se apareceram caixas NOVAS na tela (mudança de página)
        setInterval(() => {
            buscarCaixasNovasNaTela();
        }, 2000);

        // RADAR COMPLETO: A cada 40 segundos, re-verifica tudo para atualizar os tempos
        setInterval(async () => {
            if (!buscando) {
                await iniciarVarreduraCompleta(btn);
            }
        }, 40000);

        // Início automático ao carregar a página
        if (!buscando) {
            await iniciarVarreduraCompleta(btn);
        }

    }, 2000);

    // Função que fica de olho se você mudou de página ou aba
    function buscarCaixasNovasNaTela() {
        const hoje = new Date().toISOString().split('T')[0];
        let dataOntem = new Date();
        dataOntem.setDate(dataOntem.getDate() - 2);
        const ontem = dataOntem.toISOString().split('T')[0];

        const celulas = document.querySelectorAll('td');

        for (let celula of celulas) {
            const texto = celula.innerText.trim();

            // Se for um Tote e ainda NÃO tiver a marcação "verificado" do nosso script
            if (texto.includes('MU-TT-') && celula.getAttribute('data-status-verificado') !== 'sim') {
                const toteId = texto.split('\n')[0];

                // Marca a célula para o radar rápido não pesquisar ela duas vezes seguidas
                celula.setAttribute('data-status-verificado', 'sim');
                celula.style.border = "2px solid orange";

                // Dispara a verificação dessa caixa específica no fundo
                verificarStatusTote(toteId, celula, ontem, hoje);
            }
        }
    }

    // Função pesada que verifica tudo (acionada no clique ou a cada 40s)
    async function iniciarVarreduraCompleta(btn) {
        buscando = true;
        btn.innerText = "⏳ PESQUISANDO...";
        btn.style.background = '#f39c12';

        const hoje = new Date().toISOString().split('T')[0];
        let dataOntem = new Date();
        dataOntem.setDate(dataOntem.getDate() - 2);
        const ontem = dataOntem.toISOString().split('T')[0];

        const celulas = document.querySelectorAll('td');

        for (let celula of celulas) {
            const texto = celula.innerText.trim();

            if (texto.includes('MU-TT-')) {
                const toteId = texto.split('\n')[0];
                celula.setAttribute('data-status-verificado', 'sim'); // Marca como verificado
                celula.style.border = "2px solid orange";

                await verificarStatusTote(toteId, celula, ontem, hoje);
            }
        }

        btn.innerText = "✅ BUSCA CONCLUÍDA";
        btn.style.background = '#27ae60';

        setTimeout(() => {
            btn.innerText = "🔍 BUSCAR MOVIMENTOS AGORA";
            btn.style.background = '#2980b9';
            buscando = false;
        }, 3000);
    }

    async function verificarStatusTote(toteId, elementoVisual, ontem, hoje) {
        // PASSO 1: Verifica se a caixa já terminou (Link de Endereço)
        const urlEndereco = `https://wms.adminml.com/reports/address?address_from=${toteId}`;

        try {
            const respostaEndereco = await fetch(urlEndereco);
            const htmlEndereco = await respostaEndereco.text();

            const parser = new DOMParser();
            const docEndereco = parser.parseFromString(htmlEndereco, 'text/html');

            docEndereco.querySelectorAll('script, style, template').forEach(el => el.remove());
            const textoVisivelEndereco = docEndereco.body ? docEndereco.body.textContent : "";

            if (textoVisivelEndereco.includes('Nenhum resultado encontrado')) {

                elementoVisual.style.backgroundColor = "#e3f2fd";
                elementoVisual.style.border = "3px solid #1e88e5";

                // --- FONTES AUMENTADAS PARA TOTE TERMINADO ---
                if (!elementoVisual.innerHTML.includes('TOTE TERMINADO')) {
                    elementoVisual.innerHTML = `
                        <strong style="font-size: 14px;">${toteId}</strong><br>
                        <span style="color: #1565c0; font-size: 13px; font-weight: bold;">🏆 TOTE TERMINADO</span>
                    `;
                }
                return;
            }

            // PASSO 2: Se não está vazia, verifica se está em Packing (Link de Movimentos)
            const urlMovimentos = `https://wms.adminml.com/reports/movements?limit=50&offset=0&sort=date_desc&date_from=${ontem}&date_to=${hoje}&storage_id=${toteId}`;

            const respostaMov = await fetch(urlMovimentos);
            const htmlMov = await respostaMov.text();

            const docMovimentos = parser.parseFromString(htmlMov, 'text/html');
            const tabelaMovimentos = docMovimentos.querySelector('tbody');

            if (tabelaMovimentos) {
                const primeiraLinha = tabelaMovimentos.querySelector('tr');

                if (primeiraLinha && primeiraLinha.innerText.toUpperCase().includes('PACKING')) {
                    const colunas = primeiraLinha.querySelectorAll('td');
                    let responsavel = "Desconhecido";
                    let horario = "Sem hora";
                    
                    // --- NOVA LÓGICA DE COR DO HORÁRIO ---
                    let corHorario = "#8e44ad"; // Roxo padrão

                    if (colunas.length >= 2) {
                        responsavel = colunas[colunas.length - 1].innerText.trim().split('\n')[0];
                        horario = colunas[colunas.length - 2].innerText.trim().split('\n')[0];
                        
                        // Tenta extrair e calcular o tempo
                        // Formato esperado: DD/MM/YYYY HH:MM:SS
                        let partesHorario = horario.split(' ');
                        if (partesHorario.length === 2) {
                            let partesData = partesHorario[0].split('/');
                            let partesTempo = partesHorario[1].split(':');
                            
                            if (partesData.length === 3 && partesTempo.length >= 2) {
                                // Cria um objeto de Data (Ano, Mês [0-11], Dia, Hora, Minuto, Segundo)
                                let dataBip = new Date(partesData[2], partesData[1] - 1, partesData[0], partesTempo[0], partesTempo[1], partesTempo[2] || 0);
                                let tempoAtual = new Date();
                                
                                // Diferença em minutos
                                let diferencaMinutos = (tempoAtual - dataBip) / 1000 / 60;
                                
                                if (diferencaMinutos > 30) {
                                    corHorario = "red"; // Mais de 30 min parado
                                } else if (diferencaMinutos > 15) {
                                    corHorario = "#d35400"; // Laranja escuro (mais de 15 min)
                                }
                            }
                        }
                    }

                    elementoVisual.style.backgroundColor = "#c8e6c9";
                    elementoVisual.style.border = "3px solid #2ecc71";

                    // --- FONTES AUMENTADAS PARA PACKING COM COR DINÂMICA ---
                    if (!elementoVisual.innerHTML.includes('EM PACKING')) {
                        elementoVisual.innerHTML = `
                            <strong style="font-size: 14px;">${toteId}</strong><br>
                            <span style="color: green; font-size: 13px; font-weight: bold;">☑ EM PACKING</span><br>
                            <span style="color: #2980b9; font-size: 15px; font-weight: bold;">👤 ${responsavel}</span><br>
                            <span style="color: ${corHorario}; font-size: 14px; font-weight: bold;">🕒 ${horario}</span>
                        `;
                    }
                } else {
                    elementoVisual.style.border = "none";
                }
            } else {
                elementoVisual.style.border = "none";
            }
        } catch (erro) {
            console.log("Erro ao buscar o Tote: ", toteId);
            elementoVisual.style.border = "2px solid red";
        }
    }
})();
