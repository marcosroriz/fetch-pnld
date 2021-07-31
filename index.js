#!/usr/bin/env node

// Bibliotecas Node ////////////////////////////////////////////////////////////
const path = require("path");
const Piscina = require("piscina");

// Thread Pool /////////////////////////////////////////////////////////////////
const piscinaMetadata = new Piscina({
    filename: path.resolve(__dirname, "fetch_metadata.js"),
    maxThreads: 4,
});

const piscinaBaixar = new Piscina({
    filename: path.resolve(__dirname, "fetch_worker.js"),
    maxThreads: 4,
});

// Variáveis ///////////////////////////////////////////////////////////////////
let anos = ["2010"];
let esferas = ["0", "1", "2", "3"];
// prettier-ignore
let estados = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA",
               "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ",
               "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];

// Rotina principal ////////////////////////////////////////////////////////////
(async function () {
    // Criar configurações que iremos baixar
    let dadosBaixar = [];
    for (let ano of anos) {
        for (let estado of estados) {
            for (let esfera of esferas) {
                console.log("Buscando os municipios de:", ano, estado, esfera);

                try {
                    const listaDeMunicipios = await piscinaMetadata.run({
                        ano,
                        esfera,
                        estado,
                    });
                    for (let municipio of listaDeMunicipios) {
                        dadosBaixar.push({ ano, estado, esfera, municipio });
                    }
                } catch (err) {
                    console.log(err)
                    console.log("METADATA ERROR", estado, ano, esfera);
                }
            }
        }
    }

    // debugger
    // console.log(dadosBaixar);
    for ({ ano, estado, esfera, municipio } of dadosBaixar) {
        piscinaBaixar.run({ ano, esfera, estado, municipio }).catch(({ err }) => {
            console.log("_____EXCEPTION", err);
        });
    }

    console.log("FINISHED");
})();
