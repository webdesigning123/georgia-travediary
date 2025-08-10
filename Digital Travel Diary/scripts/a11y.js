// a11y.js — roles, focus mgmt, ARIA helpers
(() => {
  function trapFocus(dialog){
    const focusable = dialog.querySelectorAll('a,button,[tabindex]:not([tabindex="-1"])');
    let i = 0;
    function onKey(e){
      if(e.key !== 'Tab') return;
      e.preventDefault();
      i = (i + (e.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
      focusable[i].focus();
    }
    dialog.addEventListener('keydown', onKey);
    return () => dialog.removeEventListener('keydown', onKey);
  }

  function announce(el, text){
    el.textContent = text;
  }

  window.A11y = { trapFocus, announce };
})();
