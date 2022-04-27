// file_proc.js
// author: Naobumi SASAKI & Kentaro ITOKAWA
// date: 2022, 1. Mar

// global variables.
var resultTsvString;
var ident = [];
var traits = [];
var OutputFilename = 'trait-result.tsv';
var $identityFile = document.getElementById('inputGroupFile01_file');
var $identityFileButton = document.getElementById('inputGroupFile01_btn');
var $traitFile = document.getElementById('inputGroupFile02_file');
var $traitFileButton = document.getElementById('inputGroupFile02_btn');
var $submitButton = document.getElementById('submit_btn');
var $downloadButton = document.getElementById('download_btn');
var $toastLoadSuccess = document.getElementById('loadSuccess');
var $toastLoadFailed = document.getElementById('loadFailed');



// register event listener.
window.addEventListener('load', () => {
    $identityFile.addEventListener('change', () => {
      $identityFileButton.disabled = false;
    });
    $traitFile.addEventListener('change', () => {
      $traitFileButton.disabled = false;
    });
    $identityFileButton.addEventListener('click', load_identical);
    $traitFileButton.addEventListener('click', load_trait);
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
        fr.readAsText(file);// error process.
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
    const df = tsv_to_array(text.replace(/\r/g,''),'\t',true);
    var cleaned = df.filter( e => { return e.length > 1 });
    traits = [];
    cleaned.map((v) =>{
        traits.push({strain: v[0], trait: v[1]});
    });
    if(traits.length && ident.length){
      $traitFileButton.disabled = false;
      $submitButton.disabled = false;
    }
    //console.log(traits) // <DEBUG>
    return Promise.resolve(traits);
}

async function load_identical() 
{
    // load file.
    const fname = document.getElementById('inputGroupFile01_file')
    const file = fname.files[0];
    if(!file) return; // Notifitaion required.
    // get file contents.
    const text = await fetchAsText(file);
    // scan lines. skip first column.
    let df = tsv_to_array(text.replace(/\r/g,''),'\t',true);  
    ident = [];
    let strains =[];
    let cur_id;
    let iserr = false;
    for (let i in df){
      let [node, strain, dummy] = df[i];
      if(dummy){
        iserr = true; // flag toggled.
      };  
      if(node){
        if(cur_id){
          ident.push({node:cur_id, strains:strains});
          strains =[];
        }
        cur_id = node;
        strains.push(strain);
      }else{
        strains.push(strain);
      }
    }
    // push last element.
    //ident.push({node:cur_id, strains:strains});
    //console.log(ident); // <DEBUG>
    if(!iserr){
      let toast = new bootstrap.Toast($toastLoadSuccess);
      toast.show();
      if(traits.length){
        $submitButton.disabled = false;
      }
    }else{
      let toast = new bootstrap.Toast($toastLoadFailed);
      toast.show();
      ident = []; // reset Dictionary.       
    }
    return;
}

async function main_proc(ident, traits)
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
      if (!(allNodes.has(node))){
        allNodes.add(node);
      }
      for(let ii=0; ii < strains.length; ii++){
        let strain = strains[ii];
        //console.log(strain+":"+node); // <DEBUG>
        strain2node[strain] = node
      }
    }
    //console.log(strain2node); // <DEBUG>
    //console.log(allNodes); // <DEBUG>
    

    // scan trait data
    //console.log(traits); // <DEBUG>
    for (let i=0; i< traits.length; i++){
      let strain = traits[i].strain;
      let trait = traits[i].trait;
      strain2trait[strain] = trait;
      if(!allTraits.has(trait)){
        //console.log(strain+":"+trait); // <DEBUG>
        allTraits.add(trait);
      }
      if(!allStrains.has(strain)){
        allStrains.add(strain);
      }
    }
    console.log(strain2trait); // <DEBUG>

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
      if (!node){
        //console.log(strain); // <DEBUG>
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
    console.log(allTraits); // <DEBUG>  

    // format and push data to result array
    for (let node of allNodes){
      let tmp = {};
      tmp['node'] = node;
      for (let trait of allTraits){
        tmp[trait] = traitCounts[node][trait]
      }
      result.push(tmp);
    }

    return Promise.resolve(result);
}

async function process_files()
{
    if(ident && traits){
        var result = await main_proc(ident, traits);
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
    var outTxt ='';
    const header = result[0];
    const traitList = header.filter(n => n !== 'node');
    //let traitList = Object.keys(result[0]).slice(1);
    console.log(traitList); // <DEBUG>    
    let countList = result;
    outTxt += '\t' + traitList.join('\t') + '\n';
    //console.log(outTxt); // <DEBUG>
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
        a.download = OutputFilename;
        a.href = url;
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }
}