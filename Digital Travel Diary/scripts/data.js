// data.js — fetch/validate JSON + preload + cache
(() => {
  const cache = new Map();

  async function fetchJSON(url){
    if(cache.has(url)) return cache.get(url);
    const res = await fetch(url, { credentials: 'same-origin' });
    if(!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    const json = await res.json();
    cache.set(url, json);
    return json;
  }

  function validateDiary(data){
    const required = ['tripId','title','startDate','endDate','pages','cover'];
    for(const k of required){
      if(!(k in data)) throw new Error(`Missing field: ${k}`);
    }
    if(!Array.isArray(data.pages)) throw new Error('pages must be an array');
    return true;
  }

  function preloadImage(src){
    return new Promise((resolve,reject)=>{
      const img = new Image();
      img.loading = 'eager';
      img.decoding = 'async';
      img.onload = () => resolve(src);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  }

  async function preloadImages(diary){
    const list = [];
    if(diary.cover?.image) list.push(preloadImage(diary.cover.image));
    for(const p of diary.pages || []){
      for(const ph of (p.photos||[])){
        if(ph.src) list.push(preloadImage(ph.src));
      }
    }
    // Don't block on all images; wait at most 1.2s
    await Promise.race([Promise.allSettled(list), new Promise(r=>setTimeout(r,1200))]);
  }

  window.Data = {
    fetchDiary: async (url='data/pages.json') => {
      const data = await fetchJSON(url);
      validateDiary(data);
      await preloadImages(data);
      return data;
    }
  };
})();
