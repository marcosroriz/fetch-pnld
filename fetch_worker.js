#!/usr/bin/env node

// Bibliotecas Node ////////////////////////////////////////////////////////////
const fs = require("fs");
const download = require("download");
const path = require("path");
const puppeteer = require("puppeteer");

// Constantes básicas //////////////////////////////////////////////////////////
const FNDE_URL = "https://www.fnde.gov.br/distribuicaosimadnet/popularMunicipio";
const codPrograma = "01"; // PNLD
const WAIT_PERIOD = 1000; // tempo de espera
const NUM_MAX_TENTATIVAS = 20; // número máximo de tentativas de baixar

// Funções auxiliares //////////////////////////////////////////////////////////
// Espera carregar a página
async function andWait(page, promise) {
    const [result] = await Promise.all([page.waitForNavigation({ waitUntil: "load", timeout: 120000 }), promise]);
    return result;
}

// Espera time milisegundos
function delay(time) {
    return new Promise(function (resolve) {
        setTimeout(resolve, time);
    });
}

// Rotina principal ////////////////////////////////////////////////////////////
module.exports = async ({ ano, esfera, estado, municipio }) => {
    let tentativas = 0;
    let browser;

    while (tentativas < NUM_MAX_TENTATIVAS) {
        try {
            browser = await puppeteer.launch({
                ignoreHTTPSErrors: true,
                timeout: 0,
            });

            if (tentativas > 0) {
                console.log("TENTATIVA", tentativas, estado, ano, esfera, municipio);
            }

            const page = await browser.newPage();
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3419.0 Safari/537.36");

            await page.waitForTimeout(WAIT_PERIOD);
            await andWait(page, page.goto(FNDE_URL, { waitUntil: "load", timeout: 120000 }));
            await page.waitForTimeout(WAIT_PERIOD / 4);

            await page.select("#anoProgramaSelecionado", ano);
            await page.waitForTimeout(WAIT_PERIOD / 4);

            await page.select("#codigoProgramaSelecionado", codPrograma);
            await page.waitForTimeout(WAIT_PERIOD / 4);

            await page.select("#confirmarCancelar_distribuicaoDTO_codigoEsferaSelecionado", esfera);
            await page.waitForTimeout(WAIT_PERIOD / 4);

            await page.select("#confirmarCancelar_distribuicaoDTO_ufSelecionada", estado);
            await page.waitForTimeout(2 * WAIT_PERIOD);

            await page.select("#municipio", municipio);
            await page.waitForTimeout(WAIT_PERIOD);

            await andWait(page, page.click("#confirmar"));
            await page.waitForTimeout(WAIT_PERIOD);

            let dados = [ano, codPrograma, esfera, estado, municipio];

            let paginaAtual = 1;
            let numeroTotalDePaginas = await page.evaluate(() => {
                if (document.getElementsByClassName("listagemPaginacao").length == 0) {
                    return 0;
                } else {
                    var totalPaginas = 1;
                    var tamanhoPaginacao = document.getElementsByClassName("listagemPaginacao")[0].lastChild.lastChild.children.length;

                    if (tamanhoPaginacao != 0) {
                        totalPaginas = document.getElementsByClassName("listagemPaginacao")[0].lastChild.lastChild.children[0].href.split("&")[0].split("=")[1];
                    }
                    return totalPaginas;
                }
            });

            let urlsParaSalvar = new Array();
            while (paginaAtual <= numeroTotalDePaginas) {
                let urlsDaPagina = await page.evaluate(() => {
                    var linhasTabela = document.getElementsByClassName("its")[0].children[1].children;
                    var linhasSalvar = new Array();
                    for (let linha of linhasTabela) {
                        let urlLinha = linha.lastChild.children[0].href;
                        let urlPlanilha = urlLinha.replace("selecionar", "criarArquivoExcelDistribuicao");
                        linhasSalvar.push(urlPlanilha);
                    }

                    return linhasSalvar;
                });

                urlsParaSalvar.push(...urlsDaPagina);
                // console.log("PAGINA ", paginaAtual, urlsDaPagina.length, "LINKS");
                // console.log(urlsDaPagina);

                // https://browsee.io/blog/puppeteer-how-to-find-a-link-element-with-a-certain-text/
                // https://stackoverflow.com/questions/50658540/use-puppeteer-to-search-for-element-based-on-inner-text
                if (paginaAtual < numeroTotalDePaginas && numeroTotalDePaginas != 1) {
                    let linkHandlers = await page.$x("//a[contains(text(), 'Próximo')]");
                    await andWait(page, linkHandlers[0].click());
                }
                paginaAtual++;
            }

            // console.log("COMPLETANDO MUNICIPIO ", codigoMunicipio, urlsParaSalvar.length, "LINKS");

            // Diretório de saída
            let outdir = path.join(__dirname, "out", estado, ano, esfera);
            if (!fs.existsSync(outdir)) {
                fs.mkdirSync(outdir, { recursive: true });
            }

            for (const url of urlsParaSalvar) {
                let urlParams = new URLSearchParams(url.split("?")[1]);
                let fsName = path.join(outdir, [...dados, urlParams.get("numeroEntidade")].join("_") + ".xls");
                // download(url).pipe(fs.createWriteStream(fsName));
                let down = await download(url);
                fs.writeFileSync(fsName, down);
            }
            // urlsParaSalvar.forEach((url) => {
            //     let urlParams = new URLSearchParams(url.split("?")[1]);
            //     let fsName = path.join(outdir, [...dados, urlParams.get("numeroEntidade")].join("_") + ".xls");
            //     // download(url).pipe(fs.createWriteStream(fsName));
            //     let down = await download(url);
            //     fs.writeFileSync(fsName, down);
            // });

            console.log("FINISHED", estado, ano, esfera, municipio, "NUMDELINKS", urlsParaSalvar.length);
            return Promise.resolve({
                estado,
                ano,
                esfera,
                municipio,
                status: 0,
                NUMDELINKS: urlsParaSalvar.length,
            });
        } catch (err) {
            if (tentativas < NUM_MAX_TENTATIVAS) {
                tentativas++;
            } else {
                console.log("------------------------");
                console.log("ERROR", estado, ano, esfera, municipio);
                return Promise.reject({ err, ano, esfera, estado, municipio });
            }
        } finally {
            if (browser) {
                await browser.close();
            }

            if (tentativas > 0) {
                await delay(WAIT_PERIOD);
            }
        }
    }
};
