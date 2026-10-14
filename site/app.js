'use strict';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function readLocal(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } }
function writeLocal(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
let lang = readLocal('zamelano-language', 'ru') === 'en' ? 'en' : 'ru';
let products = [];
let favorites = readLocal('zamelano-favorites', []);
let cart = readLocal('zamelano-cart', []);
if (!Array.isArray(favorites)) favorites = [];
if (!Array.isArray(cart)) cart = [];
favorites = favorites.filter(id => typeof id === 'string');
cart = cart.filter(line => line && typeof line.id === 'string' && typeof line.size === 'string' && typeof line.color === 'string' && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 999);
let category = 'all', favoriteView = false, selectedProductId = null, requestKind = 'contact', contentKind = null;
const paletteColors = {ivory:'#eadcc5',black:'#39302b',peach:'#e5b5a1'};
const dictionary = {
  ru: {
    home:'ZAMELANO — главная',logoAlt:'Логотип ZAMELANO',skip:'Перейти к содержимому',announcement:'Онлайн-бутик · Доставка по Москве и Московской области',write:'Написать нам',navigation:'Основная навигация',catalog:'Каталог',brand:'О бренде',journal:'Журнал',delivery:'Доставка и оплата',search:'Поиск',favorites:'Избранное',cart:'Корзина',menu:'Меню',close:'Закрыть',heroEyebrow:'БЕЛЬЁ. НАСТРОЕНИЕ. ТЫ.',heroTitle:'Красота<br>начинается<br>с <em>ощущения.</em>',heroDescription:'Женское нижнее бельё. Для себя, своего настроения и каждого нового дня.',explore:'Открыть каталог',discoverBrand:'Познакомиться с ZAMELANO',heroFoot:'Личная история. Красивое начало.',heroAlt:'Иллюстрация концепции: молочный кружевной комплект на персиковом атласе',imageConcept:'Визуальная концепция · изображение создано ИИ',value1:'Для себя',value2:'Для своего настроения',value3:'Для красивого начала',catalogEyebrow:'ТВОЁ ЛИЧНОЕ',catalogTitle:'Найди своё ощущение',filters:'Фильтры',catalogNote:'Концепция каталога: модели, размеры, цвета, цены и наличие — [заполнить]. Иллюстрации не показывают реальные товары.',categories:'Концепции палитры',all:'Все комплекты',ivoryConcept:'Молочная палитра',blackConcept:'Тёмная палитра',peachConcept:'Персиковая палитра',sort:'Сортировка',sortDefault:'По порядку',sortAsc:'Цена: по возрастанию',sortDesc:'Цена: по убыванию',size:'Размер',allSizes:'Все размеры',fill:'[заполнить]',color:'Цвет',allColors:'Все цвета',ivory:'Молочный · концепт',black:'Чёрный · концепт',peach:'Персиковый · концепт',collection:'Коллекция',allCollections:'Все коллекции',concept:'Концепция · [заполнить]',priceFrom:'Цена от, ₽',priceTo:'Цена до, ₽',reset:'Сбросить',filterNote:'Цены пока не указаны: фильтр по цене показывает только товары с заполненной ценой.',searchPlaceholder:'Найти комплект…',showAll:'Показать все',brandAlt:'Иллюстрация концепции: персиковое кружево на светлом атласе',brandImageCaption:'ZAMELANO · ВИЗУАЛЬНАЯ КОНЦЕПЦИЯ',brandEyebrow:'БЛИЖЕ К СЕБЕ',brandTitle:'Маленький ритуал.<br><em>Только для тебя.</em>',brandText1:'Бельё — личная часть гардероба. То, что выбирают по своему ощущению, а не по чужим правилам.',brandText2:'ZAMELANO — бренд женского нижнего белья и онлайн-бутик. Качество — главный ориентир бренда. Здесь начинается знакомство с его будущей коллекцией.',askBrand:'Задать вопрос бренду',journalEyebrow:'МЕЖДУ СТРОК',journalTitle:'Журнал ZAMELANO',journalNote:'Редакционные темы к запуску',guide:'ГИД',details:'ДЕТАЛИ',news:'НОВОСТИ',articleFit:'Как найти своё бельё',articleCare:'Искусство бережного ухода',articleNews:'Новая глава ZAMELANO',serviceEyebrow:'ПОКУПАТЬ С УДОВОЛЬСТВИЕМ',serviceTitle:'Всё о вашем заказе',deliveryText:'Курьером по Москве и Московской области. Стоимость — по факту доставки. Сроки и условия — [заполнить].',paymentText:'Карта и СБП — запланированы. Онлайн-оплата будет доступна после подключения платёжного сервиса и кассы.',sizeHelp:'Помощь с размером',sizeText:'Размерная сетка производителя — [заполнить]. Пока вы можете задать вопрос бренду в Telegram.',openSize:'Как выбрать размер',gifts:'Подарки и привилегии',giftsText:'Подарочные сертификаты, промокоды, бонусы и сезонные акции — в планах. Условия и номиналы — [заполнить].',askDetails:'Уточнить подробности',faqEyebrow:'ОСТАЛИСЬ ВОПРОСЫ?',faqTitle:'Давай разберёмся',askTelegram:'Спросить в Telegram',faq1:'Где можно купить ZAMELANO?',faq1Answer:'Бренд работает только онлайн. Сейчас на сайте представлена концепция каталога; реальные товары и цены — [заполнить]. По вопросам покупки напишите в Telegram.',faq2:'Куда доставляете заказы?',faq2Answer:'Курьерская доставка доступна по Москве и Московской области. Стоимость — по факту доставки, сроки — [заполнить].',faq3:'Можно ли сделать оптовый заказ?',faq3Answer:'Да, опт — от 100 комплектов. Условия, цены и сроки — [заполнить]. Используйте форму для партнёров ниже.',faq4:'Как оплатить заказ?',faq4Answer:'Планируются оплата картой онлайн и СБП. Платёжный сервис и онлайн-касса ещё не подключены. На этом этапе можно подготовить заявку в Telegram, без оплаты.',faq5:'Какие условия обмена и возврата?',faq5Answer:'Условия обмена и возврата — [заполнить]. Документы готовят юристы бренда. Пожалуйста, уточните условия перед покупкой.',reviews:'ВАШИ ИСТОРИИ',reviewsTitle:'Здесь будут ваши впечатления',reviewsText:'Отзывы покупателей — [заполнить]. Мы оставили место для настоящих историй о ZAMELANO.',wholesaleEyebrow:'ДЛЯ ПАРТНЁРОВ',wholesaleTitle:'Красивые вещи<br><em>объединяют.</em>',wholesaleText:'Оптовые заказы от 100 комплектов. Расскажите о своём запросе — обсудим сотрудничество.',wholesaleButton:'Обсудить сотрудничество',shop:'Бутик',customers:'Покупателям',contacts:'Будем на связи',wholesale:'Оптовым партнёрам',footerTagline:'Бельё. Настроение. Ты.',faq:'Вопросы и ответы',reviewsLink:'Отзывы',returns:'Обмен и возврат',leaveRequest:'Оставить заявку',phonePending:'Телефон бренда: +7 [заполнить]',legalDetails:'Реквизиты ИП',privacy:'Политика конфиденциальности',offer:'Публичная оферта',draft:'Концепция магазина',personalContact:'ЛИЧНОЕ ОБЩЕНИЕ',name:'Имя',phone:'Телефон',time:'Удобное время',comment:'Комментарий / другие пожелания',wholesaleQuantity:'Количество комплектов',region:'Регион доставки',moscow:'Москва',mo:'Московская область',address:'Адрес доставки',consent:'Я разрешаю использовать указанные данные для ответа на мой запрос.',requestInfo:'Данные не сохраняются на сайте. Вы увидите текст заявки, сможете скопировать его и самостоятельно отправить в Telegram @Zamelano. Документы о персональных данных — [заполнить].',prepareRequest:'Подготовить заявку',requestText:'Текст заявки',requestReady:'Текст подготовлен. Заявка ещё не отправлена.',copy:'Скопировать текст',openTelegram:'Открыть Telegram',telegramHelp:'Если текст не появился в Telegram, вставьте скопированный текст в чат @Zamelano и нажмите «Отправить».',editRequest:'Изменить заявку',modelName:'Название модели — [заполнить]',priceLabel:'Цена',pricePending:'Цена: [заполнить]',stockPending:'Наличие — [заполнить]',outOfStock:'Нет в наличии',inStock:'В наличии',cardConcept:'КОНЦЕПЦИЯ',detail:'Подробнее',addFavorite:'Добавить в избранное',removeFavorite:'Убрать из избранного',catalogCount:'концепции',productCount:'товаров',noResults:'Пока ничего не найдено',noResultsText:'Попробуйте изменить поиск или сбросить фильтры.',sortNotice:'Цены — [заполнить]. Пока сохраняем исходный порядок.',productEyebrow:'ВИЗУАЛЬНАЯ КОНЦЕПЦИЯ',productNote:'Реальные товары, варианты и характеристики будут добавлены по данным бренда. Вы можете сохранить концепцию в корзину и подготовить вопрос.',addToCart:'Добавить в корзину',askAvailability:'Уточнить наличие в Telegram',added:'Добавлено в корзину',cartEmpty:'Здесь начинается твой выбор',cartEmptyText:'Добавь понравившийся комплект из каталога.',remove:'Удалить',decrease:'Уменьшить количество',increase:'Увеличить количество',total:'Стоимость товаров',pendingTotal:'[заполнить]',deliverySummary:'Доставка: Москва и Московская область, стоимость по факту. Сроки — [заполнить].',cartDisclaimer:'В корзине — концепции. Цены и наличие — [заполнить]. Оплата пока недоступна; заявка поможет обсудить выбор с брендом.',prepareOrder:'Оформить заявку',paymentMethods:'Карта / СБП: [заполнить] · подключение ожидается',contactTitle:'Оставить заявку',contactDescription:'Расскажите, чем мы можем помочь. Подготовим сообщение для Telegram.',wholesaleRequestTitle:'Запрос на сотрудничество',wholesaleDescription:'Опт от 100 комплектов. Цены, ассортимент и условия — [заполнить].',orderTitle:'Заявка по выбранным комплектам',orderDescription:'Цены и наличие нужно уточнить у бренда. Эта заявка не является оплаченным заказом.',copied:'Текст скопирован',copyFallback:'Выделите и скопируйте текст заявки вручную.',invalidPhone:'Введите телефон: от 10 до 15 цифр.',invalidName:'Пожалуйста, укажите имя.',requestHeader:'Заявка ZAMELANO',requestType:'Тип запроса',contactType:'Вопрос бренду',wholesaleType:'Оптовое сотрудничество',orderType:'Запрос по выбранным концепциям',orderItems:'Выбранные комплекты',qty:'шт.',orderWarning:'Стоимость, реальные модели, размеры, цвета и наличие — [заполнить]. Доставка по факту. Это заявка без оплаты, прошу уточнить данные.',connectionError:'Каталог временно недоступен',connectionErrorText:'Обновите страницу или свяжитесь с брендом в Telegram.',reload:'Повторить',backCatalog:'Вернуться в каталог',articleDraft:'Редакционный черновик · публикацию согласовать с брендом',sizeGuideTitle:'Как выбрать размер',sizeGuideText:'Размерная сетка, диапазон размеров и особенности посадки — [заполнить] по данным производителя. Универсальная таблица здесь не используется: у разных моделей мерки могут отличаться.',sizeGuideStep1:'Снимите мерки обхвата под грудью, обхвата груди и бёдер мягкой сантиметровой лентой.',sizeGuideStep2:'Сверьте мерки с таблицей производителя для конкретного изделия — [заполнить].',sizeGuideStep3:'Напишите бренду в Telegram, если нужна помощь с выбором.',legalPending:'Документ — [заполнить]. Финальную версию готовят юристы бренда.',privacyText:'Сайт запоминает язык, избранное и состав корзины в вашем браузере. Контактные данные формы не записываются в локальное хранилище и не отправляются на сервер. Текст передаётся в Telegram только при открытии ссылки; отправку сообщения подтверждаете вы.',offerText:'Данные о товарах, ценах, оплате, сроках доставки и правилах заказа — [заполнить]. Концепции каталога не являются предложением купить показанные изделия.',returnText:'Порядок обмена и возврата, сроки и контакт для обращения — [заполнить]. Уточните условия у бренда до оформления покупки.',individual:'Индивидуальный предприниматель Замелов Евгений Витальевич',legalAddressLabel:'Юридический адрес',legalAddress:'[заполнить]',taxId:'ИНН',registrationId:'ОГРНИП',account:'Расчётный счёт',correspondent:'Корреспондентский счёт',bic:'БИК',bank:'Банк',bankName:'ПАО Сбербанк',entrepreneurPhone:'Телефон из карточки ИП',entrepreneurEmail:'E-mail из карточки ИП',taxSystem:'Система налогообложения',taxName:'УСН «Доходы»',legalAddressNote:'Чувствительные реквизиты и точный адрес из карточки ИП исключены из публичной демонстрации. Подтверждённые публичные реквизиты для боевого сайта — [заполнить].'
  },
  en: {
    home:'ZAMELANO — home',logoAlt:'ZAMELANO logo',skip:'Skip to content',announcement:'Online boutique · Courier delivery in Moscow and Moscow Region',write:'Get in touch',navigation:'Main navigation',catalog:'Shop',brand:'Our story',journal:'Journal',delivery:'Delivery & payment',search:'Search',favorites:'Favourites',cart:'Shopping bag',menu:'Menu',close:'Close',heroEyebrow:'LINGERIE. A MOOD. YOU.',heroTitle:'Beauty<br>begins with<br>a <em>feeling.</em>',heroDescription:'Women’s lingerie. For yourself, your mood, and every new day.',explore:'Explore the collection',discoverBrand:'Discover ZAMELANO',heroFoot:'A personal story. A beautiful beginning.',heroAlt:'Concept illustration: ivory lace lingerie on peach satin',imageConcept:'Visual concept · AI-generated image',value1:'For yourself',value2:'For your mood',value3:'For a beautiful beginning',catalogEyebrow:'SOMETHING PERSONAL',catalogTitle:'Find your own feeling',filters:'Filters',catalogNote:'Catalogue concept: models, sizes, colours, prices and stock — [fill in]. Illustrations do not depict actual products.',categories:'Palette concepts',all:'All lingerie sets',ivoryConcept:'Ivory palette',blackConcept:'Dark palette',peachConcept:'Peach palette',sort:'Sort',sortDefault:'Original order',sortAsc:'Price: low to high',sortDesc:'Price: high to low',size:'Size',allSizes:'All sizes',fill:'[fill in]',color:'Colour',allColors:'All colours',ivory:'Ivory · concept',black:'Black · concept',peach:'Peach · concept',collection:'Collection',allCollections:'All collections',concept:'Concept · [fill in]',priceFrom:'Price from, RUB',priceTo:'Price to, RUB',reset:'Reset',filterNote:'Prices are not listed yet. Price filters only show products with a confirmed price.',searchPlaceholder:'Find a lingerie set…',showAll:'Show all',brandAlt:'Concept illustration: peach lace lingerie on ivory satin',brandImageCaption:'ZAMELANO · VISUAL CONCEPT',brandEyebrow:'CLOSER TO YOURSELF',brandTitle:'A little ritual.<br><em>Just for you.</em>',brandText1:'Lingerie is a personal part of your wardrobe. Chosen by how you feel, rather than someone else’s rules.',brandText2:'ZAMELANO is a women’s lingerie brand and online boutique. Quality is the brand’s guiding principle. This is your first look at the concept for its future collection.',askBrand:'Ask the brand a question',journalEyebrow:'BETWEEN THE LINES',journalTitle:'The ZAMELANO journal',journalNote:'Editorial topics for launch',guide:'GUIDE',details:'DETAILS',news:'NEWS',articleFit:'Finding your lingerie',articleCare:'The art of gentle care',articleNews:'A new chapter for ZAMELANO',serviceEyebrow:'THE PLEASURE OF SHOPPING',serviceTitle:'About your order',deliveryText:'Courier delivery in Moscow and Moscow Region. The charge is based on the actual delivery cost. Timing and terms — [fill in].',paymentText:'Online card payments and SBP are planned. Payments will become available once the payment provider and online cash register are connected.',sizeHelp:'Finding your size',sizeText:'Manufacturer’s size chart — [fill in]. For now, you can ask the brand for help on Telegram.',openSize:'How to choose your size',gifts:'Gifts & little privileges',giftsText:'Gift certificates, promo codes, loyalty bonuses and seasonal offers are planned. Terms and values — [fill in].',askDetails:'Ask for details',faqEyebrow:'ANY QUESTIONS?',faqTitle:'Let’s talk it through',askTelegram:'Ask on Telegram',faq1:'Where can I buy ZAMELANO?',faq1Answer:'The brand operates online only. This website currently presents a catalogue concept. Actual products and prices — [fill in]. Please contact the brand on Telegram about purchases.',faq2:'Where do you deliver?',faq2Answer:'Courier delivery is available in Moscow and Moscow Region. The charge is based on the actual delivery cost. Delivery times — [fill in].',faq3:'Can I place a wholesale order?',faq3Answer:'Yes, wholesale orders start at 100 lingerie sets. Terms, prices and timing — [fill in]. Use the partner enquiry form below.',faq4:'How can I pay?',faq4Answer:'Online card payments and SBP are planned. The payment service and online cash register have not been connected yet. At this stage, you can prepare a Telegram enquiry without making a payment.',faq5:'What is your returns policy?',faq5Answer:'Exchange and return terms — [fill in]. The brand’s lawyers are preparing the documents. Please confirm the terms before buying.',reviews:'YOUR STORIES',reviewsTitle:'A place for your impressions',reviewsText:'Customer reviews — [fill in]. We have left room for real stories about ZAMELANO.',wholesaleEyebrow:'FOR OUR PARTNERS',wholesaleTitle:'Beautiful things<br><em>bring us together.</em>',wholesaleText:'Wholesale orders from 100 lingerie sets. Tell us what you have in mind and let’s discuss working together.',wholesaleButton:'Discuss a partnership',shop:'Boutique',customers:'For customers',contacts:'Stay in touch',wholesale:'Wholesale partners',footerTagline:'Lingerie. A mood. You.',faq:'Questions & answers',reviewsLink:'Reviews',returns:'Exchanges & returns',leaveRequest:'Leave an enquiry',phonePending:'Brand phone: +7 [fill in]',legalDetails:'Business details',privacy:'Privacy policy',offer:'Terms of sale',draft:'Store concept',personalContact:'A PERSONAL CONVERSATION',name:'Name',phone:'Phone',time:'Preferred contact time',comment:'Comment / other preferences',wholesaleQuantity:'Number of lingerie sets',region:'Delivery region',moscow:'Moscow',mo:'Moscow Region',address:'Delivery address',consent:'I agree to the use of these details to respond to my enquiry.',requestInfo:'Your details are not stored on this website. You will see your enquiry text, which you can copy and send yourself to @Zamelano on Telegram. Personal data documents — [fill in].',prepareRequest:'Prepare enquiry',requestText:'Enquiry text',requestReady:'Your text is ready. The enquiry has not been sent.',copy:'Copy text',openTelegram:'Open Telegram',telegramHelp:'If the text does not appear in Telegram, paste the copied text into the chat with @Zamelano and press Send.',editRequest:'Edit enquiry',modelName:'Model name — [fill in]',priceLabel:'Price',pricePending:'Price: [fill in]',stockPending:'Stock — [fill in]',outOfStock:'Out of stock',inStock:'In stock',cardConcept:'CONCEPT',detail:'View details',addFavorite:'Add to favourites',removeFavorite:'Remove from favourites',catalogCount:'concepts',productCount:'products',noResults:'Nothing here just yet',noResultsText:'Try changing your search or resetting the filters.',sortNotice:'Prices — [fill in]. Original order is retained for now.',productEyebrow:'VISUAL CONCEPT',productNote:'Actual products, variants and specifications will be added using the brand’s data. You can save this concept in your bag and prepare an enquiry.',addToCart:'Add to bag',askAvailability:'Ask about availability on Telegram',added:'Added to your bag',cartEmpty:'Your choice starts here',cartEmptyText:'Add a lingerie set you like from the catalogue.',remove:'Remove',decrease:'Decrease quantity',increase:'Increase quantity',total:'Product total',pendingTotal:'[fill in]',deliverySummary:'Delivery: Moscow and Moscow Region, charged at actual cost. Timing — [fill in].',cartDisclaimer:'Your bag contains concepts. Prices and stock — [fill in]. Payment is not available yet; an enquiry lets you discuss your selection with the brand.',prepareOrder:'Prepare an enquiry',paymentMethods:'Card / SBP: [fill in] · awaiting connection',contactTitle:'Leave an enquiry',contactDescription:'Tell us how we can help. We will prepare your message for Telegram.',wholesaleRequestTitle:'Partnership enquiry',wholesaleDescription:'Wholesale starts at 100 sets. Prices, range and terms — [fill in].',orderTitle:'Enquiry about your selection',orderDescription:'Prices and stock need to be confirmed with the brand. This enquiry is not a paid order.',copied:'Text copied',copyFallback:'Please select and copy the enquiry text manually.',invalidPhone:'Enter a phone number with 10 to 15 digits.',invalidName:'Please enter your name.',requestHeader:'ZAMELANO enquiry',requestType:'Enquiry type',contactType:'Question for the brand',wholesaleType:'Wholesale partnership',orderType:'Enquiry about selected concepts',orderItems:'Selected lingerie sets',qty:'pcs',orderWarning:'Prices, actual models, sizes, colours and stock — [fill in]. Delivery at actual cost. This is an enquiry without payment; please confirm the details.',connectionError:'The catalogue is temporarily unavailable',connectionErrorText:'Refresh this page or contact the brand on Telegram.',reload:'Try again',backCatalog:'Back to the collection',articleDraft:'Editorial draft · to be approved by the brand',sizeGuideTitle:'How to choose your size',sizeGuideText:'Size chart, available sizes and fit information — [fill in] using the manufacturer’s data. We do not use a universal size chart here: measurements can vary between models.',sizeGuideStep1:'Use a soft measuring tape to measure your underbust, bust and hips.',sizeGuideStep2:'Compare your measurements with the manufacturer’s chart for the specific item — [fill in].',sizeGuideStep3:'Message the brand on Telegram if you would like help choosing.',legalPending:'Document — [fill in]. The brand’s lawyers are preparing the final version.',privacyText:'This website remembers your language, favourites and shopping bag in your browser. Contact details entered in the form are not saved in local storage or sent to a server. The text is passed to Telegram only when you open the link; you confirm sending the message yourself.',offerText:'Product details, prices, payment, delivery times and ordering terms — [fill in]. The catalogue concepts are not an offer to purchase the illustrated items.',returnText:'Exchange and return procedure, time limits and contact details — [fill in]. Confirm the terms with the brand before making a purchase.',individual:'Individual entrepreneur Evgeny Vitalyevich Zamelov',legalAddressLabel:'Registered business address',legalAddress:'[fill in]',taxId:'INN (tax ID)',registrationId:'OGRNIP (registration ID)',account:'Settlement account',correspondent:'Correspondent account',bic:'Bank BIC',bank:'Bank',bankName:'Sberbank PJSC',entrepreneurPhone:'Phone from the business card',entrepreneurEmail:'Email from the business card',taxSystem:'Tax regime',taxName:'Simplified taxation: income',legalAddressNote:'Sensitive business details and the precise address from the business card are excluded from this public demo. Confirmed public business details for production — [fill in].'
  }
};
Object.assign(dictionary.ru, {
  heroSlider:'Настроение ZAMELANO', previousSlide:'Предыдущий слайд', backSlide:'Назад', forwardSlide:'Далее', nextSlide:'Следующий слайд',
  slide:'Слайд', of:'из', showSlide:'Показать слайд', carousel:'карусель', slideRole:'слайд',
  heroTitle2:'Твоё<br>настроение.<br><em>Твой выбор.</em>',
  heroDescription2:'Для спокойного утра, нового дня и особенного вечера. Выбирай то, что близко тебе.',
  heroTitle3:'Маленький<br>ритуал.<br><em>Только твой.</em>',
  heroDescription3:'Личная история начинается с деталей. Познакомься с настроением ZAMELANO.'
});
Object.assign(dictionary.en, {
  heroSlider:'The ZAMELANO mood', previousSlide:'Previous slide', backSlide:'Back', forwardSlide:'Next', nextSlide:'Next slide',
  slide:'Slide', of:'of', showSlide:'Show slide', carousel:'carousel', slideRole:'slide',
  heroTitle2:'Your<br>mood.<br><em>Your choice.</em>',
  heroDescription2:'For a quiet morning, a new day and a special evening. Choose what feels right for you.',
  heroTitle3:'A small<br>ritual.<br><em>Just for you.</em>',
  heroDescription3:'A personal story starts with the details. Discover the mood of ZAMELANO.'
});
const t = key => dictionary[lang][key] ?? key;
const productName = p => p.name?.[lang] || p.name?.ru || t('fill');
const formatPrice = p => Number.isFinite(p.price) ? new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-GB', {style:'currency',currency:'RUB',maximumFractionDigits:2}).format(p.price) : t('pricePending');
const statusText = p => p.stock === 0 ? t('outOfStock') : p.stock > 0 ? t('inStock') : t('stockPending');
const isConcept = p => p.id.startsWith('concept-');
const icon = name => `<svg aria-hidden="true"><use href="#icon-${name}"/></svg>`;

const heroSlides = $$('.hero-slide');
let heroSlideIndex = 0;
function updateHeroSlider() {
  $('#hero-slider').setAttribute('aria-roledescription', t('carousel'));
  $('#hero-slide-track').style.setProperty('--hero-slide', heroSlideIndex);
  heroSlides.forEach((slide, index) => {
    const active = index === heroSlideIndex;
    slide.inert = !active;
    slide.setAttribute('aria-hidden', String(!active));
    slide.setAttribute('aria-roledescription', t('slideRole'));
    slide.setAttribute('aria-label', `${index + 1} ${t('of')} ${heroSlides.length}`);
  });
  $$('[data-hero-slide]').forEach((button, index) => {
    const active = index === heroSlideIndex;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
    button.setAttribute('aria-label', `${t('showSlide')} ${index + 1} ${t('of')} ${heroSlides.length}`);
  });
  $('#hero-slide-count').textContent = `${String(heroSlideIndex + 1).padStart(2, '0')} / ${String(heroSlides.length).padStart(2, '0')}`;
  $('#hero-slide-status').textContent = `${t('slide')} ${heroSlideIndex + 1} ${t('of')} ${heroSlides.length}`;
}
function selectHeroSlide(index) {
  heroSlideIndex = (index + heroSlides.length) % heroSlides.length;
  updateHeroSlider();
}
$('#hero-prev').addEventListener('click', () => selectHeroSlide(heroSlideIndex - 1));
$('#hero-next').addEventListener('click', () => selectHeroSlide(heroSlideIndex + 1));
$$('[data-hero-slide]').forEach(button => button.addEventListener('click', () => selectHeroSlide(Number(button.dataset.heroSlide))));
$('#hero-slider').addEventListener('keydown', event => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    selectHeroSlide(heroSlideIndex + (event.key === 'ArrowRight' ? 1 : -1));
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    selectHeroSlide(event.key === 'Home' ? 0 : heroSlides.length - 1);
  }
});
let heroSwipeStart = null;
$('#hero-slide-window').addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  heroSwipeStart = {x:event.clientX, y:event.clientY, id:event.pointerId};
  event.currentTarget.setPointerCapture(event.pointerId);
  if (event.pointerType === 'mouse') event.preventDefault();
});
$('#hero-slide-window').addEventListener('pointerup', event => {
  if (!heroSwipeStart || event.pointerId !== heroSwipeStart.id) return;
  const dx = event.clientX - heroSwipeStart.x, dy = event.clientY - heroSwipeStart.y;
  heroSwipeStart = null;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) selectHeroSlide(heroSlideIndex + (dx < 0 ? 1 : -1));
});
$('#hero-slide-window').addEventListener('pointercancel', () => { heroSwipeStart = null; });

function decorateBrandSelects(root = document) {
  $$('select', root).forEach(select => {
    if (select.parentElement.classList.contains('brand-select-key')) return;
    const wrapper = document.createElement('span');
    wrapper.className = 'brand-select-key';
    select.before(wrapper);
    wrapper.append(select);
  });
}

function translatePage() {
  document.documentElement.lang = lang;
  document.title = lang === 'ru' ? 'ZAMELANO — Красота начинается с ощущения' : 'ZAMELANO — Beauty begins with a feeling';
  $$('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
  $$('[data-i18n-html]').forEach(el => el.innerHTML = t(el.dataset.i18nHtml));
  $$('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  $$('[data-i18n-alt]').forEach(el => el.alt = t(el.dataset.i18nAlt));
  $$('[data-i18n-placeholder]').forEach(el => el.placeholder = t(el.dataset.i18nPlaceholder));
  $('#language').innerHTML = lang === 'ru' ? 'RU <span>/ EN</span>' : 'EN <span>/ RU</span>';
  $('#language').setAttribute('aria-label', lang === 'ru' ? 'Switch to English' : 'Переключить на русский');
  document.querySelector('meta[name="description"]').content = lang === 'ru' ? 'ZAMELANO — женское нижнее бельё. Концепция интернет-магазина на русском и английском. Курьерская доставка по Москве и Московской области.' : 'ZAMELANO — women’s lingerie. A bilingual online boutique concept. Courier delivery in Moscow and Moscow Region.';
  renderProducts(); updateCounts(); updateHeroSlider();
  if ($('#cart-dialog').open) renderCart();
  if ($('#product-dialog').open && selectedProductId) renderProductDetail(selectedProductId);
  if ($('#request-dialog').open) { updateRequestHeading(); if (!$('#request-result').hidden) prepareRequestText(); }
  if ($('#content-dialog').open && contentKind) renderContent(contentKind);
  decorateBrandSelects();
}

function productCard(p) {
  const favorite = favorites.includes(p.id);
  return `<article class="product-card"><div class="product-image-wrap"><button class="product-image-link" data-product="${escapeHtml(p.id)}" aria-label="${escapeHtml(productName(p))} — ${escapeHtml(t('detail'))}"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(productName(p))} · ${escapeHtml(t('imageConcept'))}" loading="lazy" width="1122" height="1402"></button><button class="favorite-button ${favorite ? 'selected' : ''}" data-favorite="${escapeHtml(p.id)}" aria-label="${escapeHtml(t(favorite ? 'removeFavorite' : 'addFavorite'))}" aria-pressed="${favorite}">${icon('heart')}</button><span class="product-badge">${escapeHtml(p.stock === 0 ? t('outOfStock') : isConcept(p) ? t('cardConcept') : statusText(p))}</span></div><div class="product-info"><div><button class="product-name" data-product="${escapeHtml(p.id)}">${escapeHtml(productName(p))}</button><p>${escapeHtml(isConcept(p) ? t('modelName') : statusText(p))}</p></div><span class="product-price">${escapeHtml(formatPrice(p))}</span></div><div class="product-bottom"><span class="swatch" style="background:${paletteColors[p.palette] || '#dfd4ca'}" aria-label="${escapeHtml(t(p.palette))}"></span><button class="text-button" data-product="${escapeHtml(p.id)}">${escapeHtml(t('detail'))} <span class="brand-key" aria-hidden="true"></span></button></div></article>`;
}
function renderProducts() {
  const search = $('#search').value.trim().toLocaleLowerCase(lang);
  const color = $('#filter-color').value, size = $('#filter-size').value, collection = $('#filter-collection').value;
  const minimum = $('#price-min').value, maximum = $('#price-max').value;
  let result = products.filter(p => {
    const text = `${productName(p)} ${p.description?.[lang] || ''} ${t(p.palette)}`.toLocaleLowerCase(lang);
    return (category === 'all' || p.palette === category) && (!favoriteView || favorites.includes(p.id)) && (!search || text.includes(search)) && (color === 'all' || p.palette === color) && (collection === 'all' || p.collection === collection) && (size === 'all' || (size === 'unknown' ? !p.sizes.length : p.sizes.includes(size))) && (minimum === '' || (Number.isFinite(p.price) && p.price >= Number(minimum))) && (maximum === '' || (Number.isFinite(p.price) && p.price <= Number(maximum)));
  });
  if ($('#sort').value !== 'default') {
    const direction = $('#sort').value === 'asc' ? 1 : -1;
    result.sort((a,b) => Number.isFinite(a.price) && Number.isFinite(b.price) ? direction * (a.price - b.price) : Number.isFinite(a.price) ? -1 : Number.isFinite(b.price) ? 1 : 0);
  }
  $('#product-grid').innerHTML = result.length ? result.map(productCard).join('') : `<div class="empty-state"><h3>${t('noResults')}</h3><p>${t('noResultsText')}</p><button class="button secondary" id="empty-reset">${t('reset')}</button></div>`;
  $('#result-count').textContent = `${result.length} / ${products.length} · ${products.every(isConcept) ? t('catalogCount') : t('productCount')}`;
  $('#active-view').hidden = !favoriteView;
}
function resetFilters() {
  category = 'all'; favoriteView = false;
  ['#filter-size','#filter-color','#filter-collection'].forEach(id => $(id).value = 'all');
  $('#price-min').value = ''; $('#price-max').value = ''; $('#search').value = ''; $('#sort').value = 'default';
  updateTabs(); renderProducts();
}
function updateTabs() { $$('[data-category]').forEach(el => { const active = el.dataset.category === category; el.classList.toggle('active', active); el.setAttribute('aria-pressed', String(active)); }); }
function updateCounts() {
  $('#cart-count').textContent = cart.reduce((sum,line) => sum + line.quantity, 0);
  $('#favorite-count').textContent = favorites.length;
  $('#favorite-count').hidden = !favorites.length;
}
function toggleFavorite(id) {
  favorites = favorites.includes(id) ? favorites.filter(value => value !== id) : [...favorites, id];
  writeLocal('zamelano-favorites', favorites); updateCounts(); renderProducts();
}
let toastTimeout;
function toast(text) { clearTimeout(toastTimeout); $('#toast').textContent = text; $('#toast').hidden = false; toastTimeout = setTimeout(() => $('#toast').hidden = true, 4200); }
function openDialog(id) {
  $$('dialog[open]').forEach(dialog => dialog.close());
  $(id).showModal(); document.body.classList.add('modal-open');
}
function closeDialog(dialog) { dialog.close(); document.body.classList.remove('modal-open'); if (dialog.id === 'request-dialog') clearPersonalData(); }
$$('dialog').forEach(dialog => {
  dialog.addEventListener('close', () => { if (!$('dialog[open]')) document.body.classList.remove('modal-open'); if (dialog.id === 'request-dialog') clearPersonalData(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const b = dialog.getBoundingClientRect(); if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) closeDialog(dialog); } });
});
document.addEventListener('click', event => {
  const close = event.target.closest('[data-close]'); if (close) closeDialog(close.closest('dialog'));
  const productButton = event.target.closest('[data-product]'); if (productButton) { selectedProductId = productButton.dataset.product; renderProductDetail(selectedProductId); openDialog('#product-dialog'); }
  const favoriteButton = event.target.closest('[data-favorite]'); if (favoriteButton) toggleFavorite(favoriteButton.dataset.favorite);
  const articleButton = event.target.closest('[data-article]'); if (articleButton) showContent(`article:${articleButton.dataset.article}`);
  const legalButton = event.target.closest('[data-legal]'); if (legalButton) showContent(`legal:${legalButton.dataset.legal}`);
  if (event.target.closest('#empty-reset')) resetFilters();
});
function renderProductDetail(id) {
  const p = products.find(item => item.id === id); if (!p) return;
  const sizeOptions = p.sizes.length ? p.sizes.map(size => `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`).join('') : `<option value="unknown">${t('fill')}</option>`;
  const colorOptions = p.colors.length ? p.colors.map(color => `<option value="${escapeHtml(color)}">${escapeHtml(color)}</option>`).join('') : `<option value="unknown">${t('fill')}</option>`;
  $('#product-detail').innerHTML = `<div class="product-detail-grid"><img class="detail-image" src="${escapeHtml(p.image)}" alt="${escapeHtml(productName(p))} · ${escapeHtml(t('imageConcept'))}"><div class="detail-copy"><p class="eyebrow">${escapeHtml(isConcept(p) ? t('productEyebrow') : p.collection)}</p><h2 id="detail-title">${escapeHtml(productName(p))}</h2><p>${escapeHtml(p.description?.[lang] || t('fill'))}</p><p class="detail-price">${escapeHtml(formatPrice(p))}</p><p>${escapeHtml(statusText(p))}</p><div class="detail-fields"><label><span>${t('size')}</span><select id="detail-size">${sizeOptions}</select></label><label><span>${t('color')}</span><select id="detail-color">${colorOptions}</select></label></div><button class="text-button" id="detail-size-help" data-brand-key>${t('openSize')}</button><button class="button primary" id="add-to-cart" ${p.stock === 0 ? 'disabled' : ''}><span>${t('addToCart')}</span><span>+</span></button><a class="underlined-link" href="https://t.me/Zamelano" target="_blank" rel="noopener" data-brand-key>${t('askAvailability')}</a><p class="detail-note">${t('productNote')}</p></div></div>`;
  $('#add-to-cart').addEventListener('click', () => addToCart(p.id, $('#detail-size').value, $('#detail-color').value));
  $('#detail-size-help').addEventListener('click', () => showContent('size'));
  decorateBrandSelects($('#product-detail'));
}
function addToCart(id, size, color) {
  const p = products.find(item => item.id === id); if (!p || p.stock === 0) return;
  const existing = cart.find(line => line.id === id && line.size === size && line.color === color);
  if (existing) existing.quantity = Math.min(existing.quantity + 1, 999, Number.isInteger(p.stock) ? p.stock : 999);
  else cart.push({id,size,color,quantity:1});
  writeLocal('zamelano-cart', cart); updateCounts(); toast(t('added')); closeDialog($('#product-dialog')); renderCart(); openDialog('#cart-dialog');
}
function renderCart() {
  cart = cart.filter(line => products.some(p => p.id === line.id));
  updateCounts();
  if (!cart.length) { $('#cart-content').innerHTML = `<div class="cart-empty">${icon('bag')}<h3>${t('cartEmpty')}</h3><p>${t('cartEmptyText')}</p><button class="button primary" id="cart-explore" data-brand-key>${t('explore')}</button></div>`; $('#cart-explore').addEventListener('click', () => { closeDialog($('#cart-dialog')); $('#catalog').scrollIntoView(); }); return; }
  const lines = cart.map((line, index) => {
    const p = products.find(item => item.id === line.id);
    return `<article class="cart-line"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(productName(p))}"><div><h3>${escapeHtml(productName(p))}</h3><p>${t('size')}: ${escapeHtml(line.size === 'unknown' ? t('fill') : line.size)} · ${t('color')}: ${escapeHtml(line.color === 'unknown' ? t('fill') : line.color)}</p><p>${escapeHtml(formatPrice(p))} · ${escapeHtml(statusText(p))}</p><div class="cart-line-bottom"><div class="quantity-control"><button data-quantity="${index}" data-change="-1" aria-label="${t('decrease')}">−</button><span>${line.quantity}</span><button data-quantity="${index}" data-change="1" aria-label="${t('increase')}" ${line.quantity >= 999 || (Number.isInteger(p.stock) && line.quantity >= p.stock) ? 'disabled' : ''}>+</button></div><button class="remove-item" data-remove="${index}">${t('remove')}</button></div></div></article>`;
  }).join('');
  const priceKnown = cart.every(line => Number.isFinite(products.find(p => p.id === line.id).price));
  const sum = cart.reduce((total,line) => total + (products.find(p => p.id === line.id).price ?? 0) * line.quantity, 0);
  const total = priceKnown ? formatPrice({price:sum}) : t('pendingTotal');
  $('#cart-content').innerHTML = `${lines}<div class="cart-summary"><div class="cart-total"><span>${t('total')}</span><span>${escapeHtml(total)}</span></div><p>${t('deliverySummary')}</p><p class="notice">${t('cartDisclaimer')}</p><button class="button primary" id="checkout"><span>${t('prepareOrder')}</span><span class="brand-key" aria-hidden="true"></span></button><p class="micro">${t('paymentMethods')}</p></div>`;
  $$('[data-quantity]', $('#cart-content')).forEach(button => button.addEventListener('click', () => {
    const i = Number(button.dataset.quantity), change = Number(button.dataset.change); if (!cart[i]) return;
    cart[i].quantity += change; if (cart[i].quantity <= 0) cart.splice(i,1);
    writeLocal('zamelano-cart',cart); renderCart();
  }));
  $$('[data-remove]', $('#cart-content')).forEach(button => button.addEventListener('click', () => { cart.splice(Number(button.dataset.remove),1); writeLocal('zamelano-cart', cart); renderCart(); }));
  $('#checkout').addEventListener('click', () => openRequest('order'));
}
function updateRequestHeading() {
  $('#request-title').textContent = t(requestKind === 'order' ? 'orderTitle' : requestKind === 'wholesale' ? 'wholesaleRequestTitle' : 'contactTitle');
  $('#request-description').textContent = t(requestKind === 'order' ? 'orderDescription' : requestKind === 'wholesale' ? 'wholesaleDescription' : 'contactDescription');
}
function clearPersonalData() {
  $('#request-form').reset(); $('#request-text').value = ''; $('#telegram-request').href = 'https://t.me/Zamelano';
}
function openRequest(kind) {
  requestKind = kind; clearPersonalData(); updateRequestHeading();
  $('#quantity-label').hidden = kind !== 'wholesale';
  $('#quantity-label input').required = kind === 'wholesale';
  $('#quantity-label input').disabled = kind !== 'wholesale';
  $('#delivery-label').hidden = kind !== 'order'; $('#address-label').hidden = kind !== 'order';
  $('#address-label input').required = kind === 'order';
  $('#address-label input').disabled = kind !== 'order';
  $('#request-form').hidden = false; $('#request-result').hidden = true;
  openDialog('#request-dialog');
}
function prepareRequestText() {
  const form = new FormData($('#request-form'));
  const lines = [t('requestHeader'),`${t('requestType')}: ${t(requestKind === 'order' ? 'orderType' : requestKind === 'wholesale' ? 'wholesaleType' : 'contactType')}`,'',`${t('name')}: ${String(form.get('name') || '').trim()}`,`${t('phone')}: ${String(form.get('phone') || '').trim()}`,`${t('time')}: ${form.get('time') || t('fill')}`];
  if (requestKind === 'wholesale') lines.push(`${t('wholesaleQuantity')}: ${form.get('quantity')}`);
  if (requestKind === 'order') {
    lines.push(`${t('region')}: ${t(form.get('region') === 'mo' ? 'mo' : 'moscow')}`,`${t('address')}: ${form.get('address')}`,'',`${t('orderItems')}:`);
    cart.forEach(line => { const p = products.find(item => item.id === line.id); if (p) lines.push(`• ${productName(p)} [${p.id}], ${line.quantity} ${t('qty')}; ${t('size')}: ${line.size === 'unknown' ? t('fill') : line.size}; ${t('color')}: ${line.color === 'unknown' ? t('fill') : line.color}; ${formatPrice(p)}`); });
    lines.push('',t('orderWarning'));
  }
  lines.push('',`${t('comment')}: ${form.get('comment') || t('fill')}`);
  const text = lines.join('\n');
  $('#request-text').value = text;
  $('#telegram-request').href = `https://t.me/Zamelano?text=${encodeURIComponent(text)}`;
}
$('#request-form').addEventListener('submit', event => {
  event.preventDefault();
  const name = $('#request-form [name="name"]'), phone = $('#request-form [name="phone"]');
  name.setCustomValidity(name.value.trim() ? '' : t('invalidName'));
  const digits = phone.value.replace(/\D/g,''); phone.setCustomValidity(digits.length >= 10 && digits.length <= 15 ? '' : t('invalidPhone'));
  if (!$('#request-form').reportValidity()) return;
  prepareRequestText(); $('#request-form').hidden = true; $('#request-result').hidden = false;
  $('#request-dialog').scrollTop = 0; $('#copy-request').focus();
});
$$('#request-form input').forEach(input => input.addEventListener('input', () => input.setCustomValidity('')));
$('#copy-request').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#request-text').value); toast(t('copied')); }
  catch { $('#request-text').focus(); $('#request-text').select(); toast(t('copyFallback')); }
});
$('#edit-request').addEventListener('click', () => { $('#request-form').hidden = false; $('#request-result').hidden = true; });

const articles = {
  fit:{ru:{title:'Как найти своё бельё',paragraphs:['Хороший выбор начинается с вопроса: какое ощущение вы ищете? Для спокойного дня, нарядного вечера или просто для себя — сценарий помогает сформулировать предпочтения.','Перед заказом проверьте размерную сетку конкретной модели, состав ткани и рекомендации производителя. Размер, цвет, посадку и наличие будущих моделей ZAMELANO предстоит уточнить — [заполнить].','Не ориентируйтесь только на картинку. Если нужны подробности о товаре, задайте бренду вопрос в Telegram.']},en:{title:'Finding your lingerie',paragraphs:['A thoughtful choice starts with a question: how would you like to feel? A quiet day, an evening out, or simply something for yourself — the occasion can help you understand your preferences.','Before ordering, check the specific model’s size chart, fabric composition and manufacturer’s recommendations. Sizes, colours, fit and availability of future ZAMELANO models still need to be confirmed — [fill in].','A photograph is only part of the picture. If you need more product details, ask the brand on Telegram.']}},
  care:{ru:{title:'Искусство бережного ухода',paragraphs:['Первый ориентир — этикетка изделия и рекомендации производителя. Температура, способ стирки и сушки зависят от материала; универсальных условий для всего белья здесь нет.','Перед стиркой обратите внимание на застёжки, кружево и декоративные элементы. Выбирайте режим ухода по инструкции конкретного изделия.','Для каждой модели ZAMELANO рекомендации производителя будут добавлены в карточку товара — [заполнить].']},en:{title:'The art of gentle care',paragraphs:['Start with the garment label and the manufacturer’s instructions. Washing temperature, method and drying depend on the material; there is no single care routine for all lingerie.','Before washing, pay attention to fastenings, lace and decorative details. Follow the care instructions for the particular item.','Manufacturer’s care instructions will be added to each ZAMELANO product page — [fill in].']}},
  news:{ru:{title:'Новая глава ZAMELANO',paragraphs:['Мы знакомим вас с концепцией онлайн-бутика ZAMELANO. Персиковая палитра, мягкий свет и лаконичная типографика передают настроение будущего сайта.','Изображения в концепции созданы с помощью ИИ. Реальные фотографии, ассортимент, цены и описание коллекции — [заполнить].','Дата публикации новости и материалы бренда — [заполнить]. За подробностями можно обратиться в Telegram @Zamelano.']},en:{title:'A new chapter for ZAMELANO',paragraphs:['Introducing the concept for the ZAMELANO online boutique. A peach palette, soft light and understated typography set the mood for the future website.','Concept images were created with AI. Actual photographs, range, prices and collection details — [fill in].','News publication date and brand materials — [fill in]. For details, contact @Zamelano on Telegram.']}}
};
function showContent(kind) { contentKind = kind; renderContent(kind); openDialog('#content-dialog'); }
function renderContent(kind) {
  let html = '';
  if (kind === 'size') {
    html = `<p class="eyebrow">ZAMELANO</p><h2>${t('sizeGuideTitle')}</h2><p>${t('sizeGuideText')}</p><ol><li>${t('sizeGuideStep1')}</li><li>${t('sizeGuideStep2')}</li><li>${t('sizeGuideStep3')}</li></ol><a class="underlined-link" href="https://t.me/Zamelano" target="_blank" rel="noopener" data-brand-key>${t('askTelegram')}</a>`;
  } else if (kind.startsWith('article:')) {
    const article = articles[kind.split(':')[1]]?.[lang]; if (!article) return;
    html = `<p class="eyebrow">${t('journal')}</p><h2>${escapeHtml(article.title)}</h2><p class="notice">${t('articleDraft')}</p>${article.paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('')}<a class="underlined-link" href="https://t.me/Zamelano" target="_blank" rel="noopener" data-brand-key>${t('askTelegram')}</a>`;
  } else if (kind === 'legal:details') {
    const values = [['legalDetails',t('individual')],['taxId',t('fill')],['registrationId',t('fill')],['legalAddressLabel',t('legalAddress')],['entrepreneurPhone',t('fill')],['entrepreneurEmail',t('fill')],['account',t('fill')],['correspondent',t('fill')],['bic',t('fill')],['bank',t('bankName')],['taxSystem',t('taxName')]];
    html = `<p class="eyebrow">ZAMELANO</p><h2>${t('legalDetails')}</h2><dl>${values.map(([key,value]) => `<dt>${t(key)}</dt><dd>${escapeHtml(value)}</dd>`).join('')}</dl><p class="notice">${t('legalAddressNote')}</p>`;
  } else {
    const key = kind.split(':')[1]; const body = key === 'privacy' ? 'privacyText' : key === 'returns' ? 'returnText' : 'offerText';
    html = `<p class="eyebrow">ZAMELANO</p><h2>${t(key)}</h2><p class="notice">${t('legalPending')}</p><p>${t(body)}</p><a class="underlined-link" href="https://t.me/Zamelano" target="_blank" rel="noopener" data-brand-key>${t('askTelegram')}</a>`;
  }
  $('#content-body').innerHTML = html.replace('<h2>', '<h2 id="content-title">');
}

$('#language').addEventListener('click', () => { lang = lang === 'ru' ? 'en' : 'ru'; writeLocal('zamelano-language',lang); translatePage(); });
$('#cart-open').addEventListener('click', () => { renderCart(); openDialog('#cart-dialog'); });
$('#favorites-open').addEventListener('click', () => { resetFilters(); favoriteView = true; renderProducts(); $('#catalog').scrollIntoView(); });
$('#show-all').addEventListener('click', () => { favoriteView = false; renderProducts(); });
$('#search-open').addEventListener('click', () => { $('#search-inline').hidden = false; $('#catalog').scrollIntoView(); $('#search').focus({preventScroll:true}); });
$('#search-close').addEventListener('click', () => { $('#search-inline').hidden = true; $('#search').value = ''; renderProducts(); });
$('#search').addEventListener('input',renderProducts);
$('#filter-toggle').addEventListener('click', () => { const hidden = !$('#filter-panel').hidden; $('#filter-panel').hidden = hidden; $('#filter-toggle').setAttribute('aria-expanded', String(!hidden)); });
$$('[data-category]').forEach(button => button.addEventListener('click', () => { category = button.dataset.category; updateTabs(); renderProducts(); }));
['#filter-size','#filter-color','#filter-collection','#price-min','#price-max'].forEach(id => $(id).addEventListener('input',renderProducts));
$('#sort').addEventListener('change', () => { renderProducts(); if (products.every(p => !Number.isFinite(p.price)) && $('#sort').value !== 'default') toast(t('sortNotice')); });
$('#reset-filters').addEventListener('click',resetFilters);
$('#wholesale-open').addEventListener('click', () => openRequest('wholesale'));
$('#contact-open').addEventListener('click', () => openRequest('contact'));
$('#size-help').addEventListener('click', () => showContent('size'));
$('#menu-open').addEventListener('click', () => openDialog('#menu-dialog'));
$$('#menu-dialog nav a').forEach(a => a.addEventListener('click', () => closeDialog($('#menu-dialog'))));

async function loadCatalog() {
  try {
    const response = await fetch('catalog.json'); if (!response.ok) throw new Error('Catalogue fetch failed');
    const data = await response.json();
    if (!Array.isArray(data.products)) throw new Error('Invalid catalogue');
    products = data.products.filter(p => p && typeof p.id === 'string' && typeof p.name?.ru === 'string' && typeof p.image === 'string' && /^assets\/[\w.-]+$/.test(p.image) && Array.isArray(p.sizes) && Array.isArray(p.colors));
    cart = cart.filter(line => products.some(p => p.id === line.id)); favorites = favorites.filter(id => products.some(p => p.id === id));
    writeLocal('zamelano-cart',cart); writeLocal('zamelano-favorites',favorites); translatePage();
  } catch {
    translatePage();
    $('#product-grid').innerHTML = `<div class="empty-state"><h3>${t('connectionError')}</h3><p>${t('connectionErrorText')}</p><button class="button secondary" id="reload-catalog">${t('reload')}</button></div>`;
    $('#reload-catalog').addEventListener('click', loadCatalog);
  }
}
translatePage(); loadCatalog();
