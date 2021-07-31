#!/usr/bin/env node
// Retorna os municipios a serem baixados de um dado ano, esfera e estado

// Bibliotecas Node ////////////////////////////////////////////////////////////
const puppeteer = require("puppeteer");

// Constantes básicas //////////////////////////////////////////////////////////
const FNDE_URL = "https://www.fnde.gov.br/distribuicaosimadnet/popularMunicipio"; // URL
const codPrograma = "01"; // PNLD
const WAIT_PERIOD = 1000; // Tempo de Espera
const NUM_MAX_TENTATIVAS = 20; // número máximo de tentativas de baixar

// Funções auxiliares //////////////////////////////////////////////////////////
// Espera carregar a página
async function andWait(page, promise) {
    const [result] = await Promise.all([page.waitForNavigation({ waitUntil: "load", timeout: 0 }), promise]);
    return result;
}

// Espera time milisegundos
function delay(time) {
    return new Promise(function (resolve) {
        setTimeout(resolve, time);
    });
}


// Rotina principal ////////////////////////////////////////////////////////////
module.exports = async ({ ano, esfera, estado }) => {
    let tentativas = 0;

    let browser;
    while (tentativas < NUM_MAX_TENTATIVAS) {
        try {
            browser = await puppeteer.launch({
                ignoreHTTPSErrors: true,
                timeout: 0,
            });

            const page = await browser.newPage();
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3419.0 Safari/537.36");

            await page.waitForTimeout(WAIT_PERIOD);
            await andWait(page, page.goto(FNDE_URL, { waitUntil: "load", timeout: 0 }));
            await page.waitForTimeout(WAIT_PERIOD / 4);

            await page.select("#anoProgramaSelecionado", ano);
            await page.waitForTimeout(WAIT_PERIOD / 4);

            await page.select("#codigoProgramaSelecionado", codPrograma);
            await page.waitForTimeout(WAIT_PERIOD / 4);

            await page.select("#confirmarCancelar_distribuicaoDTO_codigoEsferaSelecionado", esfera);
            await page.waitForTimeout(WAIT_PERIOD / 4);

            await page.select("#confirmarCancelar_distribuicaoDTO_ufSelecionada", estado);
            await page.waitForTimeout(WAIT_PERIOD);

            let municipios = await page.evaluate(() => {
                let estadoBox = document.querySelectorAll('[name="distribuicaoDTO.codigoMunicipioSelecionado"]');
                let munValues = [...estadoBox[0].options].map((o) => o.value);
                return munValues;
            });

            // Remover primeiro elemento, pois não é um município == select de escolher o município
            municipios.shift();

            // Retorna os municipios a serem baixados
            return Promise.resolve(municipios);
        } catch (err) {
            if (tentativas < NUM_MAX_TENTATIVAS) {
                tentativas++;
            } else {
                console.log("------------------------");
                console.log("METADATA ERROR", estado, ano, esfera);
                console.log(err);
                console.log("------------------------");
                return Promise.reject({ err, ano, esfera, estado });
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
