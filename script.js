/* script.js — Spice Theory Quiz (simplified)
   - Loads ./data/archetypes.json
   - Randomises questions per session and options per render
   - Editable selections; scoring at end
   - Optional tie-breaker mini-quiz when needed
   - Results show Secondary first, then Primary with percentages
*/
(() => {
  // --------------------------
  // DOM
  // --------------------------
  const bar          = document.getElementById('bar');
  const progressText = document.getElementById('progressText');

  const quizSec      = document.getElementById('quiz');
  const qLegend      = document.getElementById('q-legend');
  const optionsBox   = document.getElementById('options');
  const backBtn      = document.getElementById('backBtn');
  const skipBtn      = document.getElementById('skipBtn');
  const nextBtn      = document.getElementById('nextBtn');

  const bonusSec     = document.getElementById('bonus');
  const bSub         = document.getElementById('b-sub');
  const bonusOptions = document.getElementById('bonusOptions');
  const bonusBackBtn = document.getElementById('bonusBackBtn');
  const bonusNextBtn = document.getElementById('bonusNextBtn');

  const resultSec    = document.getElementById('result');
  const resultBadges = document.getElementById('resultBadges');
  const resultTitle  = document.getElementById('resultTitle');
  const resultBlurb  = document.getElementById('resultBlurb');
  const primaryDesc  = document.getElementById('primaryDesc');
  const secondaryDesc= document.getElementById('secondaryDesc');

  // --------------------------
  // STATE
  // --------------------------
  let DATA = null;

  let questions = [];      // shuffled DATA.questions
  let answers   = [];      // answers[i] = spiceKey | null
  let index     = 0;

  let bonusQuestions = []; // tie-filtered + shuffled DATA.bonus
  let bonusAnswers   = []; // bonusAnswers[i] = spiceKey | null
  let bIndex         = 0;
  let inBonus        = false;

  // --------------------------
  // UTIL
  // --------------------------
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  function shuffle(arr){
    for (let i = arr.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function setHidden(el, flag){
    el.classList.toggle('hidden', !!flag);
  }

  function orderScores(obj){
    return Object.entries(obj)
      .map(([key, score]) => ({ key, score }))
      .sort((a, b) => b.score - a.score);
  }

  // earliest leaning wins a tie (deterministic)
  function firstAppearance(candidates, exclude){
    for (let i = 0; i < answers.length; i++){
      const s = answers[i];
      if (!s) continue;
      if (exclude && s === exclude) continue;
      if (candidates.includes(s)) return s;
    }
    return candidates[0];
  }

  function updateProgress(){
    const total = questions.length + (inBonus ? bonusQuestions.length : 0);
    const completed = inBonus ? (questions.length + bIndex) : index;
    const current = Math.min(completed + 1, Math.max(total, 1));
    const pct = Math.max(0, Math.min(100, (completed / Math.max(total, 1)) * 100));
    bar.style.width = `${pct}%`;
    progressText.textContent = `Question ${current} of ${total}`;
  }

  // --------------------------
  // RENDER
  // --------------------------
  function renderQuestion(i){
    const q = questions[i];
    qLegend.textContent = q.text;

    const opts = shuffle(q.options.slice());
    optionsBox.innerHTML = '';

    opts.forEach((opt, idx) => {
      const id = `q${i}_${idx}`;

      const label = document.createElement('label');
      label.className = 'option';
      label.setAttribute('for', id);

      const input = document.createElement('input');
      input.type = 'radio';
      input.id = id;
      input.name = `q${i}`;
      input.value = opt.spice;
      if (answers[i] === opt.spice) input.checked = true;

      const text = document.createElement('span');
      text.textContent = opt.label;

      input.addEventListener('change', () => {
        answers[i] = input.value;
        nextBtn.disabled = false;
      });

      label.append(input, text);
      optionsBox.appendChild(label);
    });

    backBtn.disabled = i === 0;
    nextBtn.disabled = answers[i] == null;
    skipBtn.disabled = false;

    inBonus = false;
    updateProgress();
  }

  function renderBonusQuestion(i){
    const q = bonusQuestions[i];
    bSub.textContent = q.text;

    const opts = shuffle(q.options.slice());
    bonusOptions.innerHTML = '';

    opts.forEach((opt, idx) => {
      const id = `b${i}_${idx}`;

      const label = document.createElement('label');
      label.className = 'option';
      label.setAttribute('for', id);

      const input = document.createElement('input');
      input.type = 'radio';
      input.id = id;
      input.name = `b${i}`;
      input.value = opt.spice;
      if (bonusAnswers[i] === opt.spice) input.checked = true;

      const text = document.createElement('span');
      text.textContent = opt.label;

      input.addEventListener('change', () => {
        bonusAnswers[i] = input.value;
        bonusNextBtn.disabled = false;
      });

      label.append(input, text);
      bonusOptions.appendChild(label);
    });

    bonusBackBtn.disabled = i === 0;
    bonusNextBtn.disabled = bonusAnswers[i] == null;

    inBonus = true;
    updateProgress();
  }

  // --------------------------
  // FLOW
  // --------------------------
  function goNext(){
    if (answers[index] == null) return;
    if (index < questions.length - 1){
      index++;
      renderQuestion(index);
      return;
    }
    const tied = computeAndCheckTies();
    tied ? startBonus(tied) : showResult();
  }

  function goBack(){
    if (index === 0) return;
    index--;
    renderQuestion(index);
  }

  function skip(){
    if (index < questions.length - 1){
      index++;
      renderQuestion(index);
      return;
    }
    const tied = computeAndCheckTies();
    tied ? startBonus(tied) : showResult();
  }

  function startBonus(tieSpices){
    inBonus = true;

    bonusQuestions = DATA.bonus
      .map(q => ({ text: q.text, options: q.options.filter(o => tieSpices.includes(o.spice)) }))
      .filter(q => q.options.length >= 2);

    if (bonusQuestions.length === 0){
      inBonus = false;
      showResult();
      return;
    }

    shuffle(bonusQuestions);
    bonusAnswers = Array(bonusQuestions.length).fill(null);
    bIndex = 0;

    setHidden(quizSec, true);
    setHidden(bonusSec, false);
    renderBonusQuestion(bIndex);
  }

  function bonusNext(){
    if (bonusAnswers[bIndex] == null) return;

    if (bIndex < bonusQuestions.length - 1){
      bIndex++;
      renderBonusQuestion(bIndex);
      return;
    }

    // apply bonus weight and finish
    const scores = tallyScores();
    bonusAnswers.forEach(s => { if (s) scores[s] = (scores[s] || 0) + 1; });

    // break any remaining ties deterministically
    const ordered = orderScores(scores);
    const topScore = ordered[0].score;
    const topTies = ordered.filter(s => s.score === topScore).map(s => s.key);
    if (topTies.length > 1){
      const pick = firstAppearance(topTies);
      scores[pick] += 0.01;
    }

    const after = orderScores(scores);
    const primary = after[0].key;
    const rest = after.filter(s => s.key !== primary);
    const secondScore = rest[0]?.score ?? -Infinity;
    const secTies = rest.filter(s => s.score === secondScore).map(s => s.key);
    if (secTies.length > 1){
      const pick2 = firstAppearance(secTies, primary);
      scores[pick2] += 0.005;
    }

    showResult(scores);
  }

  function bonusBack(){
    if (bIndex > 0){
      bIndex--;
      renderBonusQuestion(bIndex);
      return;
    }
    inBonus = false;
    setHidden(bonusSec, true);
    setHidden(quizSec, false);
    renderQuestion(index);
  }

  // --------------------------
  // SCORING
  // --------------------------
  function tallyScores(){
    const scores = {};
    DATA.spices.forEach(s => { scores[s.key] = 0; });
    answers.forEach(a => { if (a) scores[a] += 1; });
    return scores;
  }

  function computeAndCheckTies(){
    const scores = tallyScores();
    const ordered = orderScores(scores);

    const top = ordered[0]?.score ?? 0;
    const topTies = ordered.filter(s => s.score === top).map(s => s.key);
    if (topTies.length > 1) return topTies;

    const rest = ordered.slice(1);
    const second = rest[0]?.score ?? -Infinity;
    const secondTies = rest.filter(s => s.score === second).map(s => s.key);
    if (secondTies.length > 1) return secondTies;

    return null;
  }

  // --------------------------
  // RESULTS
  // --------------------------
  function specialName(primary, secondary){
    if (primary === 'posh'   && secondary === 'posh')   return 'True Posh';
    if (primary === 'baby'   && secondary === 'baby')   return 'All Baby';
    if (primary === 'sporty' && secondary === 'sporty') return 'Hard Sporty';
    if (primary === 'ginger' && secondary === 'ginger') return 'Full Ginger';
    if (primary === 'scary'  && secondary === 'scary')  return 'Max Scary';
    return `${cap(primary)} ${cap(secondary)}`;
  }

  function showResult(preComputed){
    const scores  = preComputed || tallyScores();
    const ordered = orderScores(scores);

    const primary   = ordered[0]?.key ?? 'posh';
    const secondary = ordered.find(s => s.key !== primary)?.key ?? primary;

    const pMeta = DATA.spices.find(s => s.key === primary);
    const sMeta = DATA.spices.find(s => s.key === secondary);

    const comboKey = `${primary}:${secondary}`;
    const blurb    = DATA.resultBlurbs[comboKey] || '';
    const title    = (primary === secondary)
      ? specialName(primary, secondary)
      : `${cap(secondary)} ${cap(primary)}`;

    // percentages from answered items only
    const totalAnswered = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
    const pct = x => Math.round((x / totalAnswered) * 100);
    const pPct = pct(scores[primary]   || 0);
    const sPct = pct(scores[secondary] || 0);

    resultBadges.innerHTML =
      `<span class="badge pill">${sMeta.name} ${sPct}%</span>` +
      `<span class="badge pill"><strong>${pMeta.name} ${pPct}%</strong></span>`;

    resultTitle.textContent = title;
    resultBlurb.textContent = blurb;

    primaryDesc.textContent   = DATA.descriptions[primary];
    secondaryDesc.textContent = DATA.descriptions[secondary];

    // buttons
    const retakeBtn = document.getElementById('retakeBtn');
    const shareBtn  = document.getElementById('shareBtn');

    function buildShareURL(primary, secondary, pPct, sPct){
      const url = new URL(location.origin + location.pathname);
      url.searchParams.set('primary', primary);
      url.searchParams.set('secondary', secondary);
      url.searchParams.set('ppct', String(pPct));
      url.searchParams.set('spct', String(sPct));
      return url.toString();
    }

    window.__lastResult = { primary, secondary, pPct, sPct };

    retakeBtn.onclick = () => {
      localStorage.removeItem('spiceQuizProgress');
      setHidden(resultSec, true);
      setHidden(bonusSec,  true);
      setHidden(quizSec,   false);
      startQuiz?.(DATA);
    };

    const nameOf = k => (DATA.spices.find(s => s.key === k)?.name ?? k);
    shareBtn.onclick = async () => {
      const res = window.__lastResult;
      if (!res) { alert('Take the quiz first'); return; }

      const shareURL = buildShareURL(res.primary, res.secondary, res.pPct, res.sPct);
      const text = `My Spice Theory result: ${nameOf(res.primary)} with ${nameOf(res.secondary)}. `
                 + `${res.pPct}% / ${res.sPct}%\n${shareURL}`;
      try{
        if (navigator.share){
          await navigator.share({ title: 'Spice Theory result', text, url: shareURL });
        } else if (navigator.clipboard?.writeText){
          await navigator.clipboard.writeText(shareURL);
          const old = shareBtn.textContent;
          shareBtn.textContent = 'Link copied!';
          setTimeout(() => (shareBtn.textContent = old), 1200);
        } else {
          prompt('Copy this link:', shareURL);
        }
      } catch (e){
        console.error(e);
        alert('Sharing was cancelled or failed');
      }
    };

    // emphasise primary block, ensure secondary first
    const grid           = resultSec.querySelector('.grid');
    const primaryBlock   = primaryDesc.closest('div');
    const secondaryBlock = secondaryDesc.closest('div');
    const primaryH3      = primaryBlock.querySelector('h3');
    const secondaryH3    = secondaryBlock.querySelector('h3');

    secondaryH3.textContent = `Secondary subtype (${sPct}%)`;
    primaryH3.textContent   = `Primary type (${pPct}%)`;

    if (grid && secondaryBlock !== grid.firstElementChild){
      grid.insertBefore(secondaryBlock, grid.firstElementChild);
      grid.appendChild(primaryBlock);
    }
    primaryBlock.classList.add('highlight-primary');
    primaryDesc.innerHTML = `<strong>${primaryDesc.textContent}</strong>`;

    setHidden(quizSec,  true);
    setHidden(bonusSec, true);
    setHidden(resultSec, false);

    bar.style.width = '100%';
    progressText.textContent = 'Complete';
  }

  // --------------------------
  // INIT
  // --------------------------
  function startQuiz(data){
    DATA = data;

    questions = DATA.questions.slice();
    shuffle(questions);
    answers = Array(questions.length).fill(null);
    index = 0;

    setHidden(resultSec, true);
    setHidden(bonusSec,  true);
    setHidden(quizSec,   false);

    updateProgress();
    renderQuestion(index);
  }

  // events
  nextBtn.addEventListener('click', goNext);
  backBtn.addEventListener('click', goBack);
  skipBtn.addEventListener('click', skip);

  bonusNextBtn.addEventListener('click', bonusNext);
  bonusBackBtn.addEventListener('click', bonusBack);

  // data
  fetch('./data/archetypes.json')
    .then(r => { if (!r.ok) throw new Error('Failed to load archetypes.json'); return r.json(); })
    .then(startQuiz)
    .catch(err => {
      console.error(err);
      progressText.textContent = 'Error loading quiz data.';
    });
})();
