'use strict';
(() => {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const plain=value=>String(value??'');
  function markup(value) {
    const template=document.createElement('template');template.innerHTML=plain(value);
    const walk=node=>[...node.childNodes].map(child=>{
      if(child.nodeType===Node.TEXT_NODE)return esc(child.textContent);
      if(child.nodeType!==Node.ELEMENT_NODE)return '';
      const tag=child.tagName.toLowerCase();const text=walk(child);
      return ['br','em','strong'].includes(tag)?(tag==='br'?'<br>':`<${tag}>${text}</${tag}>`):text;
    }).join('');return walk(template.content);
  }
  function safeURL(value) {
    if(typeof value!=='string'||!value.trim())return null;
    if(/[\u0000-\u0020<>"']/.test(value))return null;
    try {const url=new URL(value,location.href);return ['http:','https:','mailto:','tel:'].includes(url.protocol)?value:null;}catch{return null;}
  }
  const server=document.documentElement.dataset.cms==='server';
  const docsRoute=server?'documents.php':'documents.html';
  const route=value=>plain(value).replace(/documents\.html(?=[?#]|$)/g,docsRoute);
  const pair=(value,lang)=>value?.[lang]||value?.ru||'';
  const key='<span class="brand-key" aria-hidden="true"></span>';
  function documentAttrs(href) {const parsed=new URL(href,location.href);if(!/documents\.(?:html|php)$/.test(parsed.pathname)||!parsed.hash)return '';return ` data-document="${esc(parsed.hash.slice(1))}"${parsed.searchParams.get('section')?` data-document-section="${esc(parsed.searchParams.get('section'))}"`:''}`;}
  function anchor(item,lang,extra='') {const href=safeURL(route(item.href))||'#catalog';return `<a href="${esc(href)}"${documentAttrs(href)} ${extra}>${esc(pair(item.label,lang))}</a>`;}
  async function load() {
    const bootstrap=document.querySelector('#cms-bootstrap');
    if(bootstrap)try{return JSON.parse(bootstrap.textContent);}catch{}
    if(server)try{const response=await fetch('cms.php'+(new URL(location.href).searchParams.has('preview')?'?preview=1':''),{cache:'no-store'});if(response.ok){const data=await response.json();if(data.content&&data.catalog)return data;}}catch{}
    const names=['site-content.json','catalog.json','legal-documents.json','document-links.json'];
    const [content,catalog,documents,links]=await Promise.all(names.map(async name=>{const r=await fetch(name,{cache:'no-cache'});if(!r.ok)throw new Error('Не удалось загрузить содержимое сайта.');return r.json();}));
    return {content,catalog,documents,links,revision:0,preview:false};
  }
  function structural(data) {
    const content=data.content;
    const hero=document.querySelector('.hero');if(hero)hero.dataset.cmsSection='hero';
    const values=document.querySelector('.values-strip');if(values){values.dataset.cmsSection='values';values.id='values';}
    ['catalog','brand','journal','delivery','faq','reviews','wholesale'].forEach(id=>{const el=document.getElementById(id);if(el)el.dataset.cmsSection=id;});
    const track=document.querySelector('#hero-slide-track');
    if(track&&content.slides?.length){track.innerHTML=content.slides.map((slide,i)=>`<div class="hero-slide" role="group"${i?' aria-hidden="true" inert':''}><${i?'h2':'h1'} class="hero-slide-title"${i?'':' id="hero-title"'} data-i18n-html="cms-slide-title-${i}"></${i?'h2':'h1'}><p class="hero-description" data-i18n="cms-slide-description-${i}"></p></div>`).join('');document.querySelector('.hero-slide-dots').innerHTML=content.slides.map((_,i)=>`<button class="slide-dot${i?'':' is-active'}" type="button" data-hero-slide="${i}" aria-controls="hero-slide-track"><span></span></button>`).join('');}
    const categories=document.querySelector('.category-tabs');if(categories)categories.innerHTML=`<button class="tab active" data-category="all" data-i18n="all" aria-pressed="true"></button>`+(content.categories||[]).filter(c=>c.visible!==false).map((c,i)=>`<button class="tab" data-category="${esc(c.id)}" data-i18n="cms-category-${i}" aria-pressed="false"></button>`).join('');
    const faq=document.querySelector('.faq-list');if(faq)faq.innerHTML=(content.faq||[]).map((_,i)=>`<details><summary data-i18n="cms-faq-question-${i}"></summary><p data-i18n="cms-faq-answer-${i}"></p></details>`).join('');
    const grid=document.querySelector('.journal-grid');if(grid)grid.innerHTML=(content.articles||[]).filter(a=>a.status!=='trash'&&(a.status!=='draft'||data.preview)).map((a,i)=>`<button class="journal-card" data-article="${esc(a.id)}"><span class="journal-art ${a.image?'':a.id==='fit'?'art-fit':'art-news'}">${a.image?`<img src="${esc(safeURL(a.image)||'assets/ivory.webp')}" alt="" loading="lazy">`:(a.id==='fit'?'<span aria-hidden="true">Aa</span>':'<span aria-hidden="true">Z.</span>')}<span class="journal-tag" data-i18n="cms-article-tag-${i}"></span></span><span class="journal-bottom"><span data-i18n="cms-article-title-${i}"></span>${key}</span></button>`).join('');
    const selectors={hero:'.hero-visual>img',brand:'.brand-image>img',footerLogo:'.footer-brand>img'};
    for(const [id,selector] of Object.entries(selectors)){const el=document.querySelector(selector);if(el)el.dataset.cmsImage=id;}
    const main=document.querySelector('main#main');
    if(main&&hero){
      const builtin=new Map([...main.querySelectorAll(':scope>[data-cms-section]')].map(e=>[e.dataset.cmsSection,e]));
      for(const section of content.sections||[]){
        let element=builtin.get(section.id);
        if(section.type==='text'){
          element=document.createElement('section');element.id=section.id;element.className='section cms-custom-section';element.dataset.cmsSection=section.id;
          element.innerHTML=`${section.image?`<img class="cms-section-image" src="${esc(safeURL(section.image)||'assets/ivory.webp')}" alt="" loading="lazy">`:''}<div><h2 data-cms-custom-heading="${esc(section.id)}"></h2><div data-cms-custom-text="${esc(section.id)}"></div>${section.href?`<a class="underlined-link" data-cms-custom-button="${esc(section.id)}" href="${esc(safeURL(section.href)||'#contacts')}" data-brand-key></a>`:''}</div>`;
        }
        if(element){element.hidden=section.visible===false;main.append(element);builtin.delete(section.id);}
      }
      for(const element of builtin.values()){element.hidden=true;main.append(element);}
    }
    if(data.preview){const bar=document.createElement('div');bar.className='cms-preview-bar';bar.textContent='Предпросмотр черновика · посетители видят опубликованную версию';document.body.prepend(bar);document.querySelectorAll('meta[name=robots],meta[name=googlebot],meta[name=yandex]').forEach(e=>e.content='noindex, nofollow');}
  }
  function translations(data,lang) {
    const content=data.content,result={...(content.translations?.[lang]||{})};
    for(const [key,value] of Object.entries(result))if(/^(heroTitle|brandTitle|wholesaleTitle)/.test(key))result[key]=markup(value);
    (content.slides||[]).forEach((slide,i)=>{result[`cms-slide-title-${i}`]=markup(pair(slide.title,lang));result[`cms-slide-description-${i}`]=pair(slide.description,lang);});
    (content.categories||[]).filter(c=>c.visible!==false).forEach((c,i)=>result[`cms-category-${i}`]=pair(c.title,lang));
    (content.faq||[]).forEach((row,i)=>{result[`cms-faq-question-${i}`]=pair(row.question,lang);result[`cms-faq-answer-${i}`]=pair(row.answer,lang);});
    (content.articles||[]).filter(a=>a.status!=='trash'&&(a.status!=='draft'||data.preview)).forEach((a,i)=>{result[`cms-article-tag-${i}`]=pair(a.tag,lang);result[`cms-article-title-${i}`]=pair(a.title,lang);});
    return result;
  }
  function apply(data,lang='ru') {
    const {content}=data,settings=content.settings;
    const theme=settings.theme||{};const css={paper:theme.paper,peach:theme.peach,'peach-light':theme.peachLight,ink:theme.ink,muted:theme.muted,gold:theme.gold,line:theme.line};
    for(const [name,value]of Object.entries(css))if(/^#[a-f0-9]{6}$/i.test(value||''))document.documentElement.style.setProperty('--'+name,value);
    for(const [name,value]of [['serif',theme.serif],['sans',theme.sans]])if(['Georgia','Times New Roman','Palatino Linotype','Arial','Helvetica','Verdana','Trebuchet MS'].includes(value))document.documentElement.style.setProperty('--'+name,`"${value}",${name==='serif'?'serif':'sans-serif'}`);
    if(theme.radius!==null&&Number.isFinite(Number(theme.radius))){document.documentElement.style.setProperty('--cms-radius',`${Math.min(80,Math.max(0,Number(theme.radius)))}px`);document.body.classList.add('cms-custom-radius');}
    for(const el of document.querySelectorAll('[data-cms-image]')){const image=content.images[el.dataset.cmsImage];if(image&&safeURL(image.src)){el.src=image.src;el.alt=pair(image.alt,lang);}}
    if(settings.headerLogo&&safeURL(settings.headerLogo))for(const logo of document.querySelectorAll('.header-logo')){logo.classList.add('cms-logo-image');logo.style.mask='none';logo.style.webkitMask='none';logo.innerHTML=`<img src="${esc(settings.headerLogo)}" alt="${esc(settings.name)}">`;}
    const icon=document.querySelector('link[rel=icon]');if(icon&&safeURL(settings.favicon)){icon.href=settings.favicon;icon.removeAttribute('type');}
    const nav=document.querySelector('.desktop-nav');if(nav)nav.innerHTML=(content.menus.header||[]).map(item=>anchor(item,lang)).join('');
    const mobile=document.querySelector('#menu-dialog nav');if(mobile)mobile.innerHTML=[...(content.menus.header||[]),{label:{ru:'Будем на связи',en:'Stay in touch'},href:'#contacts'}].map(item=>anchor(item,lang)).join('');
    const footer=document.querySelector('.footer-main');
    if(footer){for(const group of [...footer.children].slice(1))group.remove();for(const group of content.menus.footer||[]){const el=document.createElement('div');el.innerHTML=`<h3>${esc(pair(group.title,lang))}</h3>`+(group.items||[]).map(item=>anchor(item,lang)).join('');footer.append(el);}
      const contact=document.createElement('div'),c=settings.contacts;contact.innerHTML=`<h3>${esc(content.translations[lang].contacts||(lang==='ru'?'Будем на связи':'Stay in touch'))}</h3>${c.telegram?`<a href="${esc(c.telegram)}" target="_blank" rel="noopener" data-brand-key>${esc(content.translations[lang].telegramLink||'Telegram')}</a>`:''}${c.instagram?`<a href="${esc(c.instagram)}" target="_blank" rel="noopener" data-brand-key>${esc(content.translations[lang].instagramLink||'Instagram')}</a>`:''}`+(c.emails||[]).map(mail=>`<a href="mailto:${esc(mail)}">${esc(mail)}</a>`).join('')+`<button class="footer-link" id="contact-open" data-brand-key>${esc(content.translations[lang].leaveRequest||content.translations.ru.leaveRequest)}</button><a class="footer-pending" href="tel:${esc(c.phone.replace(/[^+\d]/g,''))}">${esc(c.phone)}</a>`;footer.append(contact);
    }
    const legalLinks=document.querySelector('.footer-document-links');if(legalLinks)legalLinks.innerHTML=data.documents.documents.filter(doc=>doc.visible!==false).map(doc=>`<a href="${docsRoute}#${esc(doc.id)}" data-document="${esc(doc.id)}" data-brand-key>${esc(pair(doc.label,lang))}</a>`).join('')+`<button type="button" data-cookie-open>${lang==='ru'?'О cookie':'About cookies'}</button>`;
    for(const el of document.querySelectorAll('a[href*="t.me/Zamelano"]'))if(settings.contacts.telegram)el.href=settings.contacts.telegram;
    for(const section of content.sections||[]){if(section.type!=='text')continue;const el=document.getElementById(section.id);if(!el)continue;el.querySelector('[data-cms-custom-heading]').textContent=pair(section.heading,lang);el.querySelector('[data-cms-custom-text]').innerHTML=pair(section.text,lang).split(/\n\s*\n/).map(p=>`<p>${esc(p).replace(/\n/g,'<br>')}</p>`).join('');const a=el.querySelector('[data-cms-custom-button]');if(a)a.textContent=pair(section.button,lang);}
    const reviews=document.querySelector('#reviews');if(reviews){reviews.querySelector('.cms-review-grid')?.remove();const rows=(content.reviews||[]).filter(r=>r.visible!==false);if(rows.length){const grid=document.createElement('div');grid.className='cms-review-grid';grid.innerHTML=rows.map(r=>`<article>${r.image?`<img src="${esc(safeURL(r.image)||'')}" alt="" loading="lazy">`:''}<h3>${esc(r.name)}</h3><p>${esc(pair(r.text,lang)).replace(/\n/g,'<br>')}</p></article>`).join('');reviews.append(grid);}}
    const note=document.querySelector('.catalog-note');if(note)note.hidden=settings.catalogMode==='live';
    const title=document.querySelector('title');if(title&&!document.body.hasAttribute('data-documents-page'))title.textContent=pair(settings.title,lang);
    for(const meta of document.querySelectorAll('meta[name=description],meta[property="og:description"]'))meta.content=pair(settings.description,lang);
    for(const el of document.querySelectorAll('.footer-bottom>span:first-child,.legal-page-footer>span:first-child'))el.textContent=pair(settings.copyright,lang)||'© 2026 ZAMELANO';
    document.querySelectorAll('header.header').forEach(el=>el.hidden=settings.showHeader===false);document.querySelectorAll('footer').forEach(el=>el.hidden=settings.showFooter===false);
    const mainButton=document.querySelector('.hero-copy>a.primary');if(mainButton&&safeURL(settings.actionLinks?.heroCatalog))mainButton.href=settings.actionLinks.heroCatalog;const brandButton=document.querySelector('.hero-copy>a.quiet-link');if(brandButton&&safeURL(settings.actionLinks?.heroBrand))brandButton.href=settings.actionLinks.heroBrand;
    const og=document.querySelector('meta[property="og:title"]');if(og)og.content=pair(settings.title,lang);
    if(server)for(const meta of document.querySelectorAll('meta[name=robots],meta[name=googlebot],meta[name=yandex]'))meta.content=settings.indexing&&!data.preview?'index, follow':'noindex, nofollow';
  }
  const ready=load().then(data=>{structural(data);return data;});
  window.ZamelanoCMS={ready,markup,safeURL,apply,translations,route,docsRoute,pair};
})();
