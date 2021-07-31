#!/usr/bin/env node

// Bibliotecas Node ////////////////////////////////////////////////////////////
const path = require("path");
const walkSync = require("walk-sync");
const XLSX = require("xlsx");
const { createObjectCsvWriter } = require("csv-writer");

// Variáveis ///////////////////////////////////////////////////////////////////
const DIRENTRADA = "out";
const DIRSAIDA = "dados";
const ANO = 2010;
const CABECALHO_SAIDA = [
    { id: "ano", title: "ANO" },
    { id: "estado", title: "ESTADO" },
    { id: "codEstado", title: "COD_ESTADO" },
    { id: "municipio", title: "MUNICIPIO" },
    { id: "codMunicipio", title: "COD_MUNICIPIO" },
    { id: "esfera", title: "ESFERA" },
    { id: "codEsfera", title: "COD_ESFERA" },
    { id: "escola", title: "ESCOLA" },
    { id: "codEscola", title: "COD_ESCOLA" },
    { id: "codSeqEntidade", title: "COD_SEQENTIDADE" },
    { id: "tipoLocalizacao", title: "ESCOLA_TIPO_LOCALIZACAO" },
    { id: "campoIndigena", title: "ESCOLA_CAMPO_INDIGENA" },
    { id: "serieAno", title: "SERIE_ANO" },
    { id: "codObjeto", title: "COD_OBJETO" },
    { id: "objeto", title: "OBJETO" },
    { id: "qtde", title: "QUANTIDADE" },
];
// prettier-ignore
const ESTADOS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA",
                 "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ",
                 "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];

// Rotinas auxiliares //////////////////////////////////////////////////////////
function parseNomeArquivo(nomeArquivo) {
    let dadosBrutos = nomeArquivo.split("_");
    // Formato [ano, codPrograma, esfera, estado, municipio];
    let dados = {
        ano: Number(dadosBrutos[0].split("/").slice(-1)[0]),
        codPrograma: Number(dadosBrutos[1]),
        codEsfera: Number(dadosBrutos[2]),
        estado: dadosBrutos[3],
        codEstado: Number(String(dadosBrutos[4]).substr(0, 2)),
        codMunicipio: Number(dadosBrutos[4]),
        codSeqEntidade: String(dadosBrutos[5]).split(".")[0],
    };

    return dados;
}

function parseCabecalho(planilha) {
    let dados = {
        escola: String(planilha.B1?.v),
        cepEscola: String(planilha.B4?.v),
        codSeqEntidadePlanilha: String(planilha.B5.v),
        municipio: String(planilha.D3?.v),
        tipoLocalizacao: String(planilha.D4?.v),
        origemDados: String(planilha.D5?.v),
        campoIndigena: String(planilha.D7?.v),
        codEscola: Number(planilha.F4?.v),
        esfera: String(planilha.F5?.v),
    };

    return dados;
}

// Rotina principal ////////////////////////////////////////////////////////////

async function main() {
    let arquivos = [];
    for (let estado of ESTADOS) {
        let pathArquivo = DIRENTRADA + "/" + estado + "/" + String(ANO);

        let arquivoEstado = walkSync(pathArquivo, {
            includeBasePath: true,
            directories: false,
            globs: ["**/*.xls", "**/*.xlsx"],
        });
        arquivos.push(...arquivoEstado);
    }

    // let arrr = walkSync(DIRENTRADA, {
    //     includeBasePath: true,
    //     directories: false,
    //     globs: ["**/*.xls", "**/*.xlsx"],
    // });

    const csvWriter = createObjectCsvWriter({
        path: path.resolve(__dirname, DIRSAIDA, ANO + ".csv"),
        header: CABECALHO_SAIDA,
    });

    for (let arq of arquivos) {
        let planilhaExcel = XLSX.readFile(arq);
        let nomeDaFolha = planilhaExcel.SheetNames[0];
        let folhaPlanilha = planilhaExcel.Sheets[nomeDaFolha];

        let dadosBasicosMunicipio = parseNomeArquivo(arq);
        let dadosCabecalhoEscola = parseCabecalho(folhaPlanilha);

        // console.log(dadosBasicosMunicipio);
        // console.log(dadosCabecalhoEscola);

        let cabecalhoItens = ["serieAno", "objeto", "criterio", "qtde"];
        let dadosItensPlanilha = XLSX.utils.sheet_to_json(folhaPlanilha, { range: 10, header: cabecalhoItens });
        let regLimpar = /[^\u0000-\u007F|ºÂâÊêÎîÔôÃãÕõÁáÉéÓóÍíÇç]+/g;

        // Processar cada item comprado e colocando nos dados vetor de saída
        let dadosVetorSaida = [];

        let escola = "";

        for (let itemPlanilha of dadosItensPlanilha) {
            if ("serieAno" in itemPlanilha && "objeto" in itemPlanilha && "criterio" in itemPlanilha && "qtde" in itemPlanilha) {
                let dadosFinais = { ...dadosBasicosMunicipio, ...dadosCabecalhoEscola, ...itemPlanilha };
                dadosFinais["objeto"] = itemPlanilha["objeto"].replace(regLimpar, "").trim();
                dadosFinais["codObjeto"] = itemPlanilha["objeto"].split("-")[0].replace(regLimpar, "").trim();

                escola = dadosFinais["escola"];
                dadosVetorSaida.push(dadosFinais);
            }
        }

        console.log(dadosBasicosMunicipio["estado"], dadosCabecalhoEscola["municipio"], escola, "INICIEI ESCRITA");
        await csvWriter.writeRecords(dadosVetorSaida);
        console.log(dadosBasicosMunicipio["estado"], dadosCabecalhoEscola["municipio"], escola, "TERMINEI ESCRITA");
    }
    // console.log("estou aqui 4");
}

main();
