/* script.js — Spice Theory Quiz (randomised, unbiased, editable)
   - Loads ./data/archetypes.json
   - Randomises questions each session
   - Randomises answer options each render
   - No colour cues on options (user chooses by resonance)
   - Selections are editable; scoring happens at the end
*/

(() => {
  // ---------- DOM ----------
  const pillbar = document.getElementById('pillbar');

  const bar = document.getElementById('bar');
  const progressText = document.getElementById('progressText');

  const quizSec = document.getElementById('quiz');
  const qLegend = document.getElementById('q-legend');
  const optionsBox = document.getElementById('options');
  const backBtn = document.getElementById('backBtn');
  const skipBtn = document.getElementById('skipBtn');
  const nextBtn = document.getElementById('nextBtn');

  const bonusSec = document.getElementById('bonus');
  const bonusLegend = document.getElementById('b-legend');
  const bonusOptions = document.getElementById('bonusOptions');
  const bonusBackBtn = document.getElementById('bonusBackBtn');
  const bonusNextBtn = document.getElementById('bonusNextBtn');

  const resultSec = document.getElementById('result');
  const resultBadges = document.getElementById('resultBadges');
  const resultTitle = document.getElementById('resultTitle');
  const resultBlurb = document.getElementById('resultBlurb');
  const primaryDesc = document.getElementById('primaryDesc');
  const secondaryDesc = document.getElementById('secondaryDesc');

  // ---------- State ----------
  let DATA = null;

  // Main flow
  let questions = [];       // randomised copy of DATA.questions
  let answers = [];         // answers[i] = spiceKey or null (skipped)
  let index = 0;

  // Bonus flow
  let bonusQuestions = [];  // filtered + randomised DATA.bonus
  let bonusAnswers = [];    // bonusAnswers[i] = spiceKey or null
  let bIndex = 0;
  let inBonus = false;

  // ---------- Helpers ----------
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function specialName(primary, secondary) {
    if (primary === 'posh'   && secondary === 'posh')   return 'True Posh';
    if (primary === 'baby'   && secondary === 'baby')   return 'All Baby';
    if (primary === 'sporty' && secondary === 'sporty') return 'Hard Sporty';
    if (primary === 'ginger' && secondary === 'ginger') return 'Full Ginger';
    if (primary === 'scary'  && secondary === 'scary')  return 'Max Scary';
    return `${cap(primary)} ${cap(secondary)}`;
  }

  function orderScores(obj) {
    return Object.entries(obj)
      .map(([key, score]) => ({ key, score }))
      .sort((a, b) => b.score - a.score);
  }

  function firstAppearance(candidates, exclude) {
    // resolve ties deterministically based on earliest user lean
    for (let i = 0; i < answers.length; i++) {
      const s = answers[i];
      if (!s) continue;
      if (exclude && s === exclude) continue;
      if (candidates.includes(s)) return s;
    }
    return candidates[0];
  }

  function setHidden(el, flag) {
    if (flag) el.classList.add('hidden');
    else el.classList.remove('hidden');
  }

  function updateProgress() {
    const total = questions.length;
    const pct = Math.max(0, Math.min(100, (index / total) * 100));
    bar.style.width = `${pct}%`;
    progressText.textContent = `Question ${Math.min(index + 1, total)} of ${total}`;
  }

  // ---------- Rendering ----------
  function renderPillbar() {
    pillbar.innerHTML = '';
    DATA.spices.forEach(s => {
      const span = document.createElement('span');
      // NOTE: no colour coordination for bias reduction; keep neutral pill styling
      span.className = 'pill';
      span.textContent = s.name;
      pillbar.appendChild(span);
    });
  }

  function renderQuestion(i) {
    const q = questions[i];
    qLegend.textContent = q.text;

    // Randomise answers **each time** the question is shown
    const opts = shuffleInPlace(q.options.slice());

    optionsBox.innerHTML = '';
    opts.forEach((opt, idx) => {
      const id = `q${i}_opt${idx}`;
      const label = document.createElement('label');
      label.className = 'option'; // neutral style
      label.setAttribute('for', id);

      const input = document.createElement('input');
      input.type = 'radio';
      input.id = id;
      input.name = `q${i}`;
      input.value = opt.spice;

      // Preserve prior selection if any
      if (answers[i] === opt.spice) input.checked = true;

      const text = document.createElement('span');
      text.textContent = opt.label;

      // Update answer whenever selection changes (editable)
      input.addEventListener('change', () => {
        answers[i] = input.value;
        nextBtn.disabled = false;
      });

      label.appendChild(input);
      label.appendChild(text);
      optionsBox.appendChild(label);
    });

    backBtn.disabled = i === 0;
    // Next is enabled only if there is a selection
    nextBtn.disabled = answers[i] == null;
    skipBtn.disabled = false;

    updateProgress();
  }

  function renderBonusQuestion(i) {
    const q = bonusQuestions[i];
    bonusLegend.textContent = q.text;

    // Randomise bonus options each render too
    const opts = shuffleInPlace(q.options.slice());

    bonusOptions.innerHTML = '';
    opts.forEach((opt, idx) => {
      const id = `b${i}_opt${idx}`;
      const label = document.createElement('label');
      label.className = 'option'; // neutral style
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

      label.appendChild(input);
      label.appendChild(text);
      bonusOptions.appendChild(label);
    });

    bonusBackBtn.disabled = i === 0;
    bonusNextBtn.disabled = bonusAnswers[i] == null;
  }

  // ---------- Flow control ----------
  function goNext() {
    if (answers[index] == null) return; // guard, though Next is disabled in UI
    if (index < questions.length - 1) {
      index++;
      renderQuestion(index);
    } else {
      // End of main questions
      const tied = computeAndCheckTies();
      if (tied) startBonus(tied);
      else showResult();
    }
  }

  function goBack() {
    if (index > 0) {
      index--;
      renderQuestion(index);
    }
  }

  function skip() {
    // keep answers[index] as null and advance
    if (index < questions.length - 1) {
      index++;
      renderQuestion(index);
    } else {
      const tied = computeAndCheckTies();
      if (tied) startBonus(tied);
      else showResult();
    }
  }

  function startBonus(tieSpices) {
    inBonus = true;

    // Build bonus question set limited to tied spices, and randomise order
    bonusQuestions = DATA.bonus.map(q => ({
      text: q.text,
      options: q.options.filter(o => tieSpices.includes(o.spice))
    })).filter(q => q.options.length >= 2);

    shuffleInPlace(bonusQuestions);
    bonusAnswers = Array(bonusQuestions.length).fill(null);
    bIndex = 0;

    setHidden(quizSec, true);
    setHidden(bonusSec, false);
    renderBonusQuestion(bIndex);
  }

  function bonusNext() {
    if (bonusAnswers[bIndex] == null) return; // guard
    if (bIndex < bonusQuestions.length - 1) {
      bIndex++;
      renderBonusQuestion(bIndex);
    } else {
      // Apply bonus answers to scores and finish
      const scores = tallyScores();
      bonusAnswers.forEach(s => { if (s) scores[s] = (scores[s] || 0) + 1; });

      // If still tied, resolve deterministically
      const ordered = orderScores(scores);
      const topScore = ordered[0].score;
      const topTies = ordered.filter(s => s.score === topScore).map(s => s.key);
      if (topTies.length > 1) {
        const pick = firstAppearance(topTies);
        scores[pick] += 0.01;
      }
      // Secondary ties
      const after = orderScores(scores);
      const primary = after[0].key;
      const rest = after.filter(s => s.key !== primary);
      const secondScore = rest[0]?.score ?? -Infinity;
      const secTies = rest.filter(s => s.score === secondScore).map(s => s.key);
      if (secTies.length > 1) {
        const pick2 = firstAppearance(secTies, primary);
        scores[pick2] += 0.005;
      }

      showResult(scores);
    }
  }

  function bonusBack() {
    if (bIndex > 0) {
      bIndex--;
      renderBonusQuestion(bIndex);
    } else {
      // Return to main quiz
      inBonus = false;
      setHidden(bonusSec, true);
      setHidden(quizSec, false);
      renderQuestion(index);
    }
  }

  // ---------- Scoring & Ties ----------
  function tallyScores() {
    const scores = {};
    DATA.spices.forEach(s => { scores[s.key] = 0; });
    answers.forEach(a => { if (a) scores[a] += 1; });
    return scores;
  }

  function computeAndCheckTies() {
    const scores = tallyScores();
    const ordered = orderScores(scores);
    const top = ordered[0]?.score ?? 0;
    const topTies = ordered.filter(s => s.score === top).map(s => s.key);

    if (topTies.length > 1) return topTies;

    // Check secondary tie among remaining
    const rest = ordered.filter(s => s.key !== ordered[0].key);
    const second = rest[0]?.score ?? -Infinity;
    const secondTies = rest.filter(s => s.score === second).map(s => s.key);
    if (secondTies.length > 1) return secondTies;

    return null; // no tie that needs bonus
  }

  // ---------- Results ----------
  function showResult(preComputedScores) {
    const scores = preComputedScores || tallyScores();
    const ordered = orderScores(scores);

    const primary = ordered[0]?.key ?? 'posh';
    const secondary = ordered.filter(s => s.key !== primary)[0]?.key ?? primary;

    const pMeta = DATA.spices.find(s => s.key === primary);
    const sMeta = DATA.spices.find(s => s.key === secondary);

    const comboKey = `${primary}:${secondary}`;
    const blurb = DATA.resultBlurbs[comboKey] || '';
    const title = specialName(primary, secondary);

    // UI
    resultBadges.innerHTML = `
      <span class="badge pill">${pMeta.name}</span>
      <span class="badge pill">${sMeta.name}</span>
    `;
    resultTitle.textContent = title;
    resultBlurb.textContent = blurb;
    primaryDesc.textContent = DATA.descriptions[primary];
    secondaryDesc.textContent = DATA.descriptions[secondary];

    setHidden(quizSec, true);
    setHidden(bonusSec, true);
    setHidden(resultSec, false);

    // Progress complete
    bar.style.width = '100%';
    progressText.textContent = 'Complete';
  }

  // ---------- Init ----------
  function startQuiz(data) {
    DATA = data;

    // Render neutral pillbar (no colour bias)
    renderPillbar();

    // Create randomised copy of questions
    questions = DATA.questions.slice();
    shuffleInPlace(questions);
    answers = Array(questions.length).fill(null);
    index = 0;

    setHidden(resultSec, true);
    setHidden(bonusSec, true);
    setHidden(quizSec, false);

    updateProgress();
    renderQuestion(index);
  }

  // ---------- Events ----------
  nextBtn.addEventListener('click', goNext);
  backBtn.addEventListener('click', goBack);
  skipBtn.addEventListener('click', skip);

  bonusNextBtn.addEventListener('click', bonusNext);
  bonusBackBtn.addEventListener('click', bonusBack);

  // ---------- Data load ----------
  fetch('./data/archetypes.json')
    .then(r => { if (!r.ok) throw new Error('Failed to load archetypes.json'); return r.json(); })
    .then(startQuiz)
    .catch(err => {
      console.error(err);
      progressText.textContent = 'Error loading quiz data.';
    });
})();
