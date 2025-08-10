// app.js — router/state/render
(async () => {
  const viewport = document.getElementById('bookViewport');
  const skeleton = document.getElementById('skeleton');
  const errorEl = document.getElementById('error');

  try{
    skeleton.hidden = false;
    const diary = await Data.fetchDiary('data/pages.json');
    Book.mount(viewport);
    Book.build(diary);
    Book.buildTOC(diary);
    Book.keyboard();

    // Controls
    document.getElementById('btnHome').addEventListener('click', () => Book.jumpTo(0));
    document.getElementById('btnPrev').addEventListener('click', () => Book.jumpTo(Math.max(0, 0)));
    document.getElementById('btnNext').addEventListener('click', () => Book.jumpTo(2));
    document.getElementById('btnEnd').addEventListener('click', () => Book.jumpTo(9999));

    // Reduced motion handling
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateRM = () => Book.sheenReducedMotion(mq.matches);
    mq.addEventListener('change', updateRM);
    updateRM();

  }catch(err){
    console.error(err);
    errorEl.hidden = false;
  }finally{
    skeleton.hidden = true;
  }
})();
