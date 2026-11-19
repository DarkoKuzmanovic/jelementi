document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  document.querySelectorAll('.glossary-term').forEach((term) => {
    const tip = term.querySelector('.glossary-tooltip');
    if (
      tip instanceof HTMLElement &&
      tip.getClientRects().length &&
      term.matches(':hover, :focus-within')
    ) {
      if (document.activeElement === tip) term.querySelector('a')?.focus();
      tip.style.display = 'none';
    }
  });
});

document.querySelectorAll('.glossary-term').forEach((term) => {
  if (!(term instanceof HTMLElement)) return;
  const tip = term.querySelector('.glossary-tooltip');
  if (!(tip instanceof HTMLElement)) return;
  const position = () => {
    tip.style.left = '0px';
    tip.style.top = 'auto';
    tip.style.bottom = 'calc(100% - 4px)';
    tip.style.maxHeight = '';
    const link = term.getBoundingClientRect();
    const bounds = tip.getBoundingClientRect();
    tip.style.left = `${Math.max(8 - bounds.left, Math.min(0, window.innerWidth - 8 - bounds.right))}px`;
    const above = link.top;
    const below = window.innerHeight - link.bottom;
    if (bounds.height > above && below > above) {
      tip.style.top = 'calc(100% - 4px)';
      tip.style.bottom = 'auto';
    }
    tip.style.maxHeight = `${Math.max(above, below) - 8}px`;
    if (tip.scrollHeight > tip.clientHeight) tip.tabIndex = 0;
    else tip.removeAttribute('tabindex');
  };
  const reset = () => {
    if (!term.matches(':hover, :focus-within')) tip.style.display = '';
  };
  const enter = () => {
    tip.style.display = '';
    position();
  };
  term.addEventListener('pointerenter', enter);
  term.addEventListener('focusin', enter);
  term.addEventListener('pointerleave', reset);
  term.addEventListener('focusout', reset);
  term.addEventListener('keydown', (event) => {
    if (
      event.key === 'Tab' &&
      !event.shiftKey &&
      event.target === term.querySelector('a') &&
      tip.tabIndex === 0 &&
      tip.getClientRects().length
    ) {
      event.preventDefault();
      tip.style.display = 'block';
      tip.focus();
      tip.style.display = '';
    }
  });
  const reposition = () => {
    if (tip.getClientRects().length) position();
  };
  window.addEventListener('scroll', reposition, { passive: true });
  window.addEventListener('resize', reposition);
});
document.documentElement.classList.add('glossary-ready');
