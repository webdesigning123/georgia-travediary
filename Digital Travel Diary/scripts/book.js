// book.js — page-turn engine (layout, z-index, peel/flip)
(() => {
  const DUR = 420; // ms between 350-500
  const EASING = 'var(--easing)';
  let viewport, progressBar, pageAnnounce, tocDialog, tocBtn, tocList;

  let sheets = []; // each sheet holds two pages (L/R)
  let index = 0;   // page index (0-based)
  let total = 0;
  let motionReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // simple swipe/drag helper (<1KB gzipped)
  const Drag = (() => {
    let active = null;
    function onDown(e){
      const pt = getPoint(e);
      const target = e.target.closest('.corner, .tap-left button, .tap-right button, .page');
      active = { startX: pt.x, startY: pt.y, lastX: pt.x, el: target };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp, { once:true });
    }
    function onMove(e){
      if(!active) return;
      const pt = getPoint(e);
      const dx = pt.x - active.startX;
      active.lastX = pt.x;
      if(active.el?.classList.contains('corner')){
        const sheet = active.el.closest('.sheet');
        const right = sheet.querySelector('.page--right');
        const deg = Math.max(-180, Math.min(0, -dx/2));
        right.style.transform = `rotateY(${deg}deg)`;
        right.style.transition = 'none';
      }
    }
    function onUp(e){
      if(!active) return;
      const dx = active.lastX - active.startX;
      // snap
      if(active.el?.classList.contains('corner')){
        const sheet = active.el.closest('.sheet');
        const right = sheet.querySelector('.page--right');
        right.style.transition = '';
        if(dx < -40) flipNext(); else right.style.transform = '';
      } else if(active.el?.closest('.tap-left')) {
        flipPrev();
      } else if(active.el?.closest('.tap-right')){
        flipNext();
      }
      active = null;
      document.removeEventListener('pointermove', onMove);
    }
    function getPoint(e){
      return { x: e.clientX ?? (e.touches?.[0]?.clientX || 0), y: e.clientY ?? (e.touches?.[0]?.clientY || 0) };
    }
    function attach(el){ el.addEventListener('pointerdown', onDown, { passive:true }); }
    return { attach };
  })();

  function mount(root){
    viewport = root;
    progressBar = document.getElementById('progressBar');
    pageAnnounce = document.getElementById('pageAnnounce');
    tocDialog = document.getElementById('toc');
    tocBtn = document.getElementById('btnToc');
    tocList = document.getElementById('tocList');
    tocBtn.addEventListener('click', () => {
      tocDialog.showModal();
      tocBtn.setAttribute('aria-expanded', 'true');
    });
    document.getElementById('tocClose').addEventListener('click', () => {
      tocDialog.close(); tocBtn.setAttribute('aria-expanded', 'false');
    });
    Drag.attach(viewport);
    viewport.addEventListener('mousemove', onMouseMoveSheen);
  }

  function onMouseMoveSheen(e){
    const rect = viewport.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 100;
    const my = ((e.clientY - rect.top) / rect.height) * 100;
    viewport.style.setProperty('--mx', mx + '%');
    viewport.style.setProperty('--my', my + '%');
  }

  function build(diary){
    viewport.innerHTML = `
      <div class="tap-left"><button aria-label="Previous page"></button></div>
      <div class="tap-right"><button aria-label="Next page"></button></div>
    `;
    sheets = [];
    const hasPages = (diary.pages && diary.pages.length);
    if(!hasPages){
      document.getElementById('empty').hidden = false;
      return;
    }

    // FRONT COVER (page 0/1 on a single sheet)
    const coverSheet = createSheet();
    const fc = createCover(diary);
    const blank = createBlank();
    coverSheet.append(fc, blank);
    viewport.appendChild(coverSheet);
    sheets.push(coverSheet);

    // CONTENT PAGES
    diary.pages.forEach((p, i) => {
      if(i % 2 === 0){
        const s = createSheet();
        const left = renderPage(diary.pages[i]);
        const right = diary.pages[i+1] ? renderPage(diary.pages[i+1]) : createBlank();
        s.append(left, right);
        viewport.appendChild(s);
        sheets.push(s);
      }
    });

    // BACK COVER
    const back = createSheet();
    const backLeft = createBackCover(diary);
    const backRight = createBlank();
    back.append(backLeft, backRight);
    viewport.appendChild(back);
    sheets.push(back);

    total = sheets.length * 2;
    index = 0;
    updateProgress();
    addCorners();
    bindEdgeTaps();
  }

  function createSheet(){
    const el = document.createElement('div');
    el.className = 'sheet';
    el.style.setProperty('--dur', motionReduce ? '220ms' : DUR + 'ms');
    return el;
  }
  function createBlank(){
    const page = document.createElement('article');
    page.className = 'page page--blank page--left';
    page.setAttribute('data-page', '');
    page.setAttribute('data-sheen', 'off');
    return page;
  }
  function createCover(diary){
    const p = document.createElement('article');
    p.className = 'page page--cover page--left';
    p.style.backgroundImage = `image-set(url(${diary.cover.image}) 1x)`;
    p.setAttribute('data-page','1');
    p.innerHTML = `
      <header>
        <h2>${diary.title}</h2>
        <div class="strapline">${diary.cover.strapline || ''}</div>
      </header>
    `;
    return p;
  }
  function createBackCover(diary){
    const p = document.createElement('article');
    p.className = 'page page--back page--left';
    p.setAttribute('data-page', String(total));
    p.innerHTML = `
      <header><h2>Thanks for reading</h2></header>
      <p>${diary.backCover?.notes || ''}</p>
      ${diary.backCover?.qrLink ? `<p><a href="${diary.backCover.qrLink}">More photos & gallery →</a></p>` : ''}
    `;
    return p;
  }

  function renderPage(pg){
    const side = document.createElement('article');
    side.className = 'page page--right';
    side.setAttribute('data-page', '');
    side.innerHTML = `
      <header>
        <h2>${pg.title || ''}</h2>
        <div class="meta">${pg.date || ''}${pg.location ? ' · ' + pg.location : ''}</div>
      </header>
      <p>${pg.text || ''}</p>
      <div class="photos">
        ${(pg.photos||[]).map(ph => `
          <figure class="photo">
            <img src="${ph.src}" alt="${ph.alt || ''}" loading="lazy" decoding="async" />
            ${ph.caption ? `<figcaption class="caption">${ph.caption}</figcaption>` : ''}
          </figure>
        `).join('')}
      </div>
      <div class="corner" title="Drag to peel"></div>
    `;
    return side;
  }

  function addCorners(){
    viewport.querySelectorAll('.corner').forEach(c => Drag.attach(c));
  }
  function bindEdgeTaps(){
    viewport.querySelector('.tap-left button').addEventListener('click', flipPrev);
    viewport.querySelector('.tap-right button').addEventListener('click', flipNext);
  }

  function updateProgress(){
    const pct = (index+1) / total * 100;
    progressBar.style.width = pct.toFixed(1) + '%';
    const pageNo = Math.min(total, Math.max(1, index+1));
    A11y.announce(pageAnnounce, 'Page ' + pageNo);
    // update page number annotations
    let n = 1;
    viewport.querySelectorAll('.page').forEach(p => p.dataset.page = n++);
  }

  function flipNext(){
    if(index >= total-1) return;
    const sheetIdx = Math.floor(index/2);
    const sheet = sheets[sheetIdx];
    sheet.classList.add('flip');
    index += 2;
    updateProgress();
  }
  function flipPrev(){
    if(index <= 1) return;
    const sheetIdx = Math.floor((index-2)/2);
    const sheet = sheets[sheetIdx];
    sheet.classList.remove('flip');
    index -= 2;
    updateProgress();
  }

  function jumpTo(pageIndex){
    // compute target sheet and add/remove flip on previous ones
    const targetSheet = Math.floor(pageIndex/2);
    sheets.forEach((s, i) => {
      s.classList.toggle('flip', i <= targetSheet-1);
    });
    index = Math.max(0, Math.min(total-1, pageIndex));
    updateProgress();
  }

  function buildTOC(diary){
    tocList.innerHTML = '';
    (diary.toc || []).forEach(item => {
      const a = document.createElement('a');
      a.href = '#p' + item.pageIndex;
      a.textContent = item.label;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        tocDialog.close(); tocBtn.setAttribute('aria-expanded', 'false');
        jumpTo(item.pageIndex);
      });
      const page = document.createElement('span');
      page.textContent = item.pageIndex;
      a.appendChild(page);
      tocList.appendChild(a);
    });
  }

  function keyboard(){
    document.addEventListener('keydown', (e) => {
      if(e.defaultPrevented) return;
      if(e.key === 'ArrowRight' || e.key === ' '){ flipNext(); }
      else if(e.key === 'ArrowLeft'){ flipPrev(); }
      else if(e.key === 'Home'){ jumpTo(0); }
      else if(e.key === 'End'){ jumpTo(total-1); }
    });
  }

  function sheenReducedMotion(state){
    viewport.querySelectorAll('.page').forEach(p => {
      p.dataset.sheen = state ? 'off' : 'on';
    });
  }

  window.Book = { mount, build, buildTOC, keyboard, jumpTo, sheenReducedMotion };
})();
