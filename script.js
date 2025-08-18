/* script.js — Spice Theory Quiz (simplified, fixed percentages)
   - Loads ./data/archetypes.json
   - Randomises questions per session and options per render
   - Editable selections; scoring at end
   - Bonus appears ONLY if top two are exactly tied after main questions
   - Bonus choices are restricted to the two tied spices
   - Results show Secondary first, then Primary
   - Percentages are computed from RAW counts (main + bonus), no tie-break nudges
   - Result blocks show an image for Primary and Secondary based on DATA.spices[*].image
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

  let bonusQuestions = []; // filtered to tied spices, shuffled
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

    // Restrict every bonus question to ONLY the tied spices
    bonusQuestions = DATA.bonus
      .map(q => ({ text: q.text, options: q.options.filter(o => tieSpices.includes(o.spice)) }))
      .filter(q => q.options.length >= 2);

    if (bonusQuestions.length === 0){
      inBonus = false;
      showResult(); // nothing to ask — go straight to result with deterministic resolver
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

    // Apply bonus picks into scores used for ORDERING (NOT for % display)
    const scores = tallyScores();
    bonusAnswers.forEach(s => { if (s) scores[s] = (scores[s] || 0) + 1; });

    // Resolve only between the two tied spices
    const ordered = orderScores(scores);
    const topScore = ordered[0].score;
    const topTies = ordered.filter(s => s.score === topScore).map(s => s.key);

    if (topTies.length > 1){
      // Still tied after bonus — pick by earliest appearance in the main answers
      const pick = firstAppearance(topTies);
      scores[pick] += 0.0001; // microscopic nudge to break sort tie without affecting % display
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
  // Scores from MAIN answers only
  function tallyScores(){
    const scores = {};
    DATA.spices.forEach(s => { scores[s.key] = 0; });
    answers.forEach(a => { if (a) scores[a] += 1; });
    return scores;
  }

  // RAW integer counts from MAIN + BONUS, no nudges (used for % display)
  function rawCounts(){
    const counts = {};
    DATA.spices.forEach(s => { counts[s.key] = 0; });

    // main answers
    answers.forEach(a => { if (a) counts[a] += 1; });

    // bonus answers (if any)
    if (Array.isArray(bonusAnswers)){
      bonusAnswers.forEach(a => { if (a) counts[a] += 1; });
    }
    return counts;
  }

  // Return [topKey, secondKey] ONLY if there is an exact tie for first place after main questions
  function computeAndCheckTies(){
    const scores  = tallyScores();
    const ordered = orderScores(scores);

    if (!ordered.length) return null;

    const top     = ordered[0];
    const second  = ordered[1];

    // Only trigger bonus if the top two are EXACTLY tied
    if (second && top.score === second.score){
      return [top.key, second.key];
    }
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
    // 1) ORDERING: use possibly nudged scores to decide primary and secondary
    const scores  = preComputed || tallyScores(); // may have tiny nudge only to break sort
    const ordered = orderScores(scores);

    let primary   = ordered[0]?.key ?? 'posh';
    let secondary = ordered.find(s => s.key !== primary)?.key ?? primary;

    const pMeta = DATA.spices.find(s => s.key === primary);
    const sMeta = DATA.spices.find(s => s.key === secondary);

    // 2) PERCENTAGES from RAW counts (main + bonus), NO nudges
    const raw = rawCounts();
    const totalAnswered = Object.values(raw).reduce((a, b) => a + b, 0) || 1;
    const pct = x => Math.round((x / totalAnswered) * 100);

    // Pure result = ONLY one spice scored at all
    const isPure = (ordered[1]?.score ?? 0) === 0;

    // If pure, collapse to one card and force 100%
    const pPct = isPure ? 100 : pct(raw[primary]   || 0);
    const sPct = isPure ? 0   : pct(raw[secondary] || 0);

    if (isPure){
      secondary = primary; // for specialName + blurb key
    }

    const comboKey = `${primary}:${secondary}`;
    const blurb    = DATA.resultBlurbs[comboKey] || '';
    const title    = (primary === secondary)
      ? specialName(primary, secondary)
      : `${cap(secondary)} ${cap(primary)}`;

    // Pills
    if (isPure){
      resultBadges.innerHTML = `<span class="badge pill"><strong>${pMeta.name} 100%</strong></span>`;
    } else {
      resultBadges.innerHTML =
        `<span class="badge pill">${sMeta.name} ${sPct}%</span>` +
        `<span class="badge pill"><strong>${pMeta.name} ${pPct}%</strong></span>`;
    }

    // Titles and copy
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
      const text = isPure
        ? `My Spice Theory result: ${nameOf(res.primary)} — 100%\n${shareURL}`
        : `My Spice Theory result: ${nameOf(res.primary)} with ${nameOf(res.secondary)}. ${res.pPct}% / ${res.sPct}%\n${shareURL}`;
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

    if (isPure){
      setHidden(secondaryBlock, true);
      primaryH3.textContent = `Your type (100%)`;
    } else {
      setHidden(secondaryBlock, false);
      secondaryH3.textContent = `Secondary subtype (${sPct}%)`;
      primaryH3.textContent   = `Primary type (${pPct}%)`;

      if (grid && secondaryBlock !== grid.firstElementChild){
        grid.insertBefore(secondaryBlock, grid.firstElementChild);
        grid.appendChild(primaryBlock);
      }
    }

    // Visual emphasis + colour per spice
    primaryBlock.classList.add('highlight-primary');
    primaryBlock.classList.remove('posh','baby','sporty','ginger','scary');
    primaryBlock.classList.add(pMeta?.colorClass || primary);

    // insert images
    function upsertImage(block, meta){
      if (!block || !meta) return;
      let img = block.querySelector('.result-img');
      if (!img){
        img = document.createElement('img');
        img.className = 'result-img';
        img.loading = 'lazy';
        block.insertBefore(img, block.firstChild);
      }
      img.src = meta.image || '';
      img.alt = meta.name || 'Result image';
    }
    upsertImage(primaryBlock, pMeta);
    if (!isPure){
      upsertImage(secondaryBlock, sMeta);
    }

    // emphasise primary copy
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

    // Warm the cache for result images
    (DATA.spices || []).forEach(s => {
      if (s.image){
        const i = new Image();
        i.src = s.image;
      }
    });

    questions = DATA.questions.slice();
    shuffle(questions);
    answers = Array(questions.length).fill(null);
    index = 0;

    // reset any previous bonus state
    bonusQuestions = [];
    bonusAnswers   = [];
    bIndex = 0;
    inBonus = false;

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

  function getSpice(key){
    return DATA?.spices?.find(s => s.key === key) || null;
  }

})();
