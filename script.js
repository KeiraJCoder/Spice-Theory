/* ============================================================================
    Spice Theory – script.js (clean, commented)
    - Loads ./data/archetypes.json
    - Shuffles questions (once per run) and options (each render)
    - Lets users change answers freely (Back/Next/Skip)
    - If (and only if) the top two are EXACTLY tied, a bonus round appears
        limited to those two spices; otherwise results show immediately
    - Percentages are based on RAW counts (main + bonus). No tie nudges.
    - Results show Secondary first, then Primary, with images.
    - "Save Result" renders a PNG that:
        • uses the correct dominant-title color
        • contains both images in fixed boxes (no overlap)
        • expands canvas height to fit all text (no clipping)
    ============================================================================ */

(() => {
    // ---------------------------------------------------------------------------
    // DOM lookups
    // ---------------------------------------------------------------------------
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

    // ---------------------------------------------------------------------------
    // State
    // ---------------------------------------------------------------------------
    let DATA = null;

    let questions = [];   // shuffled questions
    let answers   = [];   // answers[i] = spiceKey | null
    let index     = 0;

    let bonusQuestions = [];
    let bonusAnswers   = [];
    let bIndex         = 0;
    let inBonus        = false;

    // ---------------------------------------------------------------------------
    // Utilities
    // ---------------------------------------------------------------------------
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

    const SPICE_COLOUR = {
        posh:   '#000000',
        baby:   '#ff7ab6',
        sporty: '#2b6eff',
        ginger: '#ff7b00',
        scary:  '#f0e857'
    };

    function shuffle(arr){
        for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function setHidden(el, flag){ el.classList.toggle('hidden', !!flag); }

    function orderScores(obj){
        return Object.entries(obj)
        .map(([key, score]) => ({ key, score }))
        .sort((a, b) => b.score - a.score);
    }

    // Earliest leaning wins a tie (deterministic)
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

    // ---------------------------------------------------------------------------
    // Rendering (main + bonus)
    // ---------------------------------------------------------------------------
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

    // ---------------------------------------------------------------------------
    // Flow
    // ---------------------------------------------------------------------------
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

        // Limit every bonus question to ONLY the tied spices
        const pool = DATA.bonus
        .map(q => ({
            text: q.text,
            options: q.options.filter(o => tieSpices.includes(o.spice))
        }))
        .filter(q => q.options.length >= 2);

        shuffle(pool);
        const numToUse = Math.min(5, Math.max(3, Math.floor(Math.random() * 5) + 3));
        bonusQuestions = pool.slice(0, numToUse);

        if (!bonusQuestions.length){
        inBonus = false;
        showResult(); // nothing to ask – resolve deterministically
        return;
        }

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

        // Use main scores + bonus picks to ORDER (not for % display)
        const scores = tallyScores();
        bonusAnswers.forEach(s => { if (s) scores[s] = (scores[s] || 0) + 1; });

        // If still tied, break by earliest appearance during the main round
        const ordered = orderScores(scores);
        const topScore = ordered[0].score;
        const topTies = ordered.filter(s => s.score === topScore).map(s => s.key);

        if (topTies.length > 1){
        const pick = firstAppearance(topTies);
        scores[pick] += 0.0001; // microscopic nudge to break the sort tie
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

    // ---------------------------------------------------------------------------
    // Scoring
    // ---------------------------------------------------------------------------
    function tallyScores(){
        const scores = {};
        DATA.spices.forEach(s => { scores[s.key] = 0; });
        answers.forEach(a => { if (a) scores[a] += 1; });
        return scores;
    }

    function rawCounts(){
        const counts = {};
        DATA.spices.forEach(s => { counts[s.key] = 0; });
        answers.forEach(a => { if (a) counts[a] += 1; });
        if (Array.isArray(bonusAnswers)){
        bonusAnswers.forEach(a => { if (a) counts[a] += 1; });
        }
        return counts;
    }

    // Return [top, second] ONLY if top two are EXACTLY tied after main round
    function computeAndCheckTies(){
        const scores  = tallyScores();
        const ordered = orderScores(scores);
        if (!ordered.length) return null;
        const top    = ordered[0];
        const second = ordered[1];
        return (second && top.score === second.score) ? [top.key, second.key] : null;
    }

    // ---------------------------------------------------------------------------
    // Results
    // ---------------------------------------------------------------------------
    function specialName(primary, secondary){
        if (primary === 'posh'   && secondary === 'posh')   return 'True Posh';
        if (primary === 'baby'   && secondary === 'baby')   return 'All Baby';
        if (primary === 'sporty' && secondary === 'sporty') return 'Hard Sporty';
        if (primary === 'ginger' && secondary === 'ginger') return 'Full Ginger';
        if (primary === 'scary'  && secondary === 'scary')  return 'Max Scary';
        return `${cap(primary)} ${cap(secondary)}`;
    }

    function showResult(preComputed){
        // ORDERING uses possibly nudged scores to break ties deterministically
        const scores  = preComputed || tallyScores();
        const ordered = orderScores(scores);

        let primary   = ordered[0]?.key ?? 'posh';
        let secondary = ordered.find(s => s.key !== primary)?.key ?? primary;

        const pMeta = DATA.spices.find(s => s.key === primary);
        const sMeta = DATA.spices.find(s => s.key === secondary);

        // PERCENTAGES from RAW counts (main + bonus), NO nudges
        const raw = rawCounts();
        const totalAnswered = Object.values(raw).reduce((a, b) => a + b, 0) || 1;
        const pct = (x) => Math.round((x / totalAnswered) * 100);

        // Pure result = ONLY one spice scored at all
        const isPure = (ordered[1]?.score ?? 0) === 0;
        const pPct = isPure ? 100 : pct(raw[primary]   || 0);
        const sPct = isPure ? 0   : pct(raw[secondary] || 0);
        if (isPure) secondary = primary; // unify for blurb/special title

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

        // Text content
        resultTitle.textContent = title;
        resultBlurb.textContent = blurb;
        primaryDesc.textContent   = DATA.descriptions[primary];
        secondaryDesc.textContent = DATA.descriptions[secondary];

        // Buttons
        const retakeBtn = document.getElementById('retakeBtn');
        const shareBtn  = document.getElementById('shareBtn');

        window.__lastResult = { primary, secondary, pPct, sPct };

        retakeBtn.onclick = () => {
        localStorage.removeItem('spiceQuizProgress');
        setHidden(resultSec, true);
        setHidden(bonusSec,  true);
        setHidden(quizSec,   false);
        startQuiz?.(DATA);
        };

        // ----------------------
        // SAVE RESULT → PNG
        // ----------------------

        // Shared canvas helpers (centralized to avoid duplication)
        function wrapText(ctx, text, x, y, maxWidth, lineHeight){
        const words = String(text || '').split(/\s+/);
        let line = '', lines = [];
        for (const w of words){
            const test = line ? line + ' ' + w : w;
            if (ctx.measureText(test).width > maxWidth && line){
            lines.push(line); line = w;
            } else {
            line = test;
            }
        }
        if (line) lines.push(line);
        lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lineHeight));
        return y + lines.length * lineHeight;
        }

        function measureTextBlock(ctx, text, maxWidth, lineHeight){
        const words = String(text || '').split(/\s+/);
        let line = '', lines = 0;
        for (const w of words){
            const test = line ? line + ' ' + w : w;
            if (ctx.measureText(test).width > maxWidth && line){
            lines++; line = w;
            } else {
            line = test;
            }
        }
        if (line) lines++;
        return lines * lineHeight;
        }

        function loadImage(src){
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src || '';
        });
        }

        async function buildPng(){
        // ---- Layout constants
        const W = 1080;                 // canvas width
        const PAD = 56;                 // outer padding
        const TITLE_GAP = 78;           // gap under "Spice Theory"
        const BADGES_H = 64;            // visual space for badges row
        const AFTER_BADGES_GAP = 32;    // gap below badges before images
        const IMG_H = 520;              // fixed image-box height
        const TEXT_GAP = 36;            // gap below images before text
        const SECTION_GAP = 22;         // gap between headings and body

        // Fonts
        const fTitle = '800 84px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
        const fH2    = '800 36px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
        const fBody1 = '600 34px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
        const fBody2 = '400 30px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';

        const { primary, secondary, pPct, sPct } = window.__lastResult || {};
        const pMeta = DATA.spices.find(s => s.key === primary);
        const sMeta = DATA.spices.find(s => s.key === secondary);
        const pure  = sPct === 0;

        const titleText = (primary === secondary)
            ? ({ posh:'True Posh', baby:'All Baby', sporty:'Hard Sporty', ginger:'Full Ginger', scary:'Max Scary' }[primary] || cap(primary))
            : `${cap(secondary)} ${cap(primary)}`;

        const blurb  = resultBlurb.textContent || '';
        const pText  = DATA.descriptions[primary]   || '';
        const sText  = pure ? '' : (DATA.descriptions[secondary] || '');

        // Measure text to compute the *required* height
        const measureCtx = document.createElement('canvas').getContext('2d');
        const textWidth  = W - PAD * 2;

        measureCtx.font = fBody1;
        const blurbH = measureTextBlock(measureCtx, blurb, textWidth, 44);

        measureCtx.font = fBody2;
        const primH  = measureTextBlock(measureCtx, pText, textWidth, 40);
        const secH   = pure ? 0 : measureTextBlock(measureCtx, sText, textWidth, 40);

        const headingsH = pure ? (SECTION_GAP + 46) : (SECTION_GAP + 46) * 2;
        const topBlocks = PAD + 64 + TITLE_GAP + 84 + BADGES_H + AFTER_BADGES_GAP;
        const textBlocks = blurbH + headingsH + primH + secH;
        const H = Math.ceil(topBlocks + IMG_H + TEXT_GAP + textBlocks + PAD);

        // Canvas
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');

        // Background
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#111217');
        g.addColorStop(1, '#1b1d27');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

        // ***** PNG COLOR STYLING CHANGE #1: Title accent follows PRIMARY (dominant) *****
        const accent = SPICE_COLOUR[primary] || '#6a5cff';

        // Title block
        ctx.fillStyle = '#fff';
        ctx.textBaseline = 'top';
        ctx.font = '700 64px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
        ctx.fillText('Spice Theory', PAD, PAD);

        ctx.font = fTitle;
        ctx.fillStyle = accent;
        ctx.fillText(titleText, PAD, PAD + TITLE_GAP);

        // Badges
        ctx.font = '700 36px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
        const badgeY = PAD + TITLE_GAP + 100;
        function badge(text, x){
            const padX = 18, padY = 10, h = 48, r = 999;
            const w = ctx.measureText(text).width + padX * 2;
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + r, badgeY);
            ctx.lineTo(x + w - r, badgeY);
            ctx.quadraticCurveTo(x + w, badgeY, x + w, badgeY + r);
            ctx.lineTo(x + w, badgeY + h - r);
            ctx.quadraticCurveTo(x + w, badgeY + h, x + w - r, badgeY + h);
            ctx.lineTo(x + r, badgeY + h);
            ctx.quadraticCurveTo(x, badgeY + h, x, badgeY + h - r);
            ctx.lineTo(x, badgeY + r);
            ctx.quadraticCurveTo(x, badgeY, x + r, badgeY);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.fillText(text, x + padX, badgeY + padY);
            return x + w + 12;
        }

        let bx = PAD;
        const pName = pMeta?.name || cap(primary);
        const sName = sMeta?.name || cap(secondary);
        if (pure) {
            bx = badge(`${pName} 100%`, bx);
        } else {
            bx = badge(`${sName} ${sPct}%`, bx);
            bx = badge(`${pName} ${pPct}%`, bx);
        }

        // Image boxes (side-by-side or single)
        const imgTop = badgeY + AFTER_BADGES_GAP + 48;
        const imgW = pure ? (W - PAD * 2) : Math.floor((W - PAD * 3) / 2);

        // ***** PNG IMAGE FIT + FRAME COLOR CHANGES *****
        // Use "cover" (crop) to fill the box, and color only PRIMARY's border.
            // Replace drawImg inside buildPng() with this version
        function drawImg(img, x, y, w, h, borderColor){
        const INNER_PAD = 18;                 // space between photo and the frame
        const fx = x + INNER_PAD;
        const fy = y + INNER_PAD;
        const fw = w - INNER_PAD * 2;
        const fh = h - INNER_PAD * 2;

        // panel background
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(x, y, w, h);

        // draw the image fully visible inside the panel (CONTAIN) and CLIP to the inner area
        if (img){
            const iw = img.naturalWidth || img.width;
            const ih = img.naturalHeight || img.height;
            const scale = Math.min(fw / iw, fh / ih); // << contain (no overflow)
            const dw = iw * scale;
            const dh = ih * scale;
            const dx = fx + (fw - dw) / 2;
            const dy = fy + (fh - dh) / 2;

            ctx.save();
            ctx.beginPath();
            ctx.rect(fx, fy, fw, fh);   // hard clip to inner box so nothing can spill
            ctx.clip();
            try { ctx.drawImage(img, dx, dy, dw, dh); } catch {}
            ctx.restore();
        }

        // frame / border (primary color or neutral, as you already set in the callers)
        ctx.strokeStyle = borderColor || '#0f1116';
        ctx.lineWidth = 6;
        ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
        }


        const primImg = await loadImage(pMeta?.image);
        const secImg  = pure ? null : await loadImage(sMeta?.image);

        if (pure){
            // Only one image: primary gets the colored frame
            drawImg(primImg, PAD, imgTop, imgW, IMG_H, accent);
        } else {
            // Secondary (left): neutral frame
            const neutralBorder = '#0f1116';
            drawImg(secImg,  PAD,           imgTop, imgW, IMG_H, neutralBorder);
            // Primary (right): colored frame (accent)
            drawImg(primImg, PAD*2 + imgW,  imgTop, imgW, IMG_H, accent);
        }

        // Text starts below images
        let y = imgTop + IMG_H + TEXT_GAP;

        // Blurb
        ctx.fillStyle = '#cfd2dc';
        ctx.font = fBody1;
        y = wrapText(ctx, blurb, PAD, y, textWidth, 44);

        // Primary section
        ctx.fillStyle = '#fff';
        ctx.font = fH2;
        y += SECTION_GAP;
        ctx.fillText(`Primary, ${pName}`, PAD, y);
        y += 46;

        ctx.fillStyle = '#e8e9ef';
        ctx.font = fBody2;
        y = wrapText(ctx, pText, PAD, y, textWidth, 40);

        // Secondary section
        if (!pure){
            ctx.fillStyle = '#fff';
            ctx.font = fH2;
            y += SECTION_GAP;
            ctx.fillText(`Secondary, ${sName}`, PAD, y);
            y += 46;

            ctx.fillStyle = '#e8e9ef';
            ctx.font = fBody2;
            y = wrapText(ctx, sText, PAD, y, textWidth, 40);
        }

        // Tiny mark
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '600 26px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
        ctx.fillText('tinyurl.com/Spice-Theory', PAD, H - PAD + 8);

        return new Promise(resolve => {
            canvas.toBlob(b => resolve(b), 'image/png', 0.95);
        });
        }

        shareBtn.onclick = async () => {
        const res = window.__lastResult;
        if (!res) { alert('Take the quiz first'); return; }

        try{
            const blob = await buildPng();
            if (!blob){ alert('Could not create PNG'); return; }

            const filename = `spice-${res.primary}-${res.secondary}.png`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 4000);

            const old = shareBtn.textContent;
            shareBtn.textContent = 'Saved PNG';
            setTimeout(() => (shareBtn.textContent = old), 1400);
        } catch (err){
            console.error(err);
            alert('Could not save the PNG. Please try again.');
        }
        };

        // Emphasise primary block; ensure Secondary first in grid
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

        // Primary card colour
        primaryBlock.classList.add('highlight-primary');
        primaryBlock.classList.remove('posh','baby','sporty','ginger','scary');
        primaryBlock.classList.add(pMeta?.colorClass || primary);

        // Insert result images (DOM view)
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
        if (!isPure) upsertImage(secondaryBlock, sMeta);

        // Emphasise primary copy
        primaryDesc.innerHTML = `<strong>${primaryDesc.textContent}</strong>`;

        setHidden(quizSec,  true);
        setHidden(bonusSec, true);
        setHidden(resultSec, false);

        bar.style.width = '100%';
        progressText.textContent = 'Complete';
    }

    // ---------------------------------------------------------------------------
    // Init
    // ---------------------------------------------------------------------------
    function startQuiz(data){
        DATA = data;

        // Warm cache for result images
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

    // Events
    nextBtn.addEventListener('click', goNext);
    backBtn.addEventListener('click', goBack);
    skipBtn.addEventListener('click', skip);
    bonusNextBtn.addEventListener('click', bonusNext);
    bonusBackBtn.addEventListener('click', bonusBack);

    // Data load
    fetch('./data/archetypes.json')
        .then(r => { if (!r.ok) throw new Error('Failed to load archetypes.json'); return r.json(); })
        .then(startQuiz)
        .catch(err => {
        console.error(err);
        progressText.textContent = 'Error loading quiz data.';
        });
})();
