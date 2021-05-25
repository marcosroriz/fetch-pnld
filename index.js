#!/usr/bin/env node

// Bibliotecas Node
const fs = require("fs");
const download = require("download");
const path = require("path");
const puppeteer = require("puppeteer");
const argv = require('minimist')(process.argv.slice(2));

// Variáveis básicas
const FNDE_URL = "https://www.fnde.gov.br/distribuicaosimadnet/popularMunicipio"
const WAIT_PERIOD = 1000;

let ano = "2020";
let codPrograma = "01"; // PNLD
let esfera = "1";
let estado = "GO";


(async () => {
    const browser = await puppeteer.launch({
        headless: false
    });
    const page = await browser.newPage();
    await page.goto(FNDE_URL, {
        waitUntil: "load"
    });
    await page.waitFor(WAIT_PERIOD);

    // let ano = "2020";
    // let codPrograma = "01"; // PNLD
    // let esfera = "1"; // Estadual
    // let estado = "GO"; // Estado
    let codigoMunicipio = "520870";

    await page.select('#anoProgramaSelecionado', ano)
    await page.waitFor(WAIT_PERIOD);

    await page.select('#codigoProgramaSelecionado', codPrograma)
    await page.waitFor(WAIT_PERIOD);

    await page.select('#confirmarCancelar_distribuicaoDTO_codigoEsferaSelecionado', esfera)
    await page.waitFor(WAIT_PERIOD);

    await page.select("#confirmarCancelar_distribuicaoDTO_ufSelecionada", estado);
    await page.waitFor(WAIT_PERIOD);


    let municipios = await page.evaluate(() => {
        let estadoBox = document.querySelectorAll('[name="distribuicaoDTO.codigoMunicipioSelecionado"]');
        let munValues = [...estadoBox[0].options].map(o => o.value)
        return munValues;
    });

    // Remover primeiro elemento, pois não é um município == select de escolher o município
    municipios.shift();

    page.on("error", function (err) {
        theTempValue = err.toString();
        console.log("Page error: " + theTempValue);
    })

    for (let codigoMunicipio of municipios) {
        await page.select("#municipio", codigoMunicipio);
        await page.waitFor(WAIT_PERIOD);

        await andWait(page, page.click("#confirmar"));


        if (codigoMunicipio == "520140") {
            console.log("PARIS")
        }

        let dados = [ano, codPrograma, esfera, estado, codigoMunicipio];

        let paginaAtual = 1;
        let numeroTotalDePaginas = await page.evaluate(() => {
            var totalPaginas = 1;
            var tamanhoPaginacao = document.getElementsByClassName("listagemPaginacao")[0].lastChild.lastChild.children.length;

            if (tamanhoPaginacao != 0) {
                totalPaginas = document.getElementsByClassName("listagemPaginacao")[0].lastChild.lastChild.children[0].href.split("&")[0].split("=")[1];
            }
            return totalPaginas;
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

            urlsParaSalvar.push(...urlsDaPagina)
            console.log("PAGINA ", paginaAtual, urlsDaPagina.length, "LINKS");
            console.log(urlsDaPagina);

            // https://browsee.io/blog/puppeteer-how-to-find-a-link-element-with-a-certain-text/
            // https://stackoverflow.com/questions/50658540/use-puppeteer-to-search-for-element-based-on-inner-text
            if (paginaAtual < numeroTotalDePaginas && numeroTotalDePaginas != 1) {
                let linkHandlers = await page.$x("//a[contains(text(), 'Próximo')]");
                // await linkHandlers[0].click();
                await andWait(page, linkHandlers[0].click());
            }
            paginaAtual++;
        }

        console.log("COMPLETANDO MUNICIPIO ", codigoMunicipio, urlsParaSalvar.length, "LINKS");

        // Diretório de saída
        let outdir = path.join(__dirname, "out", estado, ano, esfera, codigoMunicipio);
        if (!fs.existsSync(outdir)) {
            fs.mkdirSync(outdir, { recursive: true });
        }

        urlsParaSalvar.forEach(url => {
            let urlParams = new URLSearchParams(url.split("?")[1]);
            let fsName = path.join(outdir, [...dados, urlParams.get("numeroEntidade")].join("_") + ".xls")
            // fs.writeFileSync(fsName, await download(url));
            download(url).pipe(fs.createWriteStream(fsName));
        });
    }

    await page.screenshot({ path: 'example.png' });

    async function andWait(page, promise) {
        const [result] = await Promise.all([page.waitForNavigation(), promise]);

        return result;
    }

    // await browser.close();

    // var k = (document.getElementsByClassName("listagemPaginacao")[0].lastChild.lastChild.children[0].href)
    // document.getElementsByClassName("listagemPaginacao")[0].lastChild.lastChild.children[0].href.split("&")[0].split("=")[1]

    // var linhas = document.getElementsByClassName("its")[0].children[1].children
    // var urlPura = linhas[0].lastChild.children[0].href
})();
