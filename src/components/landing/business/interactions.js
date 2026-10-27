// Public sample records only. Never connects these examples to member data.
export function mountBusinessHome(root, track) {
  const cleanup = [];
  function on(target, name, handler) {
    if (!target) return;
    target.addEventListener(name, handler);
    cleanup.push(() => target.removeEventListener(name, handler));
  }
  const tabs = [...root.querySelectorAll('#business-demo [role="tab"]')];
  const panels = [...root.querySelectorAll('#business-demo [role="tabpanel"]')];
  const preview = root.querySelector('#business-demo');
  const status = root.querySelector('#demo-status');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let toastTimer;
  let highlightTimer;
  function announce(message) {
    status.textContent = message;
  }
  function notify(message) {
    const toast = root.querySelector('#toast');
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 4500);
  }
  function chooseTab(name, focus = false) {
    track("business_tab", name);
    tabs.forEach(tab => {
      const active = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus({
        preventScroll: true
      });
    });
    panels.forEach(panel => {
      panel.hidden = panel.id !== 'panel-' + name;
    });
    updateStory(name);
  }
  function revealDemo(name) {
    if (name) chooseTab(name);
    preview.scrollIntoView({
      behavior: reducedMotion.matches ? 'instant' : 'smooth',
      block: 'center'
    });
    const active = tabs.find(tab => tab.getAttribute('aria-selected') === 'true');
    active.focus({
      preventScroll: true
    });
    preview.classList.add('is-highlighted');
    clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => preview.classList.remove('is-highlighted'), 1800);
  }
  tabs.forEach((tab, index) => {
    on(tab, 'click', () => chooseTab(tab.dataset.tab));
    on(tab, 'keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;else if (event.key === 'Home') next = 0;else if (event.key === 'End') next = tabs.length - 1;else return;
      event.preventDefault();
      chooseTab(tabs[next].dataset.tab, true);
    });
  });
  root.querySelector('#explore-demo')?.addEventListener('click', () => {
    revealDemo();
    announce('Choose Price, Pair, Track or Sell to explore the sample workspace.');
  });
  root.querySelectorAll('[data-show-tab]').forEach(button => on(button, 'click', () => revealDemo(button.dataset.showTab)));
  function updatePairing() {
    track("sample_pairing", "change");
    const sire = Number(root.querySelector('#sire').value);
    const dam = Number(root.querySelector('#dam').value);
    const lethal = sire && dam ? .25 : 0;
    const lilly = sire || dam ? .5 : 0;
    const normal = 1 - lilly - lethal;
    root.querySelector('#lilly-odds').textContent = Math.round(lilly * 100) + '%';
    root.querySelector('#normal-odds').textContent = Math.round(normal * 100) + '%';
    root.querySelector('#lilly-bar').style.width = lilly * 100 + '%';
    root.querySelector('#normal-bar').style.width = normal * 100 + '%';
    root.querySelector('#pair-risk').hidden = !lethal;
    root.querySelector('#pair-value').textContent = lethal ? 'Review' : '$' + Math.round(lilly * 250 + normal * 65);
    announce(lethal ? 'Avoid this pairing. The model predicts a 25 percent lethal super outcome.' : `Example outcomes: ${lilly * 100} percent Lilly White, ${normal * 100} percent without Lilly White.`);
  }
  on(root.querySelector('#sire'), 'change', updatePairing);
  on(root.querySelector('#dam'), 'change', updatePairing);
  const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  let additionalCosts = 0;
  on(root.querySelector('#expense-form'), 'submit', event => {
    event.preventDefault();
    const input = root.querySelector('#expense-amount');
    if (!input.reportValidity()) return;
    const amount = Number(input.value);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) return;
    track("sample_expense", "add");
    additionalCosts = Math.round((additionalCosts + amount) * 100) / 100;
    root.querySelector('#cost-total').textContent = money.format(740 + additionalCosts);
    root.querySelector('#net-total').textContent = money.format(1720 - additionalCosts);
    root.querySelector('#cost-bar').style.width = Math.min(100, (740 + additionalCosts) / 2460 * 100) + '%';
    root.querySelector('#expense-name').textContent = root.querySelector('#expense-category').value;
    root.querySelector('#expense-value').textContent = '−' + money.format(amount);
    root.querySelector('#added-expense').hidden = false;
    notify(`${money.format(amount)} added to the sample ledger. Balance: ${money.format(1720 - additionalCosts)}.`);
  });
  on(root.querySelector('#reset-ledger'), 'click', () => {
    additionalCosts = 0;
    root.querySelector('#cost-total').textContent = '$740';
    root.querySelector('#net-total').textContent = '$1,720';
    root.querySelector('#cost-bar').style.width = '30.1%';
    root.querySelector('#added-expense').hidden = true;
    root.querySelector('#expense-amount').value = '80';
    notify('Sample ledger reset.');
  });
  const detailDialog = root.querySelector('#detail-dialog');
  const detailContent = root.querySelector('#detail-content');
  root.querySelectorAll('[data-open]').forEach(button => on(button, 'click', () => {
    detailContent.querySelectorAll("[data-detail-view]").forEach(view => {
      view.hidden = view.dataset.detailView !== button.dataset.open;
    });
    track("buyer_preview", button.dataset.open);
    detailDialog.setAttribute("aria-labelledby", button.dataset.open + "-title");
    detailDialog.showModal();
  }));
  root.querySelectorAll('.close-dialog').forEach(button => on(button, 'click', () => button.closest('dialog').close()));
  root.querySelectorAll('dialog').forEach(dialog => on(dialog, 'click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }));
  const mobileMenu = root.querySelector('#mobile-menu');
  const menuToggle = root.querySelector('.menu-toggle');
  on(menuToggle, 'click', () => {
    mobileMenu.showModal();
    menuToggle.setAttribute('aria-expanded', 'true');
  });
  on(mobileMenu, 'close', () => menuToggle.setAttribute('aria-expanded', 'false'));
  mobileMenu.querySelectorAll('a').forEach(link => on(link, 'click', () => mobileMenu.close()));

  // Real, publicly shipped product screens. The visitor controls the pace.
  const screenSources = {
    record: {
      image: "/screenshots/gecko-record-market.webp",
      mobile: "/screenshots/gecko-record-real-phone.webp",
      label: 'Gecko records',
      title: 'Every gecko, with its whole story.',
      copy: 'Photos, traits, weights and an asking-price estimate live together. The details you need are ready when the next decision comes.',
      alt: 'Geck Inspect gecko record showing an animal photograph, traits, estimated value and weight history'
    },
    genetics: {
      image: "/screenshots/genetics-calculator.webp",
      mobile: "/screenshots/genetics-calculator-phone.webp",
      label: 'Genetics',
      title: 'See the possibilities in a pairing.',
      copy: 'Choose your animals and explore inherited outcomes. Single-gene probabilities and possible visual traits are different kinds of information.',
      alt: 'The real Geck Inspect genetics calculator with parent photos and offspring outcomes'
    },
    lineage: {
      image: "/screenshots/lineage-tree-real.webp",
      mobile: "/screenshots/lineage-tree-real-phone.webp",
      label: 'Lineage',
      title: 'The family tree stays connected.',
      copy: 'Follow recorded parents across generations. Keep the history behind your breeding decisions and the records you share with buyers.',
      alt: 'A multi-generation lineage tree in the actual Geck Inspect application'
    },
    breeding: {
      image: "/screenshots/breeding-planner-real.webp",
      mobile: "/screenshots/breeding-planner-real-phone.webp",
      label: 'Breeding plans',
      title: 'Your next season starts taking shape.',
      copy: 'Bring pairings, eggs and hatchery work into the same workspace. See which projects are active and what needs your attention next.',
      alt: 'Real Geck Inspect breeding management screen showing animal photos, active pairings and egg tracking'
    },
    portfolio: {
      image: "/screenshots/portfolio-market.webp",
      mobile: "/screenshots/portfolio-phone.webp",
      label: 'Portfolio',
      title: 'Step back. See the whole collection.',
      copy: 'See asking-price estimates across the collection and the traits contributing to its value. Keep market context separate from recorded sales and costs.',
      alt: 'Real Geck Inspect portfolio with estimated collection value and value-driving morphs'
    }
  };
  const tourTabs = [...root.querySelectorAll('[data-tour]')];
  let selectedScreen = 'breeding';
  const screenDialog = root.querySelector('#screen-dialog');
  const screenScroll = root.querySelector('.screen-scroll');
  const screenZoom = root.querySelector('#screen-zoom');
  function chooseScreen(name, focus = false) {
    const screen = screenSources[name];
    if (!screen) return;
    selectedScreen = name;
    track("product_screen", name);
    tourTabs.forEach(tab => {
      const active = tab.dataset.tour === name;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus({
        preventScroll: true
      });
    });
    root.querySelector('#tour-mobile').srcset = screen.mobile;
    const img = root.querySelector('#tour-image');
    img.src = screen.image;
    img.alt = screen.alt;
    root.querySelector('#tour-caption-title').textContent = screen.title;
    root.querySelector('#tour-caption-copy').textContent = screen.copy;
    root.querySelector('#tour-panel').setAttribute('aria-labelledby', 'tour-' + name);
  }
  tourTabs.forEach((tab, index) => {
    on(tab, 'click', () => chooseScreen(tab.dataset.tour));
    on(tab, 'keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tourTabs.length;else if (event.key === 'ArrowLeft') next = (index - 1 + tourTabs.length) % tourTabs.length;else if (event.key === 'Home') next = 0;else if (event.key === 'End') next = tourTabs.length - 1;else return;
      event.preventDefault();
      chooseScreen(tourTabs[next].dataset.tour, true);
    });
  });
  on(root.querySelector('#next-screen'), 'click', () => {
    const index = tourTabs.findIndex(tab => tab.dataset.tour === selectedScreen);
    chooseScreen(tourTabs[(index + 1) % tourTabs.length].dataset.tour);
    announce('Showing ' + screenSources[selectedScreen].label + ' app screen.');
  });
  function openScreen(name = selectedScreen) {
    const screen = screenSources[name];
    root.querySelector('#screen-title').textContent = screen.label;
    const img = root.querySelector('#screen-image');
    img.src = screen.image;
    img.alt = screen.alt;
    screenScroll.classList.remove('is-zoomed');
    screenZoom.textContent = 'View at full size';
    screenZoom.setAttribute('aria-pressed', 'false');
    screenDialog.showModal();
    screenScroll.scrollTop = 0;
    screenScroll.scrollLeft = 0;
  }
  on(root.querySelector('#enlarge-screen'), 'click', () => openScreen());
  on(root.querySelector('#tour-image-open'), 'click', () => openScreen());
  root.querySelectorAll('[data-screen]').forEach(button => on(button, 'click', () => openScreen(button.dataset.screen)));
  screenZoom.setAttribute('aria-pressed', 'false');
  on(screenZoom, 'click', () => {
    const zoomed = screenScroll.classList.toggle('is-zoomed');
    screenZoom.textContent = zoomed ? 'Fit to window' : 'View at full size';
    screenZoom.setAttribute('aria-pressed', String(zoomed));
  });
  const stories = {
    price: {
      image: "/demo-geckos/pony-boy.webp",
      alt: 'A crested gecko resting in a breeder’s hand',
      kicker: 'The pricing moment',
      photoTitle: '“Where do I even start?”',
      title: 'There’s a reason behind the range.',
      description: 'See the asking-price context, inspect the comparisons and bring your own knowledge of the animal. A starting point you can understand.',
      hint: 'Try “Inspect sample comparables”'
    },
    pair: {
      image: "/demo-geckos/blush.webp",
      alt: 'A golden crested gecko from the founder’s collection',
      kicker: 'The possibility moment',
      photoTitle: '“What could they produce?”',
      title: 'Turn curiosity into a pairing you understand.',
      description: 'Change the parents and watch the single-gene outcomes respond. Explore the possibilities, and see a clear warning when the model flags a lethal combination.',
      hint: 'Try changing either parent’s Lilly White copies'
    },
    track: {
      image: "/demo-geckos/bliss.webp",
      alt: 'A crested gecko perched on a branch',
      kicker: 'The clarity moment',
      photoTitle: '“How is the season going?”',
      title: 'The numbers are finally together.',
      description: 'Add a show expense or a feed cost. See it alongside recorded sales, with a balance that changes as you go. There is less to reconstruct at the end of the season.',
      hint: 'Try adding an $80 show expense'
    },
    sell: {
      image: "/demo-geckos/moonlight.webp",
      alt: 'A crested gecko from the founder’s collection',
      kicker: 'The handoff moment',
      photoTitle: '“Everything they need is here.”',
      title: 'Be ready when the right buyer arrives.',
      description: 'Open a buyer packet with the animal’s photo, recorded parents, weights and care notes. The history you kept has somewhere useful to go.',
      hint: 'Try “Preview the buyer packet”'
    }
  };
  function updateStory(name) {
    const story = stories[name];
    if (!story) return;
    const img = root.querySelector('#decision-photo');
    img.src = story.image;
    img.alt = story.alt;
    for (const [id, key] of [['decision-kicker', 'kicker'], ['decision-photo-title', 'photoTitle'], ['decision-title', 'title'], ['decision-description', 'description'], ['decision-hint', 'hint']]) root.querySelector("#" + id).textContent = story[key];
  }
  root.querySelectorAll('[data-jump]').forEach(button => on(button, 'click', () => revealDemo(button.dataset.jump)));
  on(detailContent.querySelector('[data-close-detail]'), 'click', () => detailDialog.close());
  on(detailContent.querySelector('#print-packet'), 'click', () => window.print());
  return () => {
    cleanup.forEach(dispose => dispose());
    clearTimeout(toastTimer);
    clearTimeout(highlightTimer);
    root.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  };
}
