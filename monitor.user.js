// ==UserScript==
// @name         Monitor de Packing Meli - V1.9.2
// @namespace    http://tampermonkey.net/
// @version      1.9.2
// @description  Mostra produtos faltantes, alerta de tempo, arrastável, GitHub update e Unfit Pre Packing
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
        btn.style.cursor = 'move'; 
        document.body.appendChild(btn);

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
            btn.innerText = "🔍 BUSCAR MOVIMENTOS AGORA";
            btn.style.background = '#2980b9';
            buscando = false;
        }, 3000);
    }

    async function verificarStatusTote(toteId, elementoVisual, ontem, hoje) {
        const urlEndereco = `https://wms.adminml.com/reports/address?address_from=${toteId}`;
        let qtdFaltante = 0;
        let achouQuantidade = false;

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
            } else {
                const tabelas = docEndereco.querySelectorAll('table');
                if (tabelas.length > 0) {
                    const tabela = tabelas[0];
                    const headers = Array.from(tabela.querySelectorAll('th')).map(th => th.innerText.trim().toLowerCase());
                    
                    let idxQtd = headers.findIndex(h => h.includes('quantidade total'));
                    
                    if (idxQtd !== -1) {
                        const linhas = tabela.querySelectorAll('tbody tr');
                        linhas.forEach(linha => {
                            const celulas = linha.querySelectorAll('td');
                            if (celulas.length > idxQtd) {
                                const val = parseInt(celulas[idxQtd].innerText.trim(), 10);
                                if (!isNaN(val)) {
                                    qtdFaltante += val;
                                    achouQuantidade = true;
                                }
                            }
                        });
                    }
                }
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
                    let isUnfit = false;
                    
                    let corHorario = "#8e44ad"; 

                    if (colunas.length >= 4) {
                        responsavel = colunas[colunas.length - 1].innerText.trim().split('\n')[0];
                        horario = colunas[colunas.length - 2].innerText.trim().split('\n')[0];
                        
                        // --- NOVA LÓGICA: IDENTIFICAR UNFIT PRE PACKING ---
                        let txtDestino = colunas[colunas.length - 3].innerText.trim();
                        let txtOrigem = colunas[colunas.length - 4].innerText.trim();
                        
                        // Se Origem e Destino tiverem "MU-TT-", é uma troca de caixas
                        if (txtOrigem.includes('MU-TT-') && txtDestino.includes('MU-TT-')) {
                            isUnfit = true;
                        }
                        // ----------------------------------------------------

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

                    // Define as cores com base no status (Unfit ou Packing normal)
                    elementoVisual.style.backgroundColor = isUnfit ? "#ffcdd2" : "#c8e6c9";
                    elementoVisual.style.border = isUnfit ? "3px solid #e53935" : "3px solid #2ecc71";
                    
                    let corTextoStatus = isUnfit ? "#c0392b" : "green";
                    let textoPrincipal = isUnfit ? "🚨 UNFIT PRE PACKING" : "☑ EM PACKING";
                    let textoStatusCompleto = textoPrincipal;

                    if (achouQuantidade && qtdFaltante > 0) {
                        let palavra = qtdFaltante === 1 ? 'produto' : 'produtos';
                        textoStatusCompleto = `${textoPrincipal} <span style="color: #555; font-size: 11px;">(faltam ${qtdFaltante} ${palavra})</span>`;
                    }

                    if (!elementoVisual.innerHTML.includes(textoStatusCompleto)) {
                        elementoVisual.innerHTML = `
                            <strong style="font-size: 14px;">${toteId}</strong><br>
                            <span style="color: ${corTextoStatus}; font-size: 13px; font-weight: bold;">${textoStatusCompleto}</span><br>
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
