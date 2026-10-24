'use strict';
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pageMode = document.body.hasAttribute('data-documents-page');
  const noticeKey = 'zamelano-cookie-notice';
  const noticeVersion = 'technical-1';
  let bundle = null, links = {files:{}}, selected = 'privacy', section = null, consentAt = null;
  const ui = {
    ru: {
      documents:'Документы', eyebrow:'ZAMELANO · ПРАВОВАЯ ИНФОРМАЦИЯ', back:'Вернуться в бутик', close:'Закрыть документ', navigation:'Юридические документы',
      loading:'Загружаем документ…', error:'Не удалось загрузить документы. Попробуйте ещё раз.', retry:'Повторить', separate:'Открыть отдельной страницей', file:'Открыть файл',
      original:'', cookieTitle:'Немного о cookie', cookieText:'Мы используем только технические файлы cookie и локальное хранилище: они нужны для работы сайта. Аналитику и рекламные инструменты мы не используем.',
      cookieMore:'Подробнее в Политике конфиденциальности', understood:'Понятно', cookieReopen:'О cookie', consentPrefix:'Я даю согласие на обработку персональных данных на условиях ',
      consentLink:'Согласия на обработку персональных данных', consentMiddle:' и ознакомлен(а) с ', policyLink:'Политикой конфиденциальности',
      formDocuments:'Документы к заявке', cartDocuments:'Условия и обработка данных', privacy:'Политика конфиденциальности', offer:'Публичная оферта',
      consentRecord:'Согласие на обработку персональных данных дано', policyVersion:'Политика конфиденциальности, версия', consentVersion:'Согласие на обработку данных, редакция комплекта',
      consentTimeZone:'время Москвы', consentNeeded:'Чтобы подготовить заявку, отметьте согласие на обработку персональных данных.', footer:'© 2026 ZAMELANO'
    },
    en: {
      documents:'Documents', eyebrow:'ZAMELANO · LEGAL INFORMATION', back:'Back to the boutique', close:'Close document', navigation:'Legal documents',
      loading:'Loading the document…', error:'Documents could not be loaded. Please try again.', retry:'Try again', separate:'Open as a separate page', file:'Open file',
      original:'The approved documents are available in their original Russian version.', cookieTitle:'A little about cookies', cookieText:'We use only technical cookies and local storage needed for the website to work. We do not use analytics or advertising tools.',
      cookieMore:'Read the privacy policy', understood:'Got it', cookieReopen:'About cookies', consentPrefix:'I consent to the processing of my personal data under the ',
      consentLink:'Personal data consent', consentMiddle:' and confirm that I have read the ', policyLink:'Privacy policy',
      formDocuments:'Enquiry documents', cartDocuments:'Terms and data processing', privacy:'Privacy policy', offer:'Public offer',
      consentRecord:'Personal data consent given', policyVersion:'Privacy policy, version', consentVersion:'Personal data consent, document set dated',
      consentTimeZone:'Moscow time', consentNeeded:'To prepare an enquiry, please check the personal data consent box.', footer:'© 2026 ZAMELANO'
    }
  };
  const language = () => document.documentElement.lang === 'en' ? 'en' : 'ru';
  const t = key => ui[language()][key];
  const base = new URL('./', location.href);
  const safeURL = value => {
    if (typeof value !== 'string' || !value.trim()) return null;
    try { const url = new URL(value, base); return ['http:','https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
  };
  const siteURL = () => safeURL(links.siteUrl) || base.href;
  function documentURL(id, targetSection = null) {
    const url = new URL('documents.html', base);
    if (targetSection) url.searchParams.set('section', targetSection);
    url.hash = id;
    return url.href;
  }
  const documentLink = (id, label, targetSection = null) => `<a href="${escape(documentURL(id, targetSection))}" data-document="${escape(id)}"${targetSection ? ` data-document-section="${escape(targetSection)}"` : ''}>${escape(label)}</a>`;
  function formattedText(text) {
    const pattern = /\[(?:URL[^\]]*|ссылка)\]|https?:\/\/[^\s<)]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
    let result = '', last = 0;
    for (const match of text.matchAll(pattern)) {
      result += escape(text.slice(last, match.index));
      const token = match[0];
      if (token.startsWith('[')) {
        if (/privacy-policy/i.test(token)) result += documentLink('privacy', ui.ru.privacy);
        else if (/ссылка/i.test(token)) {
          const id = /^Согласие на обработку персональных данных:/i.test(text) ? 'order-consent' : 'privacy';
          result += documentLink(id, id === 'privacy' ? ui.ru.privacy : ui.ru.consentLink);
        } else result += `<a href="${escape(siteURL())}">${escape(siteURL())}</a>`;
      } else if (token.includes('@') && !token.startsWith('http')) result += `<a href="mailto:${escape(token)}">${escape(token)}</a>`;
      else {
        const target = /^https:\/\/kibosh13\.github\.io\/zamelano\/?$/i.test(token) ? siteURL() : safeURL(token);
        result += target ? `<a href="${escape(target)}">${escape(target)}</a>` : escape(token);
      }
      last = match.index + token.length;
    }
    return (result + escape(text.slice(last))).replace(/\n/g,'<br>');
  }
  function documentBody(doc, prefix) {
    const parts = []; let listOpen = false;
    doc.blocks.slice(2).forEach(block => {
      if (block.type === 'list-item') {
        if (!listOpen) { parts.push('<ul>'); listOpen = true; }
        parts.push(`<li>${formattedText(block.text)}</li>`); return;
      }
      if (listOpen) { parts.push('</ul>'); listOpen = false; }
      if (block.type === 'table') {
        parts.push(`<div class="legal-table-wrap"><table><tbody>${block.rows.map(row => `<tr>${row.map((cell,index) => `<${index ? 'td' : 'th scope="row"'}>${formattedText(cell)}</${index ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      } else if (block.type === 'heading') {
        parts.push(`<h3 id="${escape(prefix+'-'+block.id)}" data-document-anchor="${escape(block.id)}">${formattedText(block.text)}</h3>`);
      } else if (block.type === 'subheading') parts.push(`<h4>${formattedText(block.text)}</h4>`);
      else parts.push(`<p>${formattedText(block.text)}</p>`);
    });
    if (listOpen) parts.push('</ul>');
    return parts.join('');
  }
  function renderNavigation(container) {
    if (!container || !bundle) return;
    container.setAttribute('aria-label', t('navigation'));
    container.innerHTML = `<p class="eyebrow">${t('documents')}</p>` + bundle.documents.map((doc,index) => `<a href="${escape(documentURL(doc.id))}" data-document="${doc.id}"${doc.id === selected ? ' aria-current="page"' : ''}><span class="legal-nav-number">0${index+1}</span><span>${escape(doc.label[language()])}</span></a>`).join('');
  }
  function jumpToSection(article) {
    if (!section) return;
    const target = $$('[data-document-anchor]', article).find(el => el.dataset.documentAnchor === section);
    if (target) requestAnimationFrame(() => target.scrollIntoView({block:'start'}));
  }
  function renderSelected() {
    const article = $(pageMode ? '#legal-page-article' : '#legal-dialog-article');
    if (!article) return;
    if (!bundle) { article.innerHTML = `<p role="status">${t('loading')}</p>`; return; }
    const doc = bundle.documents.find(item => item.id === selected) || bundle.documents[0]; selected = doc.id;
    const tag = pageMode ? 'h1' : 'h2', prefix = pageMode ? 'legal-page' : 'legal-modal';
    const fileURL = safeURL(links.files?.[doc.id]);
    article.innerHTML = `<header class="legal-document-header"><p class="eyebrow">${t('eyebrow')}</p><${tag} id="${prefix}-title" lang="ru">${escape(doc.title)}</${tag}>${t('original') ? `<p class="legal-original-note">${t('original')}</p>` : ''}${!pageMode || fileURL ? `<div class="legal-document-actions">${!pageMode ? `<a href="${escape(documentURL(doc.id,section))}" target="_blank" rel="noopener" data-native-document data-brand-key>${t('separate')}</a>` : ''}${fileURL ? `<a href="${escape(fileURL)}" target="_blank" rel="noopener" data-brand-key>${t('file')}</a>` : ''}</div>` : ''}</header><div class="legal-document-text" lang="ru">${documentBody(doc,prefix)}</div>`;
    renderNavigation($(pageMode ? '#legal-page-nav' : '#legal-dialog-nav'));
    if (pageMode) document.title = `${doc.label[language()]} — ZAMELANO`;
    else $('#legal-dialog').scrollTop = 0;
    jumpToSection(article);
  }
  function openDocument(id, targetSection = null) {
    selected = id; section = targetSection;
    if (pageMode) {
      const next = documentURL(id,targetSection);
      if (next !== location.href) history.pushState(null,'',next);
      renderSelected();
      if (!section) window.scrollTo({top:0});
    } else {
      const dialog = $('#legal-dialog');
      if (!dialog.open) dialog.showModal();
      document.body.classList.add('modal-open'); renderSelected();
      $('#legal-dialog-close').focus({preventScroll:true});
    }
  }
  function cookieSeen() {
    try { return JSON.parse(localStorage.getItem(noticeKey))?.version === noticeVersion; } catch { return false; }
  }
  function renderLabels() {
    $$('[data-legal-i18n]').forEach(el => el.textContent = t(el.dataset.legalI18n));
    $$('[data-cookie-policy]').forEach(el => { el.href = documentURL('privacy','section-8'); });
    const consent = $('#request-legal-consent');
    if (consent) consent.innerHTML = `<label for="personal-consent">${escape(t('consentPrefix'))}</label>${documentLink('order-consent',t('consentLink'))}${escape(t('consentMiddle'))}${documentLink('privacy',t('policyLink'))}.`;
    const note = $('#request-legal-note');
    if (note) note.innerHTML = `${t('formDocuments')}: ${documentLink('privacy',t('privacy'))} · ${documentLink('order-consent',t('consentLink'))}.`;
    const close = $('#legal-dialog-close'); if (close) close.setAttribute('aria-label',t('close'));
    const langButton = $('#legal-language'); if (langButton) { langButton.textContent = language() === 'ru' ? 'RU / EN' : 'EN / RU'; langButton.setAttribute('aria-label',language() === 'ru' ? 'Switch to English' : 'Переключить на русский'); }
    updateFormConsent();
    if (pageMode || $('#legal-dialog')?.open) renderSelected();
  }
  function updateFormConsent() {
    const form = $('#request-form'); if (!form) return;
    const checked = $('[name="consent"]',form).checked;
    $('button[type="submit"]',form).disabled = !checked || !bundle;
    $('#consent-help').hidden = checked;
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-document]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('data-native-document')) return;
    event.preventDefault(); openDocument(link.dataset.document,link.dataset.documentSection || null);
  });
  $('#legal-dialog-close')?.addEventListener('click',() => $('#legal-dialog').close());
  $('#legal-dialog')?.addEventListener('close',() => document.body.classList.toggle('modal-open',Boolean($('dialog[open]'))));
  $('#cookie-understood')?.addEventListener('click',() => {
    try { localStorage.setItem(noticeKey,JSON.stringify({version:noticeVersion,acknowledgedAt:new Date().toISOString()})); } catch {}
    $('#cookie-notice').hidden = true;
  });
  $$('[data-cookie-open]').forEach(button => button.addEventListener('click',() => { $('#cookie-notice').hidden = false; $('#cookie-understood').focus({preventScroll:true}); }));
  const form = $('#request-form');
  if (form) {
    $('[name="consent"]',form).addEventListener('change',event => { consentAt = event.target.checked ? new Date() : null; updateFormConsent(); });
    form.addEventListener('reset',() => { consentAt = null; queueMicrotask(updateFormConsent); });
  }
  document.addEventListener('zamelano:request-prepared',() => {
    if (!bundle || !consentAt || !$('#request-form [name="consent"]').checked) return;
    const time = new Intl.DateTimeFormat(language() === 'ru' ? 'ru-RU' : 'en-GB',{dateStyle:'short',timeStyle:'medium',timeZone:'Europe/Moscow'}).format(consentAt);
    const lines = [`${t('consentRecord')}: ${time} (${t('consentTimeZone')}; ${consentAt.toISOString()}).`,`${t('policyVersion')} ${bundle.policyVersion}.`,`${t('consentVersion')} ${bundle.packetDate}.`];
    $('#request-text').value += '\n\n'+lines.join('\n');
    $('#telegram-request').href = `https://t.me/Zamelano?text=${encodeURIComponent($('#request-text').value)}`;
  });
  $('#legal-language')?.addEventListener('click',() => {
    const next = language() === 'ru' ? 'en' : 'ru';
    document.documentElement.lang = next; try { localStorage.setItem('zamelano-language',JSON.stringify(next)); } catch {}
  });
  new MutationObserver(renderLabels).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  if (pageMode) {
    try { document.documentElement.lang = JSON.parse(localStorage.getItem('zamelano-language')) === 'en' ? 'en' : 'ru'; } catch {}
    const restore = () => { if (location.hash === '#main') return; selected = location.hash.slice(1) || 'privacy'; section = new URL(location.href).searchParams.get('section'); renderSelected(); };
    window.addEventListener('popstate',restore); window.addEventListener('hashchange',restore); restore();
  }
  renderLabels();
  if (!cookieSeen()) $('#cookie-notice').hidden = false;
  async function loadDocuments() {
    try {
      const [documentsResponse,linksResponse] = await Promise.all([fetch('legal-documents.json',{cache:'no-cache'}),fetch('document-links.json',{cache:'no-cache'})]);
      if (!documentsResponse.ok || !linksResponse.ok) throw new Error('Document resource unavailable');
      const [data,settings] = await Promise.all([documentsResponse.json(),linksResponse.json()]);
      if (!Array.isArray(data.documents) || !data.documents.length) throw new Error('Invalid document bundle');
      bundle = data; links = settings; renderLabels();
    } catch {
      const article = $(pageMode ? '#legal-page-article' : '#legal-dialog-article');
      if (article) article.innerHTML = `<p role="alert">${t('error')}</p><button class="button secondary" id="legal-retry">${t('retry')}</button>`;
      $('#legal-retry')?.addEventListener('click',loadDocuments); updateFormConsent();
    }
  }
  loadDocuments();
})();
