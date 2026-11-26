/* ===== Obrador · ampliació: control de gestió d'obra, estudis i serveis d'empresa ===== */
const CAPITOLS=["Implantació i mitjans auxiliars","Bastides i proteccions","Repicat i neteja","Reparació de suport","Fons i morters","Estucat i acabats","Pintura i tractaments","Fusteria i serralleria","Residus i gestió ambiental","Seguretat i salut","Modificats / addicionals"];
const UNITATS=["m²","m","ml","ut","h","kg","m³","PA"];
const EXPK=["prl","aptitud","habilitacio","rc","ss","hisenda","validesa"];

Object.assign(TONE,{'Presentada':'info','Conformada':'ok','Facturada':'warn','Proposat':'neu','Presentat al client':'info','Rebutjat':'bad','Executat':'ok','Preseleccionada':'info','Descartada':'neu','Revisió':'warn','Entregat':'ok','Tancat':'neu','Oberta':'bad','En tractament':'warn','Lleu':'neu','Moderada':'warn','Greu':'bad','Actiu':'ok','Inactiu':'neu','Homologat':'ok','En avaluació':'warn','No apte':'bad','Complet':'ok','Parcial':'warn','No definit':'bad'});
Object.assign(S,{partides:[],certificacions:[],modificats:[],ofertes:[],estudis:[],qualitat:[],personal:[],tercers:[]});

Object.assign(M,{
 partides:{t:"Partides",s:"partida",tit:"descripcio",sort:"codi",camps:[
  {k:"obraId",l:"Obra",tp:"obra",req:1},{k:"codi",l:"Codi partida",tp:"code",req:1,ph:"REP.01"},
  {k:"capitol",l:"Capítol",tp:"sel",o:CAPITOLS,blank:1},{k:"descripcio",l:"Descripció",tp:"text",req:1,w:1},
  {k:"unitat",l:"Unitat",tp:"sel",o:UNITATS},{k:"amidament",l:"Amidament contractat",tp:"num"},
  {k:"preuVenda",l:"Preu de venda (€/ud)",tp:"money",d:2},{k:"costUnit",l:"Cost previst (€/ud)",tp:"money",d:2},
  {k:"executat",l:"Executat acumulat (ud)",tp:"num"},{k:"costReal",l:"Altres costos reals (€) — a més de les factures",tp:"money"}],
  cols:["codi","obraId","descripcio","unitat","amidament",{l:"Preu",num:1,f:o=>MF2.format(+o.preuVenda||0)},
   {l:"% exec.",f:o=>progHtml(ptc(o).pct)},{l:"Produït",num:1,f:o=>fmtM(ptc(o).produit)},
   {l:"Cost real",num:1,f:o=>fmtM(costRealDe(o))},{l:"Desviació cost",num:1,f:o=>devHtml(ptc(o).desv)},
   {l:"Marge final prev.",num:1,f:o=>pctHtml(ptc(o).margeF)}]},
 certificacions:{t:"Certificacions",s:"certificació",tit:"num",sort:"num",camps:[
  {k:"obraId",l:"Obra",tp:"obra",req:1},{k:"num",l:"Núm. certificació",tp:"num",req:1},
  {k:"data",l:"Data de la certificació",tp:"date"},{k:"origen",l:"Import a origen (sense IVA)",tp:"money"},
  {k:"estat",l:"Estat",tp:"sel",o:["Esborrany","Presentada","Conformada","Facturada","Cobrada"]},
  {k:"notes",l:"Notes",tp:"area",w:1}],
  cols:["num","obraId","data","origen",{l:"Aquest període",num:1,f:o=>fmtM(certPer(o))},"estat"]},
 modificats:{t:"Partides contradictòries",s:"contradictòria",tit:"descripcio",sort:"codi",camps:[
  {k:"obraId",l:"Obra",tp:"obra",req:1},{k:"codi",l:"Codi",tp:"code",req:1,ph:"PC.01"},
  {k:"capitol",l:"Capítol",tp:"text",ph:"Tria'l o escriu-ne un de nou"},{k:"descripcio",l:"Descripció",tp:"text",req:1,w:1},
  {k:"estat",l:"Estat",tp:"sel",o:["Proposat","Presentat al client","Aprovat","Rebutjat","Executat"]},{k:"unitat",l:"Unitat",tp:"sel",o:UNITATS},
  {k:"amidament",l:"Amidament",tp:"num"},{k:"preuVenda",l:"Preu de venda (€/ud)",tp:"money",d:2},{k:"costUnit",l:"Cost previst (€/ud)",tp:"money",d:2},
  {k:"executat",l:"Executat acumulat (ud)",tp:"num"},{k:"costReal",l:"Altres costos reals (€) — a més de les factures",tp:"money"},
  {k:"data",l:"Data",tp:"date"},{k:"dies",l:"Impacte en termini (dies)",tp:"num"},{k:"notes",l:"Notes",tp:"area",w:1}],
  cols:["codi","descripcio","unitat","amidament",{l:"Preu",num:1,f:o=>MF2.format(+o.preuVenda||0)},{l:"Import",num:1,f:o=>fmtM(o.import)},
   {l:"% exec.",f:o=>progHtml(ptc(o).pct)},{l:"Produït",num:1,f:o=>fmtM(ptc(o).produit)},{l:"Marge final prev.",num:1,f:o=>pctHtml(ptc(o).margeF)},"estat"]},
 ofertes:{t:"Comparatius d'ofertes",s:"oferta",tit:"proveidor",camps:[
  {k:"comparatiu",l:"Concepte a comparar",tp:"text",req:1,w:1,ph:"Repicat i estucat façana nord"},
  {k:"obraId",l:"Obra",tp:"obra"},{k:"proveidor",l:"Proveïdor / subcontractista",tp:"text",req:1},
  {k:"import",l:"Import ofertat (sense IVA)",tp:"money",req:1},
  {k:"ajust",l:"Ajust per homogeneïtzar l'abast (€)",tp:"money"},
  {k:"abast",l:"Abast",tp:"sel",o:["Complet","Parcial","No definit"]},
  {k:"exclusions",l:"Exclusions / què cal afegir",tp:"area",w:1,ph:"Bastides, mitjans auxiliars, gestió de residus, transport, assegurança, mitjans de seguretat…"},
  {k:"termini",l:"Termini d'execució (dies)",tp:"num"},{k:"pagament",l:"Forma de pagament",tp:"text",ph:"Confirming 60 dies"},
  {k:"garantia",l:"Retenció de garantia (%)",tp:"pct"},{k:"validesa",l:"Validesa de l'oferta",tp:"date"},
  {k:"estat",l:"Estat",tp:"sel",o:["Rebuda","Preseleccionada","Adjudicada","Descartada"]},
  {k:"notes",l:"Condicions i observacions (CAE, PRL, solvència…)",tp:"area",w:1}],
  cols:[]},
 estudis:{t:"Estudis de costos i licitació",s:"fitxa d'estudi",tit:"nom",camps:[
  {k:"nom",l:"Estudi / projecte",tp:"text",req:1,w:1},
  {k:"tipus",l:"Tipus",tp:"sel",o:["Estudi de costos","Estudi de licitació","Estudi de viabilitat","Planificació i terminis","Revisió d'amidaments","Estudi de seguretat i salut","Estudi de residus"]},
  {k:"obraId",l:"Obra (si ja existeix)",tp:"obra"},{k:"client",l:"Client",tp:"text"},
  {k:"estat",l:"Estat",tp:"sel",o:["Pendent","En curs","Revisió","Entregat","Tancat"]},{k:"responsable",l:"Responsable",tp:"text"},
  {k:"entrega",l:"Data d'entrega",tp:"date"},{k:"costDirecte",l:"Cost directe (PEM)",tp:"money"},
  {k:"dg",l:"Despeses generals (%)",tp:"pct"},{k:"bi",l:"Benefici industrial (%)",tp:"pct"},{k:"baixa",l:"Baixa (%)",tp:"pct"},
  {k:"notes",l:"Hipòtesis, exclusions i riscos",tp:"area",w:1}],
  cols:["nom","tipus","client","entrega",{l:"Preu oferta",num:1,f:o=>fmtM(estC(o).oferta)},{l:"Benefici",num:1,f:o=>pctHtml(estC(o).biPct)},"estat"]},
 qualitat:{t:"Qualitat i seguretat",s:"anotació",tit:"descripcio",camps:[
  {k:"data",l:"Data",tp:"date",req:1},{k:"obraId",l:"Obra",tp:"obra"},
  {k:"tipus",l:"Tipus",tp:"sel",o:["Xerrada de seguretat","Acta CAE","Inspecció de seguretat","Visita de qualitat","No conformitat","Incidència","Quasi-accident","Accident"]},
  {k:"gravetat",l:"Gravetat",tp:"sel",o:["Lleu","Moderada","Greu"]},
  {k:"descripcio",l:"Descripció",tp:"text",req:1,w:1},{k:"participants",l:"Participants / empreses",tp:"text",w:1},
  {k:"accio",l:"Acció correctora / acords",tp:"area",w:1},
  {k:"responsable",l:"Responsable",tp:"text"},{k:"termini",l:"Termini de l'acció",tp:"date"},
  {k:"estat",l:"Estat",tp:"sel",o:["Oberta","En tractament","Tancada"]}],
  cols:["data","obraId","tipus","descripcio","gravetat","responsable","termini","estat"]},
 personal:{t:"Personal i formació",s:"fitxa de personal",tit:"nom",camps:[
  {k:"nom",l:"Nom i cognoms",tp:"text",req:1,w:1},
  {k:"categoria",l:"Categoria",tp:"sel",o:["Cap d'obra","Encarregat","Oficial 1a","Oficial 2a","Peó","Gruista","Electricista","Lampista","Tècnic","Administració"]},
  {k:"vinculacio",l:"Vinculació",tp:"sel",o:["Plantilla","Autònom","ETT","Subcontracta"]},
  {k:"obraId",l:"Obra actual",tp:"obra",none:"Sense assignar"},{k:"costHora",l:"Cost hora (€)",tp:"money",d:2},
  {k:"estat",l:"Estat",tp:"sel",o:["Actiu","Inactiu"]},
  {k:"prl",l:"Formació PRL (venciment)",tp:"date"},{k:"aptitud",l:"Aptitud laboral (venciment)",tp:"date"},
  {k:"habilitacio",l:"Carnets i habilitacions (venciment)",tp:"date"},
  {k:"notes",l:"Notes",tp:"area",w:1}],
  cols:["nom","categoria","vinculacio","obraId","costHora","prl","aptitud","habilitacio","estat"]},
 tercers:{t:"Subcontractistes i proveïdors",s:"empresa",tit:"nom",camps:[
  {k:"nom",l:"Raó social",tp:"text",req:1,w:1},{k:"nif",l:"NIF",tp:"text"},
  {k:"tipus",l:"Tipus",tp:"sel",o:["Subcontractista","Proveïdor de materials","Lloguer de maquinària","Bastides i mitjans auxiliars","Gestor de residus","Serveis tècnics"]},
  {k:"especialitat",l:"Especialitat",tp:"text",ph:"Repicat, estucat, pintura…"},
  {k:"contacte",l:"Persona de contacte",tp:"text"},{k:"telefon",l:"Telèfon",tp:"text"},{k:"email",l:"Correu",tp:"text"},
  {k:"estat",l:"Homologació",tp:"sel",o:["En avaluació","Homologat","No apte"]},
  {k:"valoracio",l:"Valoració",tp:"sel",o:["Sense valorar","Excel·lent","Bona","Acceptable","Deficient"]},
  {k:"rc",l:"Assegurança RC (venciment)",tp:"date"},{k:"ss",l:"Certificat Seg. Social (venciment)",tp:"date"},
  {k:"hisenda",l:"Certificat Hisenda (venciment)",tp:"date"},{k:"rea",l:"Inscrit al REA",tp:"sel",o:["Per verificar","Sí","No"]},
  {k:"notes",l:"Notes",tp:"area",w:1}],
  cols:["nom","tipus","especialitat","contacte","rc","ss","hisenda","valoracio","estat"]}
});
COLS.push("partides","certificacions","modificats","ofertes","estudis","qualitat","personal","tercers");

/* Navegació */
(function(){
 const ic={
  gestio:"M3 3v18h18M7 15l4-4 3 3 5-6",
  partides:"M5 21V10M12 21V3M19 21v-7",
  cert:"M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5",
  mod:"M12 5v14M5 12h14M3 3h18v18H3z",
  est:"M6 3h12v18H6zM9 7h6M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01",
  of:"M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z",
  terc:"M4 21V4h10v17M14 9h6v12M7 8h4M7 12h4M7 16h4",
  pers:"M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a3 3 0 1 0 0-6M21 20a6 6 0 0 0-4-5.6",
  qual:"M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4"
 };
 const i=NAV.findIndex(g=>g.g==="Documents");
 NAV.splice(i,0,
  {g:"Control d'obra",items:[["gestio","Control de gestió",ic.gestio],["partides","Partides",ic.partides],["certificacions","Certificacions",ic.cert],["modificats","Contradictòries",ic.mod]]},
  {g:"Estudis",items:[["estudis","Estudis de costos",ic.est],["ofertes","Comparatius d'ofertes",ic.of]]});
 const g=NAV.find(x=>x.g==="Gestió");g.g="Empresa i gestió";
 g.items.push(["tercers","Subcontractistes",ic.terc],["personal","Personal i formació",ic.pers],["qualitat","Qualitat i seguretat",ic.qual]);
 const s=document.createElement("style");
 s.textContent="tr.best td{background:color-mix(in srgb,var(--ok) 9%,transparent)}.small{font-size:12px;color:var(--muted)}";
 document.head.appendChild(s);
})();

/* ---------- Helpers de presentació ---------- */
function expHtml(v){
  if(!v)return '<span class="muted">—</span>';
  const s=fmtD(v);
  if(v<today())return `<span style="color:var(--bad);font-weight:600" title="Vençut">${s}</span>`;
  if(v<=addDays(30))return `<span style="color:var(--warn);font-weight:600" title="Venç en menys de 30 dies">${s}</span>`;
  return s;
}
const devHtml=v=>v==null?'<span class="muted">—</span>':`<span style="color:${v>0?'var(--bad)':v<0?'var(--ok)':'inherit'}">${v>0?'+':''}${fmtM(v)}</span>`;
const pctHtml=v=>v==null?'<span class="muted">—</span>':`<span style="color:${v<0?'var(--bad)':'var(--ok)'}">${fmtN(v*100)}%</span>`;
const eyeb=mk=>['obres','tasques','parts'].includes(mk)?'Obra':['partides','certificacions','modificats'].includes(mk)?"Control d'obra":['estudis','ofertes'].includes(mk)?'Estudis':['qualitat','personal','tercers'].includes(mk)?'Empresa':'Gestió';

/* ---------- Càlculs ---------- */
/* Cost real d'una partida: el que s'hi entra a mà més les factures que s'hi imputen */
const imputatA=id=>sum(S.factures.filter(f=>f.sentit==='Rebuda'&&f.estat!=='Esborrany'),f=>sum((f.imputacions||[]).filter(i=>i.id===id),i=>+i.import));
const costRealDe=p=>(+p.costReal||0)+(p.id?imputatA(p.id):0);
function ptc(p){
  const am=+p.amidament||0,pv=+p.preuVenda||0,cu=+p.costUnit||0,ex=+p.executat||0,cr=costRealDe(p);
  const venda=am*pv,costPrev=am*cu,produit=ex*pv,costGuanyat=ex*cu;
  const tracked=cr>0||ex===0;
  const eacF=tracked?cr+Math.max(0,am-ex)*cu:costPrev;
  return{am,venda,costPrev,produit,costGuanyat,tracked,desv:tracked?cr-costGuanyat:null,eacF,
    pct:am?ex/am*100:0,margeF:venda?(venda-eacF)/venda:null,margePrev:venda?(venda-costPrev)/venda:null};
}
const darreraCert=f=>+(S.certificacions.filter(f).sort((a,b)=>(+b.num)-(+a.num))[0]||{}).origen||0;
function certPer(c){
  const prev=darreraCert(x=>x.obraId===c.obraId&&(+x.num)<(+c.num));
  return(+c.origen||0)-prev;
}
function estC(e){
  const cd=+e.costDirecte||0,dg=(+e.dg||0)/100,bi=(+e.bi||0)/100,bj=(+e.baixa||0)/100;
  const pec=cd*(1+dg+bi),oferta=pec*(1-bj),ben=oferta-cd*(1+dg);
  return{cd,dgI:cd*dg,biI:cd*bi,pec,baixaI:pec*bj,oferta,iva:oferta*0.21,ben,biPct:oferta?ben/oferta:null};
}
function calcOther(mk,o,id){
  const row=(a,b)=>`<span>${a}</span><b>${b}</b>`;
  const M2=n=>MF2.format(+n||0);
  if(mk==='estudis'){
    const e=estC(o);
    return row('Cost directe',M2(e.cd))+row(`Despeses generals ${+o.dg||0}%`,M2(e.dgI))+row(`Benefici industrial ${+o.bi||0}%`,M2(e.biI))
     +row('Preu de contracte (PEC)',M2(e.pec))+row(`Baixa ${+o.baixa||0}%`,'−'+M2(e.baixaI))
     +row('<span style="font-weight:600">Preu d\'oferta sense IVA</span>',M2(e.oferta))+row('Oferta amb IVA 21%',M2(e.oferta+e.iva))
     +row('Benefici resultant (oferta − cost − DG)',M2(e.ben)+(e.biPct==null?'':' · '+fmtN(e.biPct*100)+'%'));
  }
  if(mk==='partides'||mk==='modificats'){
    const p=ptc(o);
    return row('Venda contractada',M2(p.venda))+row('Cost previst',M2(p.costPrev))+row('Marge previst',p.margePrev==null?'—':fmtN(p.margePrev*100)+'%')
     +row('Execució',fmtN(p.pct)+'%')+row('Produït a preu de venda',M2(p.produit))+row('Cost guanyat (executat × cost previst)',M2(p.costGuanyat))
     +row('Desviació de cost',p.desv==null?'sense cost imputat':(p.desv>0?'+':'')+M2(p.desv))+row('Cost final previst',M2(p.eacF))
     +row('Marge final previst',p.margeF==null?'—':fmtN(p.margeF*100)+'%');
  }
  if(mk==='certificacions'){
    const pr=ctlObra(o.obraId).produit;
    return row("Import d'aquest període",M2(certPer(o)))+row('Produït acumulat a partides',M2(pr))+row('Produït − certificat a origen',M2(pr-(+o.origen||0)));
  }
  if(mk==='ofertes'){
    const h=(+o.import||0)+(+o.ajust||0);
    const oth=S.ofertes.filter(x=>x.id!==id&&x.comparatiu===o.comparatiu&&(x.obraId||'')===(o.obraId||'')&&x.estat!=='Descartada').map(x=>(+x.import||0)+(+x.ajust||0));
    let r=row('Import homogeneïtzat',M2(h));
    if(oth.length){const b=Math.min(...oth);r+=row('Millor de les altres ofertes',M2(b))+row('Diferència',(h-b>0?'+':'')+M2(h-b))}
    return r;
  }
  return '';
}

function ctlObra(id){
  const o=obra(id)||{};
  const ps=[...S.partides.filter(p=>p.obraId===id),...S.modificats.filter(p=>p.obraId===id&&p.codi!=null&&['Aprovat','Executat'].includes(p.estat)).map(p=>({...p,esMod:1}))];
  const cs=ps.map(p=>({p,c:ptc(p)}));
  const venda=sum(cs,x=>x.c.venda),costPrev=sum(cs,x=>x.c.costPrev),produit=sum(cs,x=>x.c.produit);
  const tr=cs.filter(x=>x.c.desv!=null);
  const costImp=sum(ps,p=>costRealDe(p)),costGuanyat=sum(tr,x=>x.c.costGuanyat),desv=sum(tr,x=>x.c.desv),eac=sum(cs,x=>x.c.eacF);
  const mods=S.modificats.filter(m=>m.obraId===id);
  const modAp=sum(mods.filter(m=>['Aprovat','Executat'].includes(m.estat)),m=>+m.import);
  const modPend=sum(mods.filter(m=>['Proposat','Presentat al client'].includes(m.estat)),m=>+m.import);
  const certOrigen=darreraCert(x=>x.obraId===id&&x.estat!=='Esborrany');
  return{o,ps,cs,venda,costPrev,produit,costImp,costGuanyat,desv,eac,modAp,modPend,certOrigen,
    pendCert:produit-certOrigen,contracte:(+o.pressupost||0)+modAp,
    marge:venda?(venda-eac)/venda:null,margePrev:venda?(venda-costPrev)/venda:null,
    untracked:cs.length-tr.length,f:fin(id)};
}

function tresoreria(){
  const t=today(),d=new Date(),keys=[];
  for(let i=0;i<6;i++){const x=new Date(d.getFullYear(),d.getMonth()+i,1);keys.push(x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0'))}
  const B=[{l:'Vençuts',cob:0,pag:0},...keys.map(k=>({k,l:new Date(k+'-15T12:00:00').toLocaleDateString('ca-ES',{month:'long',year:'numeric'}),cob:0,pag:0})),{l:'Més endavant o sense data',cob:0,pag:0}];
  [].forEach(f=>{
    const a=totF(f).total;let b;
    if(!f.venciment)b=B[B.length-1];
    else if(f.venciment<t)b=B[0];
    else b=B.find(x=>x.k===String(f.venciment).slice(0,7))||B[B.length-1];
    if(f.sentit==='Emesa')b.cob+=a;else b.pag+=a;
  });
  B[B.length-1].cob+=sum(S.certificacions.filter(c=>c.estat==='Facturada'),c=>certPer(c));
  let s=0;B.forEach(b=>{b.net=b.cob-b.pag;s+=b.net;b.saldo=s});
  return B;
}

/* ---------- Pestanya Control d'una obra ---------- */
function controlHtml(id){
  const k=ctlObra(id);
  if(!k.ps.length)return `<div class="empty"><b>Encara no hi ha partides en aquesta obra</b>Importa-les des de l'Excel de l'obra (codi, descripció, unitat, amidament, preu de venda i cost) o crea-les una a una. Amb elles tindràs aquí la producció, la desviació de cost i el marge final previst.${CANWRITE?`<div><button class="btn pri" data-act="import" data-obra="${esc(id)}">Importa des d'Excel</button> <button class="btn" data-act="new" data-mk="partides" data-def='${esc(JSON.stringify({obraId:id}))}'>+ Nova partida</button></div>`:''}</div>`;
  const pc=(a,b)=>b?fmtN(a/b*100)+'%':'—';
  const caps={};
  capsObra(id).forEach(c=>{if(k.ps.some(p=>p.capitol===c))caps[c]={n:0,venda:0,produit:0,cost:0,desv:0,eac:0}});k.cs.forEach(x=>{const c=x.p.capitol||'Sense capítol';const g=caps[c]||(caps[c]={n:0,venda:0,produit:0,cost:0,desv:0,eac:0});g.n++;g.venda+=x.c.venda;g.produit+=x.c.produit;g.cost+=costRealDe(x.p);if(x.c.desv!=null)g.desv+=x.c.desv;g.eac+=x.c.eacF});
  const top=k.cs.filter(x=>x.c.desv!=null&&x.c.desv>0).sort((a,b)=>b.c.desv-a.c.desv).slice(0,6);
  const over=k.cs.filter(x=>x.c.pct>100).length;
  const sinImp=k.f.directe-k.costImp;
  const kp=`<div class="kpis" style="margin-bottom:16px">
   <div class="kpi"><div class="l">Venda a partides</div><div class="v">${fmtM(k.venda)}</div><div class="s">Contracte vigent ${fmtM(k.contracte)}${k.modAp?` (inclou ${fmtM(k.modAp)} de contradictòries)`:''}</div></div>
   <div class="kpi"><div class="l">Produït a preu de venda</div><div class="v">${fmtM(k.produit)}</div><div class="s">${pc(k.produit,k.venda)} d'execució · pendent de certificar <b style="color:${k.pendCert>0?'var(--warn)':'inherit'}">${fmtM(k.pendCert)}</b></div></div>
   <div class="kpi"><div class="l">Cost imputat a partides</div><div class="v">${fmtM(k.costImp)}</div><div class="s">Desviació ${devHtml(k.desv)} sobre el cost guanyat</div></div>
   <div class="kpi"><div class="l">Marge net final previst</div><div class="v" style="color:${k.margeNet==null?'inherit':k.margeNet<0?'var(--bad)':'var(--ok)'}">${p1(k.margeNet)}</div><div class="s">Brut ${p1(k.marge)} − estructura ${pn(k.estPct)} − indirectes ${fmtM(k.indFinal)} · brut inicial ${k.margePrev==null?'—':fmtN(k.margePrev*100)+'%'} · cost final previst ${fmtM(k.eac)}</div></div>
  </div>`;
  return kp+`<div class="grid2"><div class="stack">
   <section class="panel"><h2>Per capítols</h2><div class="tw"><table><thead><tr><th>Capítol</th><th class="num">Partides</th><th class="num">Venda</th><th class="num">Produït</th><th class="num">Cost real</th><th class="num">Desviació</th><th class="num">Cost final prev.</th><th class="num">Marge final</th></tr></thead><tbody>
   ${Object.entries(caps).map(([c,g])=>`<tr style="cursor:default"><td class="t-main">${esc(c)}</td><td class="num">${g.n}</td><td class="num">${fmtM(g.venda)}</td><td class="num">${fmtM(g.produit)} <span class="small">(${pc(g.produit,g.venda)})</span></td><td class="num">${fmtM(g.cost)}</td><td class="num">${devHtml(g.desv)}</td><td class="num">${fmtM(g.eac)}</td><td class="num">${pctHtml(g.venda?(g.venda-g.eac)/g.venda:null)}</td></tr>`).join('')}
   </tbody></table></div></section>
   <section class="panel"><h2>Partides amb més desviació de cost</h2>${top.length?`<ul class="alist">${top.map(x=>`<li data-act="edit" data-mk="${x.p.esMod?'modificats':'partides'}" data-id="${esc(x.p.id)}"><span class="dot t-bad"></span><div class="tx">${esc(x.p.codi||'')} · ${esc(x.p.descripcio||'')}<small>Cost real ${fmtM(costRealDe(x.p))} · cost guanyat ${fmtM(x.c.costGuanyat)} · ${x.c.costGuanyat?fmtN(x.c.desv/x.c.costGuanyat*100)+'% per sobre':'sense base'}</small></div><b class="mono" style="color:var(--bad)">+${fmtM(x.c.desv)}</b></li>`).join('')}</ul>`:`<div class="empty">Cap partida per sobre del cost previst.</div>`}</section>
  </div><div class="stack">
   <section class="panel"><h2>Quadrament i riscos</h2><div class="pb"><dl class="meta">
    <dt>Cost directe real</dt><dd class="mono">${fmtM(k.f.directe)}</dd>
    <dt>Cost indirecte</dt><dd class="mono">${fmtM(k.f.indirecte)} <span class="small">(previst ${k.indPrev==null?'—':fmtM(k.indPrev)})</span></dd>
    <dt>Imputat a partides</dt><dd class="mono">${fmtM(k.costImp)}</dd>
    <dt>Sense imputar</dt><dd class="mono" style="color:${Math.abs(sinImp)>Math.max(500,k.f.directe*0.05)?'var(--warn)':'inherit'}">${fmtM(sinImp)}</dd>
    <dt>Contracte vigent</dt><dd class="mono">${fmtM(k.contracte)}</dd>
    <dt>Estructura prevista</dt><dd class="mono">${fmtM(k.estPrev)} <span class="small">(${pn(k.estPct)})</span></dd>
    <dt>Venda a partides</dt><dd class="mono">${fmtM(k.venda)} <span class="small">(dif. ${fmtM(k.contracte-k.venda)})</span></dd>
    <dt>Certificat a origen</dt><dd class="mono">${fmtM(k.certOrigen)}</dd>
    <dt>Facturat / cobrat</dt><dd class="mono">${fmtM(k.f.facturat)} / ${fmtM(k.f.cobrat)}</dd>
    <dt>Contradictòries pendents</dt><dd class="mono">${fmtM(k.modPend)}</dd>
    <dt>Execució &gt; 100%</dt><dd>${over?`<b style="color:var(--warn)">${over} partides</b> (excés d'amidament)`:'Cap'}</dd>
    <dt>Sense cost imputat</dt><dd>${k.untracked?`<b style="color:var(--warn)">${k.untracked} partides</b> amb execució`:'Cap'}</dd>
   </dl></div></section>
   <div class="small" style="padding:0 4px">Cost guanyat = executat × cost previst. Cost final previst = cost real + pendent d'executar × cost previst. Les partides amb execució però sense cost imputat compten amb el cost previst.</div>
  </div></div>`;
}

/* ---------- Pàgina Control de gestió (tota l'empresa) ---------- */
function gestioHtml(){
  const act=S.obres.filter(o=>['En execució','Preparació','Aturada','Recepció provisional'].includes(o.estat)).sort((a,b)=>String(a.codi).localeCompare(String(b.codi)));
  const ks=act.map(o=>({o,k:ctlObra(o.id)}));
  const venda=sum(ks,x=>x.k.venda),eac=sum(ks,x=>x.k.eac),costPrev=sum(ks,x=>x.k.costPrev);
  const marge=venda?(venda-eac)/venda:null,margePrev=venda?(venda-costPrev)/venda:null;
  const margeNet=venda?(venda-eac-sum(ks.filter(x=>x.k.venda),x=>x.k.estVenda+x.k.indFinal))/venda:null;
  const pendCert=sum(ks,x=>Math.max(0,x.k.pendCert));
  const perFact=sum(S.certificacions.filter(c=>c.estat==='Conformada'),c=>certPer(c));
  const desv=sum(ks,x=>x.k.desv),guany=sum(ks,x=>x.k.costGuanyat);
  const B=tresoreria();
  const mods=S.modificats.filter(m=>['Proposat','Presentat al client'].includes(m.estat)).sort((a,b)=>(+b.import||0)-(+a.import||0));
  return `<div class="head"><div><div class="eyebrow">Control d'obra</div><h1>Control de gestió</h1></div></div>
  <div class="kpis">
   <div class="kpi"><div class="l">Producció pendent de certificar</div><div class="v">${fmtM(pendCert)}</div><div class="s">Obres actives · produït − certificat a origen</div></div>
   <div class="kpi"><div class="l">Certificacions per facturar</div><div class="v">${fmtM(perFact)}</div><div class="s">Conformades i encara sense factura</div></div>
   <div class="kpi"><div class="l">Marge net final previst</div><div class="v" style="color:${margeNet==null?'inherit':margeNet<0?'var(--bad)':'var(--ok)'}">${p1(margeNet)}</div><div class="s">Brut ${p1(marge)} · brut inicial ${margePrev==null?'—':fmtN(margePrev*100)+'%'} · pondera per venda de les partides</div></div>
   <div class="kpi"><div class="l">Desviació de cost</div><div class="v">${devHtml(desv)}</div><div class="s">${guany?fmtN(desv/guany*100)+'% sobre el cost guanyat':'Sense cost imputat encara'}</div></div>
  </div>
  ${estrConfigHtml()}
  <section class="panel" style="margin-bottom:16px"><h2>Obres actives: producció, certificació i marge</h2>
  ${ks.length?`<div class="tw"><table><thead><tr><th>Obra</th><th class="num">Contracte vigent<br>Estructura prev.</th><th class="num">Produït<br>Pend. certificar</th><th class="num">Certificat<br>Facturat</th><th class="num">Cobrat</th><th class="num">Cost directe<br>Cost indirecte</th><th class="num">Cost imputat<br>Cost final prev.</th><th class="num">Desv. cost</th><th class="num">Marge brut<br>Marge net</th></tr></thead><tbody>
  ${ks.map(({o,k})=>{const d2=(a,b)=>`<td class="num">${a}<span class="l2">${b}</span></td>`;return `<tr data-act="goObraCtl" data-id="${esc(o.id)}"><td class="t-main"><div class="code">${esc(o.codi)}</div>${esc(o.nom)}</td>${d2(fmtM(k.contracte),fmtM(k.estPrev))}${d2(fmtM(k.produit),fmtM(k.pendCert))}${d2(fmtM(k.certOrigen),fmtM(k.f.facturat))}<td class="num">${fmtM(k.f.cobrat)}</td>${d2(fmtM(k.f.directe),fmtM(k.f.indirecte))}${d2(fmtM(k.costImp),k.ps.length?fmtM(k.eac):'—')}<td class="num">${k.ps.length?devHtml(k.desv):'—'}</td>${d2(pctHtml(k.marge),pctHtml(k.margeNet))}</tr>`}).join('')}
  </tbody></table></div>`:`<div class="empty"><b>Cap obra activa</b>Quan hi hagi obres en preparació o execució, aquí en veuràs la producció i el marge.</div>`}
  </section>
  <div class="grid2">
   <section class="panel"><h2>Tresoreria prevista</h2><div class="tw"><table><thead><tr><th>Període</th><th class="num">Cobraments</th><th class="num">Pagaments</th><th class="num">Net</th><th class="num">Saldo acumulat</th></tr></thead><tbody>
   ${B.map(b=>`<tr style="cursor:default"><td class="t-main" style="text-transform:capitalize">${esc(b.l)}</td><td class="num">${fmtM(b.cob)}</td><td class="num">${fmtM(b.pag)}</td><td class="num" style="color:${b.net<0?'var(--bad)':'var(--ok)'}">${fmtM(b.net)}</td><td class="num"><b>${fmtM(b.saldo)}</b></td></tr>`).join('')}
   </tbody></table></div><div class="pb small">Certificacions facturades sense cobrar (sense IVA ni data prevista). Les factures rebudes no porten estat de pagament. No inclou nòmines, impostos ni quotes.</div></section>
   <section class="panel"><h2>Contradictòries pendents de resposta<span class="sp"></span><span class="code">${fmtM(sum(mods,m=>+m.import))}</span></h2>
   ${mods.length?`<ul class="alist">${mods.slice(0,8).map(m=>`<li data-act="edit" data-mk="modificats" data-id="${esc(m.id)}"><span class="dot t-warn"></span><div class="tx">${esc(m.num||'')} · ${esc(m.descripcio||'')}<small>${esc(obraTxt(m.obraId))} · ${esc(m.estat)}</small></div><b class="mono">${fmtM(m.import)}</b></li>`).join('')}</ul>`:`<div class="empty">No hi ha contradictòries pendents.</div>`}</section>
  </div>`;
}

/* ---------- Comparatius d'ofertes ---------- */
function ofertesHtml(fo){
  const st=mv('ofertes');
  const hom=r=>(+r.import||0)+(+r.ajust||0);
  const all=S.ofertes.filter(r=>!fo||r.obraId===fo);
  let rows=all.slice();
  if(!fo&&st.obra)rows=rows.filter(r=>r.obraId===st.obra);
  if(st.q){const q=st.q.toLowerCase();rows=rows.filter(r=>[r.comparatiu,r.proveidor,r.exclusions,r.notes,r.obraId?obraTxt(r.obraId):''].some(v=>String(v||'').toLowerCase().includes(q)))}
  const sid=fo?'o':'';
  const tools=`<div class="tools"><input type="search" id="q-ofertes${sid}" placeholder="Cerca comparatius o proveïdors…" value="${esc(st.q)}" data-bind="q" data-mk="ofertes" aria-label="Cerca">${fo?'':`<select id="fo-ofertes" data-bind="obra" data-mk="ofertes" aria-label="Filtra per obra"><option value="">Totes les obres</option>${obraOpts(st.obra)}</select>`}<span style="flex:1"></span>${fo&&CANWRITE?`<button class="btn pri sm" data-act="new" data-mk="ofertes" data-def='${esc(JSON.stringify({obraId:fo}))}'>+ Nova oferta</button>`:''}</div>`;
  if(!all.length)return emptyHtml('Encara no hi ha cap comparatiu',"Registra les ofertes rebudes per a un mateix abast i l'Obrador les compara ja homogeneïtzades (afegint el que cada una exclou).",'ofertes',fo?{obraId:fo}:null);
  const groups={};
  rows.forEach(r=>{const k=(r.obraId||'')+'|'+String(r.comparatiu||'').trim().toLowerCase();(groups[k]=groups[k]||[]).push(r)});
  const gl=Object.values(groups).sort((a,b)=>String(a[0].comparatiu).localeCompare(String(b[0].comparatiu),'ca'));
  if(!gl.length)return tools+'<div class="empty">Cap resultat amb aquests filtres.</div>';
  return tools+gl.map(g=>{
    const live=g.filter(r=>r.estat!=='Descartada');
    const best=live.length?Math.min(...live.map(hom)):null;
    const worst=live.length?Math.max(...live.map(hom)):null;
    const adj=g.find(r=>r.estat==='Adjudicada');
    const sorted=g.slice().sort((a,b)=>((a.estat==='Descartada')-(b.estat==='Descartada'))||hom(a)-hom(b));
    const first=g[0];
    const def={comparatiu:first.comparatiu,obraId:first.obraId||''};
    return `<section class="panel" style="margin-bottom:14px"><h2><span>${esc(first.comparatiu)}</span>${first.obraId&&!fo?`<span class="code">${esc((obra(first.obraId)||{}).codi||'')}</span>`:''}<span class="sp"></span>${live.length>1?`<span class="small">Dispersió ${fmtM(worst-best)} (${best?fmtN((worst-best)/best*100):0}%)</span>`:''}${CANWRITE?`<button class="btn sm" data-act="new" data-mk="ofertes" data-def='${esc(JSON.stringify(def))}'>+ Oferta</button>`:''}</h2>
    ${adj?`<div class="pb small" style="border-bottom:1px solid var(--line)">Adjudicat a <b>${esc(adj.proveidor)}</b> per ${fmtM(adj.import)} (homogeneïtzat ${fmtM(hom(adj))}).</div>`:''}
    <div class="tw"><table><thead><tr><th>Proveïdor</th><th>Abast</th><th class="num">Oferta</th><th class="num">Ajust</th><th class="num">Homogeneïtzat</th><th class="num">Δ vs. millor</th><th class="num">Termini</th><th>Pagament</th><th class="num">Garantia</th><th>Validesa</th><th>Estat</th><th></th></tr></thead><tbody>
    ${sorted.map(r=>{
      const h=hom(r),isBest=r.estat!=='Descartada'&&live.length>1&&h===best;
      const ex=String(r.exclusions||'');
      return `<tr class="${isBest?'best':''}" data-act="edit" data-mk="ofertes" data-id="${esc(r.id)}"><td class="t-main">${esc(r.proveidor)}${isBest?' <span class="pill t-ok">Millor preu</span>':''}${ex?`<div class="small">Cal afegir: ${esc(ex.slice(0,90))}${ex.length>90?'…':''}</div>`:''}</td>
      <td>${pill(r.abast)}</td><td class="num">${fmtM(r.import)}</td><td class="num">${r.ajust?fmtM(r.ajust):'—'}</td><td class="num"><b>${fmtM(h)}</b></td>
      <td class="num">${best!=null&&r.estat!=='Descartada'&&h!==best?`+${fmtM(h-best)} <span class="small">(${best?fmtN((h-best)/best*100):0}%)</span>`:'—'}</td>
      <td class="num">${r.termini?esc(r.termini)+' d':'—'}</td><td>${esc(r.pagament||'—')}</td><td class="num">${r.garantia!=null&&r.garantia!==''?esc(r.garantia)+'%':'—'}</td><td>${expHtml(r.validesa)}</td><td>${pill(r.estat)}</td>
      <td>${CANWRITE&&r.estat!=='Adjudicada'?`<button class="btn sm" data-act="adjudica" data-id="${esc(r.id)}">Adjudica</button>`:''}</td></tr>`}).join('')}
    </tbody></table></div></section>`}).join('');
}

/* ---------- Importació des d'Excel (partides) ---------- */
function pnum(s){
  s=String(s==null?'':s).trim().replace(/[\s€]/g,'');
  if(!s)return NaN;
  if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
  else if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
  const n=+s;return isFinite(n)?n:NaN;
}
const normU=(x,altra)=>{const u=String(x||'').trim().toLowerCase().replace(/\.$/,'');return UNITATS.find(k=>k.toLowerCase()===u)||({m2:'m²',m3:'m³',u:'ut',ud:'ut',uds:'ut',uts:'ut',un:'ut',pa:'PA','p.a':'PA'})[u]||altra||'ut'};
const normCap=x=>String(x||'').trim();
function impHelp(){
  const m=$('#imp-mode').value;
  $('#imp-help').innerHTML=m==='alta'
   ?"Columnes, en aquest ordre: <b>Codi · Descripció · Unitat · Amidament · Preu de venda · Cost unitari · Capítol</b> (el capítol és opcional). Si el codi ja existeix en aquesta obra, s'actualitza la partida. Copia-ho directament de l'Excel."
   :"Columnes: <b>Codi · Executat acumulat · Cost real acumulat (€)</b> (el cost és opcional). Només actualitza partides que ja existeixen en aquesta obra.";
}
function impParse(){
  const mode=$('#imp-mode').value,oid=$('#imp-obra').value,txt=$('#imp-txt').value;
  const rows=txt.split(/\r?\n/).filter(l=>l.trim()).map(l=>l.split(l.includes('\t')?'\t':';').map(x=>x.trim()));
  const ex=S.partides.filter(p=>p.obraId===oid);
  const out={crear:[],upd:[],err:[]};
  rows.forEach((c,i)=>{
    const codi=c[0];if(!codi)return;
    const old=ex.find(p=>p.codi===codi);
    if(mode==='alta'){
      const am=pnum(c[3]);
      if(isNaN(am)){if(i>0)out.err.push(`Fila ${i+1}: amidament no vàlid (${codi})`);return}
      const pv=pnum(c[4]),cu=pnum(c[5]);
      const rec={codi,descripcio:c[1]||codi,unitat:normU(c[2]),amidament:am,preuVenda:isNaN(pv)?0:pv,costUnit:isNaN(cu)?0:cu,capitol:normCap(c[6])};
      (old?out.upd:out.crear).push({old,rec});
    }else{
      const e=pnum(c[1]),cr=pnum(c[2]);
      if(isNaN(e)){if(i>0)out.err.push(`Fila ${i+1}: execució no vàlida (${codi})`);return}
      if(!old){out.err.push(`Fila ${i+1}: la partida ${codi} no existeix en aquesta obra`);return}
      out.upd.push({old,rec:Object.assign({executat:e},isNaN(cr)?{}:{costReal:cr})});
    }
  });
  return out;
}
function impPrev(){
  const el=$('#imp-prev');if(!el)return;
  if(!$('#imp-txt').value.trim()){el.textContent='';return}
  const p=impParse();
  el.innerHTML=`<b>${p.crear.length}</b> a crear · <b>${p.upd.length}</b> a actualitzar${p.err.length?` · <span style="color:var(--bad)">${p.err.length} amb avisos</span>`:''}`+(p.err.length?`<ul style="margin:6px 0 0;padding-left:18px">${p.err.slice(0,5).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'');
}
function openImport(oid){
  const body=`<div class="fld"><label for="imp-obra">Obra</label><select id="imp-obra">${obraOpts(oid,'— Tria una obra —')}</select></div>
  <div class="fld"><label for="imp-mode">Què vols fer</label><select id="imp-mode"><option value="alta">Donar d'alta partides (pressupost)</option><option value="upd">Actualitzar execució i cost (cada mes)</option></select></div>
  <div class="muted" id="imp-help" style="font-size:13px"></div>
  <div class="fld"><label for="imp-txt">Enganxa aquí les files de l'Excel</label><textarea id="imp-txt" class="mono" style="min-height:200px" placeholder="REP.01	Repicat de revestiment	m²	420	18,50	11,20"></textarea></div>
  <div id="imp-prev" class="muted" style="font-size:13px"></div>`;
  drawer("Importa partides des d'Excel",body,`<span class="sp"></span><button class="btn" data-act="close">Cancel·la</button><button class="btn pri" data-act="doImport">Importa</button>`);
  impHelp();
}
async function doImport(){
  const oid=$('#imp-obra').value;
  if(!oid){toast("Tria primer l'obra.");return}
  const p=impParse();
  if(!p.crear.length&&!p.upd.length){toast('No hi ha cap fila vàlida per importar.');return}
  const btn=document.querySelector('[data-act="doImport"]');if(btn)btn.disabled=true;
  let n=0;
  for(const x of p.crear){try{await save('partides',newId('pa'),Object.assign({},x.rec,{obraId:oid}));n++}catch(e){break}}
  for(const x of p.upd){try{const {id,...rest}=x.old;await save('partides',x.old.id,Object.assign({},rest,x.rec));n++}catch(e){break}}
  logA(`Importades ${n} partides a ${obraTxt(oid)}`);
  closeDrawer();
  toast(`${n} partides importades.`+(p.err.length?` ${p.err.length} files ignorades.`:''));
}

/* ---------- Connexió amb el nucli de l'Obrador ---------- */
const _route=route;
route=function(){
  if(decodeURIComponent(location.hash.slice(1))==='gestio')return{v:'gestio'};
  return _route();
};
const _viewHtml=viewHtml;
viewHtml=function(r){
  if(r.v==='gestio'){
    if(!LOCAL&&!COLS.every(c=>loaded[c]))return `<div class="loading">Carregant dades de l'empresa…</div>`;
    return gestioHtml();
  }
  return _viewHtml(r);
};
const _listPage=listPage;
listPage=function(mk){
  return _listPage(mk).replace(/<div class="eyebrow">[^<]*<\/div>/,`<div class="eyebrow">${eyeb(mk)}</div>`);
};
const _cellVal=cellVal;
cellVal=function(mk,c,r){
  const f=typeof c==='string'&&M[mk].camps.find(x=>x.k===c);
  if(f){
    if(f.tp==='money'&&f.d)return{h:MF2.format(+r[c]||0),num:1};
    if(f.tp==='date'&&EXPK.includes(c))return{h:expHtml(r[c])};
    if(c==='gravetat')return{h:pill(r[c])};
  }
  return _cellVal(mk,c,r);
};
const _listHtml=listHtml;
listHtml=function(mk,fo){
  if(mk==='ofertes')return ofertesHtml(fo);
  let h=_listHtml(mk,fo);
  if(mk==='partides'&&CANWRITE)h=h.replace('<span style="flex:1"></span>',`<span style="flex:1"></span><button class="btn sm" data-act="import" data-obra="${esc(fo||'')}">Importa des d'Excel</button>`);
  if(mk==='partides'||mk==='modificats'){
    const rows=S[mk].filter(r=>!fo||r.obraId===fo);
    if(rows.length){
      let s;
      if(mk==='partides'){
        const cs=rows.map(r=>ptc(r));
        s=`Venda ${fmtM(sum(cs,x=>x.venda))} · Produït ${fmtM(sum(cs,x=>x.produit))} · Cost real ${fmtM(sum(rows,r=>costRealDe(r)))} · Desviació de cost ${devHtml(sum(cs.filter(x=>x.desv!=null),x=>x.desv))}`;
      }else{
        s=`Aprovats ${fmtM(sum(rows.filter(r=>['Aprovat','Executat'].includes(r.estat)),r=>+r.import))} · Pendents de resposta ${fmtM(sum(rows.filter(r=>['Proposat','Presentat al client'].includes(r.estat)),r=>+r.import))}`;
      }
      const i=h.indexOf('</div>');
      if(i>0)h=h.slice(0,i+6)+`<div class="tools muted" style="font-size:13px">${s}</div>`+h.slice(i+6);
    }
  }
  return h;
};
const _fieldHtml=fieldHtml;
fieldHtml=function(f,v){
  let h=_fieldHtml(f,v);
  if(f.tp==='sel'&&f.blank)h=h.replace(/(<select[^>]*>)/,'$1<option value="">—</option>');
  return h;
};
const _openForm=openForm;
openForm=function(mk,id,def){
  def=def||{};
  if(!id){
    const d={};
    if(mk==='estudis'){d.dg=13;d.bi=6;d.baixa=0}
    if(mk==='certificacions'){
      const oid=def.obraId||'';
      d.num=S.certificacions.filter(x=>x.obraId===oid).reduce((a,x)=>Math.max(a,+x.num||0),0)+1;
      const pr=ctlObra(oid).produit;
      if(pr>0)d.origen=Math.round(pr*100)/100;
    }
    if(mk==='modificats'){
      const oid=def.obraId||'';
      d.codi='PC.'+String(S.modificats.filter(x=>x.obraId===oid).length+1).padStart(2,'0');
    }
    def=Object.assign(d,def);
  }
  _openForm(mk,id,def);
  if(['estudis','partides','modificats','certificacions','ofertes'].includes(mk)){
    const fm=$('#frm');
    if(fm){fm.insertAdjacentHTML('afterend','<div class="calc" id="calc"></div>');calcF()}
  }
  if(mk==='ofertes'&&id&&CANWRITE){
    const r=S.ofertes.find(x=>x.id===id);
    const cl=document.querySelector('#drawerHost footer [data-act="close"]');
    if(r&&r.estat==='Adjudicada'&&cl)cl.insertAdjacentHTML('beforebegin',`<button class="btn" data-act="ofToCmd" data-id="${esc(id)}">Crea comanda</button>`);
  }
};
const _calcF=calcF;
calcF=function(){
  const c=$('#calc');if(!c)return;
  const f=readForm();
  if(f.mk==='factures')return _calcF();
  c.innerHTML=calcOther(f.mk,f.o,f.id);
};

document.addEventListener('click',async e=>{
  const a=e.target.closest('[data-act]');if(!a)return;
  const act=a.dataset.act,id=a.dataset.id;
  if(act==='import'){openImport(a.dataset.obra||'',a.dataset.mk)}
  else if(act==='doImport'){doImport()}
  else if(act==='goObraCtl'){V.obraTab='control';location.hash='obra-'+id;schedule()}
  else if(act==='adjudica'){
    const f=S.ofertes.find(x=>x.id===id);if(!f)return;
    const grp=S.ofertes.filter(x=>String(x.comparatiu||'').trim().toLowerCase()===String(f.comparatiu||'').trim().toLowerCase()&&(x.obraId||'')===(f.obraId||''));
    for(const x of grp){
      const est=x.id===f.id?'Adjudicada':'Descartada';
      if(est!==x.estat){const {id:_,...rest}=x;try{await save('ofertes',x.id,Object.assign({},rest,{estat:est}))}catch(err){return}}
    }
    logA(`Adjudicat «${f.comparatiu}» a ${f.proveidor}`);
    toast(`Adjudicat a ${f.proveidor}. Les altres ofertes queden descartades.`);
  }else if(act==='ofToCmd'){
    const f=S.ofertes.find(x=>x.id===id);if(!f)return;
    try{await save('comandes',newId('co'),{num:nextCode('comandes'),obraId:f.obraId||'',proveidor:f.proveidor,tipus:'Subcontracta',concepte:f.comparatiu,import:+f.import||0,estat:'Esborrany',data:today()})}catch(err){return}
    logA(`Comanda en esborrany creada des de l'oferta de ${f.proveidor}`);
    closeDrawer();toast('Comanda creada en esborrany a Compres.');
  }
});
document.addEventListener('input',e=>{if(e.target.id==='imp-txt')impPrev()});
document.addEventListener('change',e=>{
  if(e.target.id==='imp-mode'){impHelp();impPrev()}
  else if(e.target.id==='imp-obra')impPrev();
});
