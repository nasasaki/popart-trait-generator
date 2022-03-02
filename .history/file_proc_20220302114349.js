// file_proc.js
// author: Naobumi SASAKI & Kentaro ITOKAWA
// date: 2022, 1. Mar

// global variables.
var resultTsvString;
var $identityFile = document.getElementById('inputGroupFile01_btn');
var $traitFile = document.getElementById('inputGroupFile02_btn');
var $submitButton = document.getElementById('submit_btn');
var $downloadButton = document.getElementById('download_btn');



// register event listener.
window.addEventListener('load', () => {
    $identityFile.addEventListener('click', load_identical);
    $traitFile.addEventListener('click', load_trait);
    $submitButton.addEventListener('click', process_files);
    $downloadButton.addEventListener('click', download_tsv);
});

// tsv scanner that store values into 2D array.
const tsv_to_array = (data, delimiter = '\t', omitFirstRow = false) =>
  data
    .slice(omitFirstRow ? data.indexOf('\n') + 1 : 0)
    .split('\n')
    .map(v => v.split(delimiter));

// returns Promise object.
var fetchAsText = (file) => {
    return new Promise((resolve) => {
        var fr = new FileReader();
        fr.onload = (ev) => {
            resolve(ev.currentTarget.result);
        };
        fr.readAsText(file);
    });
};

async function load_trait(ev)
{
    // load file.
    const fname = document.getElementById('inputGroupFile02_file')
    const file = fname.files[0];
    if(!file) return; // Notifitaion required.
    // get file contents.
    const text = await fetchAsText(file);
    const df = tsv_to_array(text,'\t',true);
    var traits = [];
    df.map((v) =>{
        traits.push({strain: v[0], trait: v[1]});
    });

    return traits;
}

async function load_identical() 
{
    const re = /^([\w\-\+:;\|/ ]+){0,1}\t([\w\-\+:;\|/ ]+){1}$/g;
    // load file.
    const fname = document.getElementById('inputGroupFile01_file')
    const file = fname.files[0];
    if(!file) return; // Notifitaion required.
    // get file contents.
    const text = await fetchAsText(file);
    // scan lines.
    let line = text.split('\n');
    for (let i in line){
      let [node, strain] = line[i].match(re) 
      console.log(node); // <DEBUG>
    }
    //console.log(strain); // <DEBUG>
    //Stub values.
    var ident = [
        {node:"6774",  strains:["6774", "6887"] },
        {node:"50343", strains:["50343", "202110177"]},
        {node:"21806180", strains:["21806180", "21806181", "21806185"]}
    ];

    return ident;
}

function main_proc(ident, traits)
{
    var traitCounts = {};       // key: node, value: hash counter
    var strain2node = {};       // key: strain, value: node
    var strain2trait = {};      // key: strain, value: trait

    var allNodes = new Set();   // uniq set of existing nodes
    var allTraits = new Set();  // uniq set of existing traits
    var allStrains = new Set(); // uniq set of existing strains

    var result = []; // result array

    // scan identity data
    for (let i=0; i< ident.length; i++){
      let strains = ident[i].strains;
      let node = ident[i].node;
      allNodes.add(node);
      for(let ii=0; ii < strains.length; ii++){
        let strain = strains[ii];
        strain2node[strain] = node
      }
    }

    // scan trait data
    for (let i=0; i< traits.length; i++){
      let strain = traits[i].strain;
      let trait = traits[i].trait;
      strain2trait[strain] = trait;
      allTraits.add(trait);
      allStrains.add(strain)
    }

    // initialize traitCounts with 0
    for(let node of allNodes){
      traitCounts[node] = {};
      for(let trait of allTraits){
        traitCounts[node][trait] = 0
      }
    }

    // counting
    for(let strain of allStrains){
      let node = strain2node[strain];
      if (node == undefined){
        node = strain;
        allNodes.add(node);
        traitCounts[node] = {};
        for(let trait of allTraits){
          traitCounts[node][trait] = 0
        }
      }
      let trait = strain2trait[strain];
      traitCounts[node][trait]++;
    }

    // format and push data to result array
    for (let node of allNodes){
      let tmp = {};
      tmp['node'] = node;
      for (let trait of allTraits){
        tmp[trait] = traitCounts[node][trait]
      }
      result.push(tmp);
    }
    return result;
}

function process_files()
{
    // 基本的に例外処理はルーチン内で実施。
    let ident = load_identical();
    let traits = load_trait();
    if(ident && traits){
        var result = main_proc(ident, traits);
    }
    if(result){
        resultTsvString = reform_output(result);
    }
    if(resultTsvString){
        $downloadButton.disabled = false;
        //window.sessionStorage.setItem <- onsubmitの場合はsession変数にする必要がある。
    }
}
function reform_output(result)
{
    var outTxt = '';
    let traitList = ["KE", "CB", "KW", "HO", "REF"];
    let countList = result;
    outTxt += '\t' + traitList.join('\t') + '\n';
    for(let i=0; i< countList.length; i++){
      let count = countList[i];
      let tmp = [];
      tmp.push(count.node)
      for(let ii=0;ii< traitList.length; ii++){
        let trait = traitList[ii];
        tmp.push(count[trait]);
      }
      outTxt += tmp.join('\t') + '\n'
    }
 
    return outTxt;
}

function download_tsv()
{
    if(resultTsvString){
        let blob = new Blob([resultTsvString], {type:"text/plain"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a")
        document.body.appendChild(a);
        a.download = 'result.tsv';
        a.href = url;
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }
}