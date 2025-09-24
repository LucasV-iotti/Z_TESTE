/* ==========================================================
 Roda a Roda – Treinamento (PT-BR)
 Regras & melhorias:
 - Som do giro, tics por segmento, ding de parada, bounce no ponteiro.
 - Tema "Galáxia" (persistência em localStorage) + botão flutuante permanente.
 - NOVAS REGRAS:
   1) Bloquear giros quando faltarem 3 letras ou menos.
   2) Chute errado: -200 no saldo da rodada por letra errada.
   3) Antes de chutar, o jogador deve girar a roleta; o valor sorteado vira o
      "valor de chute". Se acertar a frase inteira, ganha (valor de chute *
      quantidade de letras ainda em branco).
========================================================== */
const removeAcentos = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const rng = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const clamp = (v,min=0,max=1)=> v<min?min: (v>max?max:v);
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const SPIN_COST = 20; const VOWEL_COST = 500; const FALENCIA_PENALTY = 2000;
const WRONG_LETTER_PENALTY = 200; // por letra errada no chute
const PUZZLES = [
  { categoria: 'Financeira	 Dica: Dívidas em outras galáxias bancárias. Risco em órbita!', frase: 'ATRASO OUTROS BANCOS' },
  { categoria: 'Financeira	 Dica: Sem fonte de renda estável. Sobrevive com saques e auxílios governamentais.', frase: 'DESEMPREGADO' },
  { categoria: 'Financeira	 Dica: Possui alta renda, mas os gastos excessivos comprometem a saúde financeira.', frase: 'SUPER ENDIVIDADO' },
  { categoria: 'Financeira	 Dica: O valor do bem dado como garantia é inferior à dívida.', frase: 'BEM DEPRECIADO' },
  { categoria: 'Financeira	 Dica: Renda variável. Atua como profissional liberal, sem vínculo empregatício.', frase: 'AUTONOMO' },
  { categoria: 'Financeira	 Dica: Os investimentos superam o valor da parcela. Perfil valorizado pela instituição.', frase: 'INVESTIDOR SANTANDER' },
  { categoria: 'Financeira	 Dica: Possui mais de um veículo, indicando crescimento patrimonial.', frase: 'MAIS DE UM VEICULO' },
  { categoria: 'Financeira	 Dica: Enfrenta dificuldades financeiras significativas e precisa de apoio para reorganização.', frase: 'DIFICULDADES FINANCEIRAS' },
  { categoria: 'Financeira	 Dica: Atrasos recorrentes nas parcelas. É necessário rever hábitos e estratégias financeiras.', frase: 'ATRASO RECORRENTE' },
  { categoria: 'Financeira	 Dica: O planejamento financeiro não foi eficaz desde o início.', frase: 'PRIMEIRA PARCELA EM ATRASO' },

];
const state = { playerName:'Jogador', round:1, totalRounds:10, bank:500, roundScore:0, current:null, revealed:[], usedLetters:new Set(), canSpin:true, guessBaseValue:null };
const WHEEL_SEGMENTS = [
  { label: '300', value: 300 },{ label: '400', value: 400 },{ label: '500', value: 500 },{ label: 'Falência', effect: 'BANKRUPT' },
  { label: '600', value: 600 },{ label: '700', value: 700 },{ label: '800', value: 800 },{ label: 'Falência', effect: 'BANKRUPT' },
  { label: '900', value: 900 },{ label: '1000', value: 1000 },{ label: '1200', value: 1200 },{ label: 'Falência', effect: 'BANKRUPT' },
  { label: '1400', value: 1400 },{ label: '1600', value: 1600 },{ label: '1800', value: 1800 },{ label: 'Falência', effect: 'BANKRUPT' },
  { label: '2000', value: 2000 },{ label: '2200', value: 2200 },
];
const SEG_COLORS_LIGHT = ['#a5b4fc','#93c5fd','#c7d2fe','#a7f3d0','#fde68a','#fecaca','#ddd6fe','#bbf7d0'];
const SEG_COLORS_GALAXY = ['#7c3aed','#4c1d95','#0ea5e9','#06b6d4','#22d3ee','#f472b6','#db2777','#9333ea'];
let SEG_COLORS = SEG_COLORS_LIGHT.slice();

const $ = (s)=>document.querySelector(s); const $$=(s)=>Array.from(document.querySelectorAll(s));
const elStart=$('#start-screen'), elGame=$('#game-screen'), elEnd=$('#end-screen');
const uiPlayerName=$('#uiPlayerName'), uiRound=$('#uiRound'), uiTotalRounds=$('#uiTotalRounds'), uiBank=$('#uiBank'), uiRoundScore=$('#uiRoundScore'), uiCategory=$('#uiCategory');
const boardEl=$('#board'), keyboardEl=$('#keyboard'), btnSpin=$('#btnSpin'), wheelSvg=$('#wheel'), spinResult=$('#spinResult'), pointerEl=$('#pointer');
const btnBuyVowel=$('#btnBuyVowel'), vowelSelect=$('#vowelSelect'), btnGuess=$('#btnGuess'), guessPanel=$('#guessPanel'), guessInput=$('#guessInput'), btnSubmitGuess=$('#btnSubmitGuess'), btnCancelGuess=$('#btnCancelGuess');
const finalPlayer=$('#finalPlayer'), finalScore=$('#finalScore'), localRanking=$('#localRanking');

/* ===== Tema: alternância & persistência ===== */
const THEME_KEY = 'roda_a_roda_theme_v1';
function updateThemeButtons(isGalaxy){
  const label = isGalaxy ? '🌌 Galáxia' : '🌞 Claro';
  document.querySelectorAll('#themeToggle, #themeToggleFab').forEach(btn=>{
    btn.textContent = label;
    btn.setAttribute('aria-pressed', String(isGalaxy));
  });
}
function applyTheme(theme){
  const isGalaxy = theme === 'galaxy';
  document.body.classList.toggle('theme-galaxy', isGalaxy);
  SEG_COLORS = (isGalaxy ? SEG_COLORS_GALAXY : SEG_COLORS_LIGHT).slice();
  try{ localStorage.setItem(THEME_KEY, theme); }catch{}
  if (typeof currentRotation !== 'undefined' && wheelSvg) {
    const prev = currentRotation; drawWheel(); wheelSvg.style.transition='transform 0s'; wheelSvg.style.transform = `rotate(${prev}deg)`; currentRotation = prev;
  }
  updateThemeButtons(isGalaxy);
}
function initTheme(){ let theme='light'; try{ theme = localStorage.getItem(THEME_KEY) || 'light'; }catch{} applyTheme(theme); }
function ensureThemeControl(){
  if(!document.querySelector('#themeToggleFab')){
    const btn=document.createElement('button');
    btn.id='themeToggleFab'; btn.className='btn theme-fab'; btn.type='button';
    btn.title='Alternar tema (Claro / Galáxia)'; btn.textContent='🌞 Claro';
    document.body.appendChild(btn);
  }
  updateThemeButtons(document.body.classList.contains('theme-galaxy'));
}
// Delegação global: qualquer clique em #themeToggle ou #themeToggleFab alterna o tema
document.addEventListener('click', (e)=>{
  const btn = e.target.closest('#themeToggle, #themeToggleFab');
  if(!btn) return;
  const toGalaxy = !document.body.classList.contains('theme-galaxy');
  applyTheme(toGalaxy ? 'galaxy' : 'light');
});

/* ===== Utilidades de tabuleiro ===== */
const isLetter = (ch)=> /[A-Z]/.test(removeAcentos(ch).toUpperCase());
function countRemainingBlanks(){
  if(!state.current) return 0;
  const chars = Array.from(state.current.frase);
  let c=0; for(let i=0;i<chars.length;i++){ const ch=chars[i]; if(!state.revealed[i] && isLetter(ch)) c++; }
  return c;
}

/* ===== Ciclo de vida ===== */
function init(){ uiTotalRounds.textContent=state.totalRounds; uiBank.textContent=state.bank; drawWheel(); buildKeyboard(); ensureThemeControl(); initTheme(); }
function __safeInit(){ try{init();}catch(e){ console.error(e); const el=$('#spinResult'); if(el) el.textContent='Erro ao iniciar: '+e.message; ensureThemeControl(); initTheme(); } }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', __safeInit); else __safeInit();

$('#btnStart').addEventListener('click', ()=>{ const name=$('#playerName').value.trim(); if(name) state.playerName=name; uiPlayerName.textContent=state.playerName; uiBank.textContent=state.bank; try{startRound();}catch(e){console.error(e); spinResult.textContent='Erro ao iniciar a rodada: '+e.message; return;} elStart.classList.remove('active'); elGame.classList.add('active'); });
$('#btnPlayAgain').addEventListener('click', ()=>{ state.round=1; state.bank=500; state.roundScore=0; state.usedLetters.clear(); state.guessBaseValue=null; uiBank.textContent=state.bank; uiRoundScore.textContent='0'; startRound(); elEnd.classList.remove('active'); elGame.classList.add('active'); });

function startRound(){ uiRound.textContent=state.round; state.roundScore=0; uiRoundScore.textContent='0'; state.usedLetters=new Set(); state.guessBaseValue=null; spinResult.textContent=''; const pick=PUZZLES[(state.round-1)%PUZZLES.length]; state.current={categoria:pick.categoria, frase:pick.frase.toUpperCase(), normalized:removeAcentos(pick.frase.toUpperCase())}; uiCategory.textContent=state.current.categoria; buildBoard(); refreshKeyboard(); setSpinEnabled(true); }
function endRound(){ state.bank+=state.roundScore; uiBank.textContent=state.bank; if(state.round<state.totalRounds){ state.round++; setTimeout(()=>startRound(),600); } else { showEnd(); } }
function showEnd(){ finalPlayer.textContent=state.playerName; finalScore.textContent=state.bank; const entry={name:state.playerName, score:state.bank, ts:Date.now()}; const key='roda_a_roda_ranking_v3'; let list; try{ list=JSON.parse(localStorage.getItem(key)||'[]'); }catch{ list=[]; } list.push(entry); list.sort((a,b)=>b.score-a.score); try{ localStorage.setItem(key, JSON.stringify(list.slice(0,20))); }catch{} let top; try{ top=JSON.parse(localStorage.getItem(key)||'[]'); }catch{ top=list.slice(0,20); } const safe=s=>String(s).replace(/[&<>"\\]/g,m=>({'&':'&','<':'<','>':'>','"':'"'})[m]); localRanking.innerHTML='<h3>🏆 Ranking (este dispositivo)</h3>'+'<ol>'+top.map(r=>`<li><strong>${safe(r.name)}</strong> — ${r.score} pts</li>`).join('')+'</ol>'; elGame.classList.remove('active'); elEnd.classList.add('active'); }

function buildBoard(){ boardEl.innerHTML=''; const chars=Array.from(state.current.frase); state.revealed=chars.map(ch=> (ch===' '||['-','–'].includes(ch)||['.','!','?'].includes(ch))?true:false); chars.forEach((ch,i)=>{ const tile=document.createElement('div'); if(ch===' '){tile.className='tile space'; boardEl.appendChild(tile); return;} if(['-','–'].includes(ch)){ tile.className='tile hyphen'; tile.textContent='-'; boardEl.appendChild(tile); return;} if(['.','!','?'].includes(ch)){ tile.className='tile dot'; tile.textContent=ch; boardEl.appendChild(tile); return;} tile.className='tile'; tile.dataset.index=i; if(state.revealed[i]){ tile.classList.add('revealed'); tile.textContent=ch; } boardEl.appendChild(tile); }); }
function revealLetter(letter){ let hits=0; const chars=Array.from(state.current.frase); chars.forEach((ch,i)=>{ if(!state.revealed[i] && removeAcentos(ch)===letter){ state.revealed[i]=true; const tile=boardEl.querySelector(`.tile[data-index="${i}"]`); if(tile){ tile.classList.add('revealed'); tile.textContent=ch; } hits++; }}); return hits; }
function isSolved(){ return state.revealed.every(v=>v===true); }

const PT_ALPHABET=['A','B','C','Ç','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
function buildKeyboard(){ keyboardEl.innerHTML=''; PT_ALPHABET.forEach(letter=>{ const key=document.createElement('button'); key.className='key'+(isVowel(letter)?' vowel':''); key.textContent=letter; key.dataset.letter=letter; key.addEventListener('click',()=>onKeyClick(letter)); keyboardEl.appendChild(key); }); }
function refreshKeyboard(){ $$('.key').forEach(k=>{ const L=k.dataset.letter; const Ln=removeAcentos(L); const used=state.usedLetters.has(L)|| state.usedLetters.has(Ln); k.classList.toggle('disabled', used); k.disabled = used || isVowel(L); }); }
function isVowel(letter){ return ['A','E','I','O','U'].includes(letter); }
function onKeyClick(letter){ /* consoantes via roleta */ }

/* ===== Regra 1: bloquear giro com <= 3 letras em branco ===== */
function setSpinEnabled(e){
  state.canSpin=e;
  const blanks = countRemainingBlanks();
  const blockedByRule = blanks <= 3;
  btnSpin.disabled = !e || blockedByRule || state.bank < SPIN_COST;
  btnSpin.title = blockedByRule ? 'Não é permitido girar com 3 letras ou menos restantes.' : '';
}

/* ===== Roleta ===== */
let currentRotation=0; let spinning=false, pendingSegmentIndex=null, rafId=null;
function drawWheel(){ const n=WHEEL_SEGMENTS.length, step=360/n, r=50; wheelSvg.innerHTML=''; WHEEL_SEGMENTS.forEach((seg,i)=>{ const start=i*step, end=(i+1)*step, largeArc=(end-start)>180?1:0; const startRad=(Math.PI/180)*start, endRad=(Math.PI/180)*end; const x1=50+r*Math.cos(startRad), y1=50+r*Math.sin(startRad), x2=50+r*Math.cos(endRad), y2=50+r*Math.sin(endRad); const g=document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('data-index',i); g.setAttribute('class','seg'); const path=document.createElementNS('http://www.w3.org/2000/svg','path'); path.setAttribute('d',`M 50 50 L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`); path.setAttribute('fill', SEG_COLORS[i%SEG_COLORS.length]); path.setAttribute('stroke','#d1d5db'); path.setAttribute('stroke-width','0.4'); g.appendChild(path); const labelAngle=start+step/2, lr=36, lx=50+lr*Math.cos((Math.PI/180)*labelAngle), ly=50+lr*Math.sin((Math.PI/180)*labelAngle); const text=document.createElementNS('http://www.w3.org/2000/svg','text'); text.setAttribute('x',lx); text.setAttribute('y',ly); const fs=seg.label.length>8?4.5:(seg.label.length>6?5:6); text.setAttribute('font-size',String(fs)); text.setAttribute('font-weight','700'); text.setAttribute('text-anchor','middle'); text.setAttribute('dominant-baseline','middle'); text.setAttribute('fill','#0b0d1b'); text.setAttribute('transform',`rotate(${labelAngle} ${lx} ${ly})`); text.setAttribute('style','paint-order: stroke; stroke: rgba(255,255,255,.6); stroke-width: .6px;'); text.textContent=seg.label; g.appendChild(text); wheelSvg.appendChild(g); }); const tickRing=document.createElementNS('http://www.w3.org/2000/svg','g'); tickRing.setAttribute('id','tickRing'); for(let i=0;i<WHEEL_SEGMENTS.length;i++){ const step=360/WHEEL_SEGMENTS.length; const a=(Math.PI/180)*(i*step); const x1=50+49.8*Math.cos(a), y1=50+49.8*Math.sin(a); const x2=50+46.0*Math.cos(a), y2=50+46.0*Math.sin(a); const line=document.createElementNS('http://www.w3.org/2000/svg','line'); line.setAttribute('x1',x1); line.setAttribute('y1',y1); line.setAttribute('x2',x2); line.setAttribute('y2',y2); tickRing.appendChild(line); } for(let i=0;i<WHEEL_SEGMENTS.length;i++){ const step=360/WHEEL_SEGMENTS.length; const a=(Math.PI/180)*(i*step + step/2); const x1=50+49.5*Math.cos(a), y1=50+49.5*Math.sin(a); const x2=50+47.8*Math.cos(a), y2=50+47.8*Math.sin(a); const line=document.createElementNS('http://www.w3.org/2000/svg','line'); line.setAttribute('x1',x1); line.setAttribute('y1',y1); line.setAttribute('x2',x2); line.setAttribute('y2',y2); line.setAttribute('class','minor'); tickRing.appendChild(line); } wheelSvg.appendChild(tickRing); wheelSvg.style.transition='transform 0s'; wheelSvg.style.transform=`rotate(${currentRotation}deg)`; }

btnSpin.addEventListener('click', spinWheel);
function spinWheel(){
  if(spinning) return;
  const blanks = countRemainingBlanks();
  if(blanks <= 3){ spinResult.textContent='Faltam 3 letras ou menos — não é permitido girar.'; return; }
  if(state.bank<SPIN_COST){ spinResult.textContent=`Saldo insuficiente para girar (custa ${SPIN_COST}).`; return; }
  state.bank-=SPIN_COST; uiBank.textContent=state.bank;
  spinning=true; setSpinEnabled(false); spinResult.textContent='Girando...';
  const n=WHEEL_SEGMENTS.length, step=360/n, targetIndex=rng(0,n-1); pendingSegmentIndex=targetIndex; const targetAngle=(targetIndex*step)+step/2; const current=(((currentRotation%360)+360)%360); const spins=rng(6,10); const pointerAngle=-90; const needed=(((pointerAngle-(current+targetAngle))%360)+360)%360; const delta=(spins*360)+needed; currentRotation=currentRotation+delta; wheelSvg.style.transition='transform 6s cubic-bezier(0.16, 1, 0.3, 1)'; wheelSvg.style.transform=`rotate(${currentRotation}deg)`; audioStartSpin(); const start=performance.now(), dur=6000; let lastTick=-1; const run=(now)=>{ const t=clamp((now-start)/dur,0,1), p=easeOutCubic(t), tickN=Math.floor((p*delta)/step); if(tickN>lastTick){ lastTick=tickN; playTick(); bouncePointer(); } if(t<1){ rafId=requestAnimationFrame(run); } else { spinning=false; highlightSegment(pendingSegmentIndex); const seg=WHEEL_SEGMENTS[pendingSegmentIndex]; pendingSegmentIndex=null; flashSegment(seg); audioStopSpin(); playStopDing(); resolveSpin(seg); } }; rafId=requestAnimationFrame(run);
}

function highlightSegment(index){ Array.from(wheelSvg.querySelectorAll('.seg.selected')).forEach(el=>el.classList.remove('selected')); const seg=wheelSvg.querySelector(`.seg[data-index="${index}"]`); if(seg){ seg.classList.add('selected'); } }
function flashSegment(){ const el=wheelSvg.querySelector('.seg.selected'); if(!el) return; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }

function resolveSpin(seg){
  if(seg.value){
    // Define o valor de chute com o último valor sorteado
    state.guessBaseValue = seg.value;
    spinResult.textContent = `Valor: ${seg.value} — escolha uma consoante. Valor de chute: ${seg.value}.`;
    promptConsonant(seg.value);
  } else if(seg.effect==='BANKRUPT'){
    const before=state.roundScore; state.roundScore=Math.max(0,state.roundScore- FALENCIA_PENALTY); uiRoundScore.textContent=state.roundScore; const lost=before-state.roundScore; spinResult.textContent=`Falência! Você perdeu ${lost} do saldo da rodada.`;
    setTimeout(()=>setSpinEnabled(true),600);
  }
}

function promptConsonant(baseValue){ const onPick=(e)=>{ const btn=e.target.closest('.key'); if(!btn) return; const L=btn.dataset.letter; if(!L || isVowel(L) || btn.classList.contains('disabled')) return; keyboardEl.removeEventListener('click', onPick); handleConsonantGuess(L, baseValue); }; keyboardEl.addEventListener('click', onPick); }
function handleConsonantGuess(letter, baseValue){ letter=removeAcentos(letter); state.usedLetters.add(letter); refreshKeyboard(); const hits=revealLetter(letter); if(hits>0){ const gain=baseValue*hits; state.roundScore+=gain; uiRoundScore.textContent=state.roundScore; spinResult.textContent=`Acertou ${hits} letra(s)! +${gain} pontos na rodada.`; if(isSolved()){ spinResult.textContent='Você completou a frase!'; setTimeout(()=>endRound(),800); return; } } else { spinResult.textContent='Não tem essa letra...'; } setTimeout(()=>setSpinEnabled(true),600); }

/* ===== Comprar vogal ===== */
btnBuyVowel.addEventListener('click',()=>{ const vowel=vowelSelect.value; if(!vowel){ spinResult.textContent='Selecione uma vogal para comprar.'; return; } if(state.roundScore<VOWEL_COST){ spinResult.textContent=`Saldo insuficiente na rodada (${VOWEL_COST} pontos).`; return; } if(state.usedLetters.has(vowel)){ spinResult.textContent='Essa vogal já foi utilizada.'; return; } state.usedLetters.add(vowel); refreshKeyboard(); state.roundScore-=VOWEL_COST; uiRoundScore.textContent=state.roundScore; const hits=revealLetter(removeAcentos(vowel)); if(hits>0){ spinResult.textContent=`Vogal revelada: ${vowel} (${hits}). (−${VOWEL_COST})`; if(isSolved()){ spinResult.textContent='Você completou a frase!'; setTimeout(()=>endRound(),800); return; } } else { spinResult.textContent='A vogal escolhida não aparece na frase.'; } });

/* ===== Chutar frase (Regras 2 e 3) ===== */
btnGuess.addEventListener('click',()=>{
  if(state.guessBaseValue==null){
    guessPanel.classList.add('hidden');
    spinResult.textContent='Antes de chutar, gire a roleta para definir o valor por letra do chute.';
    return;
  }
  guessPanel.classList.remove('hidden'); guessInput.value=''; guessInput.focus();
});
btnCancelGuess.addEventListener('click',()=>{ guessPanel.classList.add('hidden'); });
btnSubmitGuess.addEventListener('click', submitGuess);
guessInput.addEventListener('keydown',(e)=>{ if(e.key==='Enter') submitGuess(); });

function normalizeLettersOnly(s){ return removeAcentos(String(s).toUpperCase()).replace(/[^A-Z]/g,''); }
function countWrongLetters(attempt, target){
  const A = normalizeLettersOnly(attempt); const T = normalizeLettersOnly(target);
  const n = Math.max(A.length, T.length); let wrong=0; for(let i=0;i<n;i++){ const a=A[i]||''; const t=T[i]||''; if(a!==t) wrong++; } return wrong;
}

function submitGuess(){
  const attempt=guessInput.value.trim(); if(!attempt) return;
  if(state.guessBaseValue==null){ spinResult.textContent='Você precisa girar a roleta para definir o valor do chute antes de chutar.'; return; }

  const blanksBefore = countRemainingBlanks();
  const norm=removeAcentos(attempt.toUpperCase());
  if(norm===state.current.normalized){
    // Corretíssimo: revela tudo e concede bônus do chute (valor * letras em branco)
    const bonus = state.guessBaseValue * blanksBefore;
    for(let i=0;i<state.revealed.length;i++){ if(!state.revealed[i]){ const ch=state.current.frase[i]; state.revealed[i]=true; const tile=boardEl.querySelector(`.tile[data-index="${i}"]`); if(tile){ tile.classList.add('revealed'); tile.textContent=ch; } } }
    state.roundScore += bonus; uiRoundScore.textContent=state.roundScore;
    spinResult.textContent=`Resposta correta! Bônus do chute: +${bonus} (${blanksBefore} letra(s) × ${state.guessBaseValue}).`;
    guessPanel.classList.add('hidden'); state.guessBaseValue=null; // precisa girar novamente para um novo chute
    setTimeout(()=>endRound(),800);
  } else {
    // Errado: -200 por letra errada (mínimo 0)
    const wrong = countWrongLetters(attempt, state.current.frase);
    const penalty = WRONG_LETTER_PENALTY * wrong;
    state.roundScore = Math.max(0, state.roundScore - penalty); uiRoundScore.textContent = state.roundScore;
    spinResult.textContent = `Quase! ${wrong} letra(s) errada(s). (−${penalty})`;
    guessPanel.classList.add('hidden'); state.guessBaseValue=null; // novo chute requer novo giro
  }
}

/* ===== Áudio ===== */
let audioCtx=null, noiseSrc=null, noiseGain=null, noiseFilter=null;
function ensureAudio(){ if(!audioCtx){ const AC=window.AudioContext|| window.webkitAudioContext; audioCtx=new AC(); } }
function audioStartSpin(){ try{ ensureAudio(); const buffer=audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate); const data=buffer.getChannelData(0); for(let i=0;i<data.length;i++){ data[i]=(Math.random()*2-1)*0.6; } noiseSrc=audioCtx.createBufferSource(); noiseSrc.buffer=buffer; noiseSrc.loop=true; noiseFilter=audioCtx.createBiquadFilter(); noiseFilter.type='lowpass'; noiseFilter.frequency.value=1200; noiseFilter.Q.value=0.0001; noiseGain=audioCtx.createGain(); noiseGain.gain.value=0.0001; noiseSrc.connect(noiseFilter).connect(noiseGain).connect(audioCtx.destination); noiseSrc.start(); const g=noiseGain.gain; const now=audioCtx.currentTime; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0.025, now+0.25); }catch(e){ console.warn('Audio init error', e); } }
function audioStopSpin(){ if(!audioCtx|| !noiseGain) return; const now=audioCtx.currentTime; try{ const g=noiseGain.gain; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0.0001, now+0.2); }catch{} setTimeout(()=>{ try{ noiseSrc&&noiseSrc.stop(); }catch{} noiseSrc=null; noiseGain=null; noiseFilter=null; },250); }
function playTick(){ if(!audioCtx) return; try{ const o=audioCtx.createOscillator(); const g=audioCtx.createGain(); o.type='square'; o.frequency.value=1600; g.gain.value=0.02; o.connect(g).connect(audioCtx.destination); const now=audioCtx.currentTime; g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.035, now+0.005); g.gain.linearRampToValueAtTime(0.0, now+0.06); o.start(now); o.stop(now+0.08); }catch(e){} }
function playStopDing(){ if(!audioCtx) return; try{ const o1=audioCtx.createOscillator(); const g=audioCtx.createGain(); o1.type='sine'; o1.frequency.setValueAtTime(880, audioCtx.currentTime); g.gain.value=0.0001; o1.connect(g).connect(audioCtx.destination); const now=audioCtx.currentTime; g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(0.06, now+0.01); g.gain.exponentialRampToValueAtTime(0.0001, now+0.25); o1.start(now); o1.stop(now+0.3); }catch(e){} }
function bouncePointer(){ pointerEl.classList.remove('bounce'); void pointerEl.offsetWidth; pointerEl.classList.add('bounce'); }