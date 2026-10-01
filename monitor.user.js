// ==UserScript==
// @name         Monitor de Packing Meli - V1.8.3 (Botão Móvel + Alerta de Tempo)
// @namespace    http://tampermonkey.net/
// @version      1.8.3
// @description  Detecta mudanças, varre novas caixas, botão arrastável e alerta de tempo inativo
// @match        https://wms.adminml.com/reports/units/totes*
// @updateURL    https://github.com/dinizalessandro537-hub/monitor-packing-meli/raw/refs/heads/main/monitor.user.js
// @downloadURL  https://github.com/dinizalessandro537-hub/monitor-packing-meli/raw/refs/heads/main/monitor.user.js
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let buscando = false;

    setTimeout(async () => {
        let btn = document.createElement('button');
        // --- MUDANÇA VISUAL PARA O TESTE DE ATUALIZAÇÃO ---
        btn.innerText = "🚀 V1.8.3 - ATUALIZADO";
        btn.style.position = 'fixed';
        btn.style.bottom = '20px';
        btn.style.left = '20px';
        btn.style.zIndex = '999999';
        btn.style.padding = '15px';
        btn.style.background = '#8e44ad'; // Mudou para Roxo para destacar a atualização
        btn.style.color = 'white';
        btn.style.fontWeight = 'bold';
        btn.style.border = 'none';
        btn.style.borderRadius = '5px';
        btn.style.cursor = 'move'; 
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
                btn.style.bottom = 'auto'; 
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

        btn.onclick = async function(e) {
            if (isDragging) {
                e.preventDefault();
                return;
            }
            if (!buscando) {
                await iniciarVarreduraCompleta(btn);
            }
        };

        setInterval(() => {
            buscarCaixasNovasNaTela();
        }, 2000);

        setInterval(async () => {
            if (!buscando) {
                await iniciarVarreduraCompleta(btn);
            }
        }, 40000);

        if (!buscando) {
            await iniciarVarreduraCompleta(btn);
        }

    }, 2000);

    function buscarCaixasNovasNaTela() {
        const hoje = new Date().toISOString().split('T')[0];
        let dataOntem = new Date();
        dataOntem.setDate(dataOntem.getDate() - 2);
        const ontem = dataOntem.toISOString().split('T')[0];

        const celulas = document.querySelectorAll('td');

        for (let celula of celulas) {
            const texto = celula.innerText.trim();

            if (texto.includes('MU-TT-') && celula.getAttribute('data-status-verificado') !== 'sim') {
                const toteId = texto.split('\n')[0];
                celula.setAttribute('data-status-verificado', 'sim');
                celula.style.border = "2px solid orange";
                verificarStatusTote(toteId, celula, ontem, hoje);
            }
        }
    }

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
                celula.setAttribute('data-status-verificado', 'sim'); 
                celula.style.border = "2px solid orange";
                await verificarStatusTote(toteId, celula, ontem, hoje);
            }
        }

        btn.innerText = "✅ BUSCA CONCLUÍDA";
        btn.style.background = '#27ae60';

        setTimeout(() => {
            btn.innerText = "🚀 V1.8.3 - ATUALIZADO";
            btn.style.background = '#8e44ad';
            buscando = false;
        }, 3000);
    }

    async function verificarStatusTote(toteId, elementoVisual, ontem, hoje) {
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
                if (!elementoVisual.innerHTML.includes('TOTE TERMINADO')) {
                    elementoVisual.innerHTML = `
                        <strong style="font-size: 14px;">${toteId}</strong><br>
                        <span style="color: #1565c0; font-size: 13px; font-weight: bold;">🏆 TOTE TERMINADO</span>
                    `;
                }
                return;
            }

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
                    let corHorario = "#8e44ad"; 

                    if (colunas.length >= 2) {
                        responsavel = colunas[colunas.length - 1].innerText.trim().split('\n')[0];
                        horario = colunas[colunas.length - 2].innerText.trim().split('\n')[0];
                        
                        let partesHorario = horario.split(' ');
                        if (partesHorario.length === 2) {
                            let partesData = partesHorario[0].split('/');
                            let partesTempo = partesHorario[1].split(':');
                            
                            if (partesData.length === 3 && partesTempo.length >= 2) {
                                let dataBip = new Date(partesData[2], partesData[1] - 1, partesData[0], partesTempo[0], partesTempo[1], partesTempo[2] || 0);
                                let tempoAtual = new Date();
                                let diferencaMinutos = (tempoAtual - dataBip) / 1000 / 60;
                                
                                if (diferencaMinutos > 30) {
                                    corHorario = "red"; 
                                } else if (diferencaMinutos > 15) {
                                    corHorario = "#d35400"; 
                                }
                            }
                        }
                    }

                    elementoVisual.style.backgroundColor = "#c8e6c9";
                    elementoVisual.style.border = "3px solid #2ecc71";

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
