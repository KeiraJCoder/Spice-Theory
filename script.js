/* script.js — Spice Theory Quiz (randomised, unbiased, editable)
    - Loads ./data/archetypes.json
    - Randomises questions each session
    - Randomises answer options each render
    - No colour cues on options (user chooses by resonance)
    - Selections are editable; scoring happens at the end
    - Results show SECONDARY first, then PRIMARY (dominant) highlighted
    - Percentages displayed for primary & secondary
*/

(() => {
  // ==========================
  // DOM LOOKUPS
  // ==========================
    const pillbar       = document.getElementById('pillbar');

    const bar           = document.getElementById('bar');
    const progressText  = document.getElementById('progressText');

    const quizSec       = document.getElementById('quiz');
    const qLegend       = document.getElementById('q-legend');
    const optionsBox    = document.getElementById('options');
    const backBtn       = document.getElementById('backBtn');
    const skipBtn       = document.getElementById('skipBtn');
    const nextBtn       = document.getElementById('nextBtn');

    const bonusSec      = document.getElementById('bonus');
    const bonusLegend   = document.getElementById('b-legend');
    const bonusOptions  = document.getElementById('bonusOptions');
    const bonusBackBtn  = document.getElementById('bonusBackBtn');
    const bonusNextBtn  = document.getElementById('bonusNextBtn');

    const resultSec     = document.getElementById('result');
    const resultBadges  = document.getElementById('resultBadges');
    const resultTitle   = document.getElementById('resultTitle');
    const resultBlurb   = document.getElementById('resultBlurb');
    const primaryDesc   = document.getElementById('primaryDesc');
    const secondaryDesc = document.getElementById('secondaryDesc');

    // ==========================
    // STATE
    // ==========================
    let DATA = null;

    // Main flow
    let questions = [];  // randomised copy of DATA.questions
    let answers   = [];  // answers[i] = spiceKey or null (skipped)
    let index     = 0;

    // Bonus flow
    let bonusQuestions = []; // filtered + randomised DATA.bonus
    let bonusAnswers   = []; // bonusAnswers[i] = spiceKey or null
    let bIndex         = 0;
    let inBonus        = false;

    // ==========================
    // HELPERS
    // ==========================
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

    function shuffleInPlace(arr){
        for (let i = arr.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function specialName(primary, secondary){
        if (primary === 'posh'   && secondary === 'posh')   return 'True Posh';
        if (primary === 'baby'   && secondary === 'baby')   return 'All Baby';
        if (primary === 'sporty' && secondary === 'sporty') return 'Hard Sporty';
        if (primary === 'ginger' && secondary === 'ginger') return 'Full Ginger';
        if (primary === 'scary'  && secondary === 'scary')  return 'Max Scary';
        return `${cap(primary)} ${cap(secondary)}`;
    }

    function orderScores(obj){
        return Object.entries(obj)
            .map(([key, score]) => ({ key, score }))
            .sort((a, b) => b.score - a.score);
    }

    // Deterministic tie-break using earliest answer leaning
    function firstAppearance(candidates, exclude){
        for (let i = 0; i < answers.length; i++){
            const s = answers[i];
            if (!s) continue;
            if (exclude && s === exclude) continue;
            if (candidates.includes(s)) return s;
        }
        return candidates[0];
    }

    function setHidden(el, flag){
        if (flag) el.classList.add('hidden');
        else el.classList.remove('hidden');
    }

    // Shows a single continuous sequence across main + bonus
// Replace your updateProgress() with this:
    function updateProgress() {
    // total = all main questions + any bonus questions we’re currently showing
    const total = questions.length + (inBonus ? bonusQuestions.length : 0);

    // completed so far (0-based): before the current item
    const completed = inBonus ? (questions.length + bIndex) : index;
    const current = Math.min(completed + 1, Math.max(total, 1)); // 1-based display

    const pct = Math.max(0, Math.min(100, (completed / Math.max(total, 1)) * 100));
    bar.style.width = `${pct}%`;
    progressText.textContent = `Question ${current} of ${total}`;
    }


    // ==========================
    // RENDERERS
    // ==========================
    function renderPillbar(){
        pillbar.innerHTML = '';
        DATA.spices.forEach(s => {
            const span = document.createElement('span');
            // Neutral styling to avoid colour bias
            span.className = 'pill';
            span.textContent = s.name;
            pillbar.appendChild(span);
        });
    }

    function renderQuestion(i){
        const q = questions[i];
        qLegend.textContent = q.text;

        // Randomise answers each time the question is shown
        const opts = shuffleInPlace(q.options.slice());

        optionsBox.innerHTML = '';
        opts.forEach((opt, idx) => {
        const id    = `q${i}_opt${idx}`;
        const label = document.createElement('label');
        label.className = 'option';
        label.setAttribute('for', id);

        const input = document.createElement('input');
        input.type  = 'radio';
        input.id    = id;
        input.name  = `q${i}`;
        input.value = opt.spice;

        // Preserve prior selection if any
        if (answers[i] === opt.spice) input.checked = true;

        const text  = document.createElement('span');
        text.textContent = opt.label;

        // Editable: update selection immediately
        input.addEventListener('change', () => {
            answers[i] = input.value;
            nextBtn.disabled = false;
        });

        label.appendChild(input);
        label.appendChild(text);
        optionsBox.appendChild(label);
    });

        backBtn.disabled = i === 0;
        nextBtn.disabled = answers[i] == null; // enable only when chosen
        skipBtn.disabled = false;

        updateProgress();
    }

    function renderBonusQuestion(i) {
        const q = bonusQuestions[i];

        // Number the bonus as a continuation of the main sequence
        const total = questions.length + bonusQuestions.length;
        const overallIndex = questions.length + i + 1;
        bonusLegend.textContent = `Question ${overallIndex} of ${total}`;

        // Put the actual question text in the subtitle line
        const bSub = document.getElementById('b-sub');
        if (bSub) bSub.textContent = q.text;

        // Randomise options each render
        const opts = shuffleInPlace(q.options.slice());
        bonusOptions.innerHTML = '';
        opts.forEach((opt, idx) => {
            const id = `b${i}_opt${idx}`;
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

            label.appendChild(input);
            label.appendChild(text);
            bonusOptions.appendChild(label);
        });

        bonusBackBtn.disabled = i === 0;
        bonusNextBtn.disabled = bonusAnswers[i] == null;

        updateProgress();
    }



    // ==========================
    // FLOW CONTROL
    // ==========================
    function goNext(){
        if (answers[index] == null) return; // UI should prevent, guard anyway
        if (index < questions.length - 1){
            index++;
            renderQuestion(index);
        } else {
        // End of main questions
            const tied = computeAndCheckTies();
            if (tied) startBonus(tied);
            else showResult();
        }
    }

    function goBack(){
        if (index > 0){
            index--;
            renderQuestion(index);
        }
    }

    function skip(){
        // keep answers[index] as null and advance
        if (index < questions.length - 1){
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

            bonusQuestions = DATA.bonus.map(q => ({
                text: q.text,
                options: q.options.filter(o => tieSpices.includes(o.spice))
            })).filter(q => q.options.length >= 2);

            // ⬇️ If nothing valid to ask, skip straight to results
            if (bonusQuestions.length === 0) {
                inBonus = false;
                showResult();
                return;
            }

            shuffleInPlace(bonusQuestions);
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
        } else {
        // Apply bonus answers to scores and finish
            const scores = tallyScores();
            bonusAnswers.forEach(s => { if (s) scores[s] = (scores[s] || 0) + 1; });

        // Primary tie resolution
            const ordered   = orderScores(scores);
            const topScore  = ordered[0].score;
            const topTies   = ordered.filter(s => s.score === topScore).map(s => s.key);
            if (topTies.length > 1){
            const pick = firstAppearance(topTies);
            scores[pick] += 0.01;
        }

        // Secondary tie resolution
            const after        = orderScores(scores);
            const primary      = after[0].key;
            const rest         = after.filter(s => s.key !== primary);
            const secondScore  = rest[0]?.score ?? -Infinity;
            const secTies      = rest.filter(s => s.score === secondScore).map(s => s.key);
            if (secTies.length > 1){
            const pick2 = firstAppearance(secTies, primary);
            scores[pick2] += 0.005;
        }

        showResult(scores);
        }
    }

    function bonusBack(){
        if (bIndex > 0){
            bIndex--;
            renderBonusQuestion(bIndex);
        } else {
        // Return to main quiz
            inBonus = false;
            setHidden(bonusSec, true);
            setHidden(quizSec,  false);
            renderQuestion(index);
        }
    }

    // ==========================
    // SCORING AND TIE CHECKING
    // ==========================
    function tallyScores(){
        const scores = {};
        DATA.spices.forEach(s => { scores[s.key] = 0; });
        answers.forEach(a => { if (a) scores[a] += 1; });
        return scores;
    }

    function computeAndCheckTies(){
        const scores  = tallyScores();
        const ordered = orderScores(scores);

        const top      = ordered[0]?.score ?? 0;
        const topTies  = ordered.filter(s => s.score === top).map(s => s.key);
        if (topTies.length > 1) return topTies;

        // Check secondary tie among remaining
        const rest       = ordered.filter(s => s.key !== ordered[0].key);
        const second     = rest[0]?.score ?? -Infinity;
        const secondTies = rest.filter(s => s.score === second).map(s => s.key);
        if (secondTies.length > 1) return secondTies;

        return null; // no tie needs bonus
    }

    // ==========================
    // RESULTS
    // ==========================
    function showResult(preComputedScores) {
        const scores  = preComputedScores || tallyScores();
        const ordered = orderScores(scores);

        const primary   = ordered[0]?.key ?? 'posh';
        const secondary = ordered.find(s => s.key !== primary)?.key ?? primary;

        const pMeta = DATA.spices.find(s => s.key === primary);
        const sMeta = DATA.spices.find(s => s.key === secondary);

        const comboKey = `${primary}:${secondary}`;
        const blurb    = DATA.resultBlurbs[comboKey] || '';
        const title    = (primary === secondary) ? specialName(primary, secondary)
                                                : `${cap(secondary)} ${cap(primary)}`;

        // Percentages from answered items only
        const totalAnswered = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
        const pScore = scores[primary]   || 0;
        const sScore = scores[secondary] || 0;
        const pct    = x => Math.round((x / totalAnswered) * 100);
        const pPct   = pct(pScore);
        const sPct   = pct(sScore);

        // Badges (secondary first, primary emphasised)
        resultBadges.innerHTML = `
            <span class="badge pill">${sMeta.name} ${sPct}%</span>
            <span class="badge pill"><strong>${pMeta.name} ${pPct}%</strong></span>
        `;

        // Title & blurb
        resultTitle.textContent = title;
        resultBlurb.textContent = blurb;

        // Descriptions
        primaryDesc.textContent   = DATA.descriptions[primary];
        secondaryDesc.textContent = DATA.descriptions[secondary];

        // Buttons
        const retakeBtn = document.getElementById('retakeBtn');
        const shareBtn  = document.getElementById('shareBtn');

        // Build a clean shareable URL (avoid duplicating query params)
        function buildShareURL(primary, secondary, pPct, sPct) {
            const url = new URL(location.origin + location.pathname);
            url.searchParams.set('primary',   primary);
            url.searchParams.set('secondary', secondary);
            url.searchParams.set('ppct',      String(pPct));
            url.searchParams.set('spct',      String(sPct));
            return url.toString();
        }

        // Save last result for the share handler
        window.__lastResult = { primary, secondary, pPct, sPct };

        // Retake
        retakeBtn.onclick = () => {
            localStorage.removeItem('spiceQuizProgress');
            setHidden(resultSec, true);
            setHidden(bonusSec,  true);
            setHidden(quizSec,   false);
            startQuiz?.(DATA);
        };

        // Share: Web Share API → clipboard → prompt
        shareBtn.onclick = async () => {
            const res = window.__lastResult;
            if (!res) { alert('Take the quiz first'); return; }

            const shareURL = buildShareURL(res.primary, res.secondary, res.pPct, res.sPct);
            const text = `My Spice Theory result: ${res.primary} with ${res.secondary}. `
                    + `${res.pPct}% / ${res.sPct}%\n${shareURL}`;
            try {
            if (navigator.share) {
                await navigator.share({ title: 'Spice Theory result', text, url: shareURL });
            } else if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(shareURL);
                const old = shareBtn.textContent;
                shareBtn.textContent = 'Link copied!';
                setTimeout(() => (shareBtn.textContent = old), 1200);
            } else {
                prompt('Copy this link:', shareURL);
            }
            } catch (e) {
            console.error(e);
            alert('Sharing was cancelled or failed');
            }
        };

        // Headings with percentages, and primary emphasis block
        const grid           = resultSec.querySelector('.grid');
        const primaryBlock   = primaryDesc.closest('div');
        const secondaryBlock = secondaryDesc.closest('div');
        const primaryH3      = primaryBlock.querySelector('h3');
        const secondaryH3    = secondaryBlock.querySelector('h3');

        secondaryH3.textContent = `Secondary subtype (${sPct}%)`;
        primaryH3.textContent   = `Primary type (${pPct}%)`;

        // Ensure secondary first & highlight primary
        if (grid && secondaryBlock !== grid.firstElementChild) {
            grid.insertBefore(secondaryBlock, grid.firstElementChild);
            grid.appendChild(primaryBlock);
        }
        primaryBlock.classList.add('highlight-primary');

        // Safety: bold primary text even if CSS fails to load
        primaryDesc.innerHTML = `<strong>${primaryDesc.textContent}</strong>`;

        // Show results, hide quiz/bonus
        setHidden(quizSec,  true);
        setHidden(bonusSec, true);
        setHidden(resultSec, false);

        // Progress complete
        bar.style.width = '100%';
        progressText.textContent = 'Complete';
    }


    // ==========================
    // INIT
    // ==========================
    function startQuiz(data){
        DATA = data;

        renderPillbar();

        // Randomise questions each session
        questions = DATA.questions.slice();
        shuffleInPlace(questions);
        answers = Array(questions.length).fill(null);
        index = 0;

        setHidden(resultSec, true);
        setHidden(bonusSec,  true);
        setHidden(quizSec,   false);

        updateProgress();
        renderQuestion(index);
    }

    // ==========================
    // EVENTS
    // ==========================
        nextBtn.addEventListener('click', goNext);
        backBtn.addEventListener('click', goBack);
        skipBtn.addEventListener('click', skip);

        bonusNextBtn.addEventListener('click', bonusNext);
        bonusBackBtn.addEventListener('click', bonusBack);

    // ==========================
    // DATA LOAD
    // ==========================
    fetch('./data/archetypes.json')
        .then(r => {
            if (!r.ok) throw new Error('Failed to load archetypes.json');
            return r.json();
        })
        .then(startQuiz)
        .catch(err => {
            console.error(err);
            progressText.textContent = 'Error loading quiz data.';
        });
    })();
