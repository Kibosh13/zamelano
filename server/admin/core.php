<?php
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(404); exit; }
ini_set('display_errors', '0');
const CMS_VERSION = '1.0.0';
class CmsError extends RuntimeException { public function __construct(string $message, public int $status = 400) { parent::__construct($message); } }
function cms_fail(string $message, int $status = 400): never { throw new CmsError($message, $status); }
function cms_root(): string { return dirname(__DIR__); }
function cms_storage(): string {
    static $root;
    if (isset($root)) return $root;
    $root = getenv('ZAMELANO_STORAGE') ?: dirname(__DIR__, 3).'/data/zamelano-cms';
    if (!is_dir($root) && !mkdir($root, 0700, true) && !is_dir($root)) cms_fail('Хранилище временно недоступно.', 503);
    $root = realpath($root) ?: $root;
    $web = realpath(cms_root());
    if ($web && str_starts_with($root.'/', $web.'/')) cms_fail('Хранилище должно находиться вне каталога сайта.', 503);
    foreach (['media','versions','sessions'] as $name) if (!is_dir($root.'/'.$name)) mkdir($root.'/'.$name, 0700, true);
    return $root;
}
function cms_json_file(string $path): array {
    $raw = file_get_contents($path);
    if ($raw === false) cms_fail('Не удалось прочитать данные.', 503);
    $value = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
    if (!is_array($value)) cms_fail('Повреждён формат данных.', 503);
    return $value;
}
function cms_atomic(string $path, string $bytes): void {
    $temp = tempnam(dirname($path), '.write-');
    if ($temp === false || file_put_contents($temp, $bytes) !== strlen($bytes)) cms_fail('Не удалось сохранить изменения.', 503);
    chmod($temp, 0600);
    if (!rename($temp, $path)) { @unlink($temp); cms_fail('Не удалось завершить сохранение.', 503); }
}
function cms_encode(mixed $value): string { return json_encode($value, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR); }
function cms_seed(): array {
    $root = cms_root();
    $payload = ['content'=>cms_json_file($root.'/site-content.json'), 'catalog'=>cms_json_file($root.'/catalog.json'), 'documents'=>cms_json_file($root.'/legal-documents.json'), 'links'=>cms_json_file($root.'/document-links.json')];
    foreach ($payload['catalog']['products'] as $i=>&$product) {
        $product['category'] = $product['palette'] ?? $product['category'];
        $product['status'] = 'published'; $product['concept'] = str_starts_with($product['id'], 'concept-');
        $product['images'] = [$product['image']]; $product['sku'] = ''; $product['sort'] = $i;
    }
    unset($product);
    return $payload;
}
function cms_db(callable $callback, bool $write = false): mixed {
    $root = cms_storage(); $handle = fopen($root.'/state.lock', 'c');
    if ($handle === false || !flock($handle, LOCK_EX)) cms_fail('Хранилище занято. Повторите попытку.', 503);
    chmod($root.'/state.lock', 0600);
    try {
        $path = $root.'/state.json'; $fresh = !is_file($path);
        if ($fresh) { $seed = cms_seed(); $state = ['schemaVersion'=>1,'revision'=>1,'publishedRevision'=>1,'draft'=>$seed,'published'=>$seed,'users'=>[],'media'=>[],'history'=>[],'audit'=>[],'attempts'=>[],'publishedAt'=>gmdate('c')]; }
        else $state = cms_json_file($path);
        $result = $callback($state);
        if ($write || $fresh) cms_atomic($path, cms_encode($state));
        return $result;
    } finally { flock($handle, LOCK_UN); fclose($handle); }
}
function cms_audit(array &$state, string $action, string $detail = ''): void {
    $state['audit'][] = ['at'=>gmdate('c'),'user'=>$_SESSION['login'] ?? 'система','action'=>$action,'detail'=>mb_substr($detail,0,200)];
    $state['audit'] = array_slice($state['audit'], -200);
}
function cms_snapshot(array &$state, string $label, ?array $payload = null): void {
    $id = bin2hex(random_bytes(12));
    cms_atomic(cms_storage().'/versions/'.$id.'.json', cms_encode($payload ?? $state['draft']));
    $state['history'][] = ['id'=>$id,'at'=>gmdate('c'),'label'=>$label,'revision'=>$state['revision'],'user'=>$_SESSION['login'] ?? 'система'];
    if (count($state['history']) > 50) { $old = array_shift($state['history']); @unlink(cms_storage().'/versions/'.$old['id'].'.json'); }
}
function cms_https(): bool { return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (int)($_SERVER['SERVER_PORT'] ?? 0) === 443; }
function cms_dev(): bool { return getenv('ZAMELANO_DEV') === '1' && in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1','::1'], true); }
function cms_headers(bool $admin = false): void {
    header('X-Content-Type-Options: nosniff'); header('Referrer-Policy: same-origin');
    if ($admin) {
        header('Cache-Control: no-store'); header('X-Robots-Tag: noindex, nofollow, noarchive'); header('X-Frame-Options: DENY');
        header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    }
}
function cms_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    ini_set('session.use_strict_mode','1'); ini_set('session.use_only_cookies','1'); ini_set('session.gc_maxlifetime','28800');
    session_name('ZAMELANO_ADMIN'); session_save_path(cms_storage().'/sessions');
    session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>cms_https(),'httponly'=>true,'samesite'=>'Strict']);
    session_start();
}
function cms_user(): ?array {
    cms_session();
    if (empty($_SESSION['userId'])) return null;
    if (time() - ($_SESSION['lastSeen'] ?? 0) > 1800 || time() - ($_SESSION['started'] ?? 0) > 28800) { $_SESSION = []; return null; }
    $user = cms_db(fn(array &$state) => $state['users'][$_SESSION['userId']] ?? null);
    if (!$user || ($user['sessionVersion'] ?? 0) !== ($_SESSION['sessionVersion'] ?? -1)) { $_SESSION=[]; return null; }
    $_SESSION['lastSeen'] = time();
    return ['id'=>$user['id'],'login'=>$user['login'],'name'=>$user['name']];
}
function cms_login_session(array $user): void {
    cms_session(); session_regenerate_id(true);
    $_SESSION = ['userId'=>$user['id'],'login'=>$user['login'],'sessionVersion'=>$user['sessionVersion'],'lastSeen'=>time(),'started'=>time(),'csrf'=>bin2hex(random_bytes(32))];
}
function cms_csrf(): string { cms_session(); return $_SESSION['csrf'] ??= bin2hex(random_bytes(32)); }
function cms_require_user(): array { $user = cms_user(); if (!$user) cms_fail('Войдите в панель управления.',401); return $user; }
function cms_post(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') cms_fail('Метод не поддерживается.',405);
    if (!cms_https() && !cms_dev()) cms_fail('Для работы админки требуется HTTPS.',403);
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        $parts = parse_url($origin); $originHost = strtolower(($parts['host'] ?? '').(isset($parts['port'])?':'.$parts['port']:''));
        if ($originHost !== strtolower($_SERVER['HTTP_HOST'] ?? '') || ($parts['scheme'] ?? '') !== (cms_https()?'https':'http')) cms_fail('Запрос отправлен с другого сайта.',403);
    }
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($token) || !hash_equals(cms_csrf(),$token)) cms_fail('Сессия устарела. Обновите страницу.',403);
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 18*1024*1024) cms_fail('Слишком большой запрос.',413);
}
function cms_body(): array {
    if (!str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) cms_fail('Ожидается JSON.',415);
    $raw = file_get_contents('php://input', false, null, 0, 5*1024*1024);
    try { $body=json_decode($raw ?: '{}',true,40,JSON_THROW_ON_ERROR); } catch (Throwable) { cms_fail('Не удалось прочитать запрос.'); }
    if (!is_array($body)) cms_fail('Неверный формат запроса.');
    return $body;
}
function cms_setup_config(): ?array {
    $path = cms_storage().'/owner-setup.json';
    if (!is_file($path)) return null;
    $config = cms_json_file($path);
    if (!isset($config['tokenHash'],$config['expiresAt']) || strtotime($config['expiresAt']) < time()) return null;
    return $config;
}
function cms_password(string $password): void {
    if (mb_strlen($password) < 12 || strlen($password) > 128) cms_fail('Пароль должен содержать от 12 до 128 символов.');
}
function cms_login_name(string $value): string {
    $login = strtolower(trim($value));
    if (!preg_match('/^[a-z0-9][a-z0-9@._+-]{2,79}$/D',$login)) cms_fail('Логин: от 3 до 80 латинских букв, цифр или символов @ . _ + -.');
    return $login;
}
function cms_markup(string $text): string { return preg_replace('/<(\/?)(br|em|strong)\b[^>]*>/i','<$1$2>',strip_tags($text,'<br><em><strong>')) ?? ''; }
function cms_text(mixed $text, int $max = 20000): string {
    if (!is_string($text) || mb_strlen($text) > $max) cms_fail('Проверьте длину текстовых полей.');
    return $text;
}
function cms_url(mixed $value, bool $image = false): ?string {
    if ($value === null || $value === '') return null;
    $value = trim(cms_text($value,2000));
    if (preg_match('/[\x00-\x20\x7f]/',$value)) cms_fail('В адресе ссылки есть недопустимые символы.');
    if (preg_match('~^https?://~i',$value)) { if (!filter_var($value,FILTER_VALIDATE_URL)) cms_fail('Проверьте адрес ссылки.'); return $value; }
    if (preg_match('~^assets/[a-zA-Z0-9._-]+$~D',$value) || preg_match('~^media\.php\?id=[a-f0-9]{32}$~D',$value)) return $value;
    if (!$image && (preg_match('~^#[a-zA-Z0-9_-]+$~D',$value) || preg_match('~^documents\.(?:html|php)(?:\?section=[a-zA-Z0-9_-]+)?(?:#[a-zA-Z0-9_-]+)?$~D',$value) || preg_match('~^(?:mailto:|tel:)[^<>"\x00-\x20]+$~D',$value))) return $value;
    cms_fail('Допустимы ссылки https://, http:// и файлы из медиатеки.');
}
function cms_pair(mixed $value, int $max = 20000): array {
    if (!is_array($value)) cms_fail('Укажите тексты на русском и английском языках.');
    return ['ru'=>cms_text($value['ru'] ?? '',$max),'en'=>cms_text($value['en'] ?? '',$max)];
}
function cms_payload(mixed $payload): array {
    if (!is_array($payload)) cms_fail('Неверный формат содержимого.');
    foreach (['content','catalog','documents','links'] as $key) if (!isset($payload[$key]) || !is_array($payload[$key])) cms_fail('В резервной копии отсутствует раздел '.$key.'.');
    if (strlen(cms_encode($payload)) > 4*1024*1024) cms_fail('Содержимое превышает 4 МБ.');
    $nodes=0;
    $walk = function(mixed $item,int $depth=0) use (&$walk,&$nodes): void {
        if (++$nodes>80000 || $depth>24) cms_fail('Слишком сложная структура данных.');
        if (is_array($item)) foreach ($item as $k=>$v) { if (in_array((string)$k,['__proto__','prototype','constructor'],true)) cms_fail('Недопустимое имя поля.'); $walk($v,$depth+1); }
        elseif (is_string($item) && strlen($item)>300000) cms_fail('Слишком длинное поле.');
        elseif (!(is_string($item)||is_int($item)||is_float($item)||is_bool($item)||$item===null)) cms_fail('Недопустимый тип данных.');
    }; $walk($payload);
    $content=&$payload['content'];
    foreach (['settings','translations','images','slides','sections','categories','faq','articles','reviews','menus'] as $key) if (!isset($content[$key]) || !is_array($content[$key])) cms_fail('Отсутствует раздел содержимого: '.$key.'.');
    if (!is_array($payload['links']['files'] ?? null)) cms_fail('Проверьте ссылки документов.');
    foreach (['ru','en'] as $language) {
        if (!is_array($content['translations'][$language] ?? null)) cms_fail('Отсутствует перевод.');
        foreach ($content['translations'][$language] as $key=>&$value) {
            if (!preg_match('/^[a-zA-Z0-9:_-]{1,100}$/D',(string)$key)) cms_fail('Недопустимый ключ перевода.');
            $value=cms_text($value);
            $value=preg_match('/^(heroTitle|brandTitle|wholesaleTitle)/',$key)?cms_markup($value):strip_tags($value);
        } unset($value);
    }
    if (!is_array($content['legalUI'] ?? null)) cms_fail('Отсутствуют тексты документов и cookie.');
    foreach (['ru','en'] as $language) {
        if (!is_array($content['legalUI'][$language] ?? null)) cms_fail('Отсутствует перевод уведомления.');
        foreach ($content['legalUI'][$language] as &$value) $value=strip_tags(cms_text($value));
        unset($value);
    }
    foreach (['slides'=>12,'sections'=>60,'categories'=>100,'faq'=>100,'articles'=>500,'reviews'=>500] as $key=>$limit) if (count($content[$key])>$limit) cms_fail('Слишком много элементов в разделе '.$key.'.');
    foreach ($content['categories'] as &$category) {
        if (!preg_match('/^[a-zA-Z0-9_-]{1,80}$/D',$category['id'] ?? '')) cms_fail('Проверьте адрес категории.');
        $category['title']=cms_pair($category['title'] ?? [],500); $category['visible']=($category['visible'] ?? true)!==false;
    } unset($category);
    foreach ($content['faq'] as &$row) { $row['question']=cms_pair($row['question'] ?? [],2000); $row['answer']=cms_pair($row['answer'] ?? []); } unset($row);
    $settings=&$content['settings'];
    $settings['title']=cms_pair($settings['title'] ?? [],250); $settings['description']=cms_pair($settings['description'] ?? [],1000);
    $settings['copyright']=cms_pair($settings['copyright'] ?? ['ru'=>'© 2026 ZAMELANO','en'=>'© 2026 ZAMELANO'],500);
    $settings['cookieNoticeVersion']=cms_text($settings['cookieNoticeVersion'] ?? 'technical-1',100);
    foreach (['heroCatalog','heroBrand'] as $key) $settings['actionLinks'][$key]=cms_url($settings['actionLinks'][$key] ?? '#catalog');
    $settings['name']=cms_text($settings['name'] ?? 'ZAMELANO',120);
    $settings['headerLogo']=cms_url($settings['headerLogo'] ?? null,true); $settings['favicon']=cms_url($settings['favicon'] ?? 'assets/favicon.svg',true);
    foreach (['telegram','instagram'] as $key) $settings['contacts'][$key]=cms_url($settings['contacts'][$key] ?? null);
    $settings['contacts']['phone']=cms_text($settings['contacts']['phone'] ?? '',100);
    if (count($settings['contacts']['emails'] ?? [])>10) cms_fail('Слишком много адресов почты.');
    foreach ($settings['contacts']['emails'] as $email) if (!filter_var($email,FILTER_VALIDATE_EMAIL)) cms_fail('Проверьте адрес электронной почты.');
    foreach (['paper','peach','peachLight','ink','muted','gold','line'] as $key) if (!preg_match('/^#[a-f0-9]{6}$/iD',$settings['theme'][$key] ?? '')) cms_fail('Проверьте цвета оформления.');
    foreach (['serif','sans'] as $key) if (!in_array($settings['theme'][$key] ?? '',['Georgia','Times New Roman','Palatino Linotype','Arial','Helvetica','Verdana','Trebuchet MS'],true)) cms_fail('Выберите шрифт из списка.');
    if (($settings['theme']['radius'] ?? null)!==null && (!is_numeric($settings['theme']['radius']) || $settings['theme']['radius']<0 || $settings['theme']['radius']>80)) cms_fail('Скругление: от 0 до 80 пикселей.');
    $settings['indexing']=(bool)($settings['indexing'] ?? true);
    if (!in_array($settings['catalogMode'] ?? '',['concept','live'],true)) cms_fail('Проверьте режим каталога.');
    foreach ($content['images'] as &$image) { $image['src']=cms_url($image['src'] ?? null,true); $image['alt']=cms_pair($image['alt'] ?? [],2000); } unset($image);
    foreach ($content['slides'] as &$slide) { $slide['title']=cms_pair($slide['title'] ?? []); foreach ($slide['title'] as &$title) $title=cms_markup($title); unset($title); $slide['description']=cms_pair($slide['description'] ?? []); } unset($slide);
    if (empty($content['slides']) || count($content['slides'])>12) cms_fail('Нужно от 1 до 12 слайдов.');
    foreach (['header','footer'] as $menu) {
        if (!is_array($content['menus'][$menu] ?? null) || count($content['menus'][$menu])>50) cms_fail('Проверьте меню сайта.');
        foreach ($content['menus'][$menu] as &$row) {
            if ($menu==='footer') { $row['title']=cms_pair($row['title'] ?? [],200); foreach ($row['items'] as &$item) { $item['label']=cms_pair($item['label'] ?? [],300); $item['href']=cms_url($item['href'] ?? '#catalog'); } unset($item); }
            else { $row['label']=cms_pair($row['label'] ?? [],300); $row['href']=cms_url($row['href'] ?? '#catalog'); }
        } unset($row);
    }
    foreach ($content['articles'] as &$article) { $article['title']=cms_pair($article['title'] ?? []); $article['tag']=cms_pair($article['tag'] ?? [],200); $article['image']=cms_url($article['image'] ?? null,true); foreach (['ru','en'] as $l) { if (!is_array($article['paragraphs'][$l] ?? null)) cms_fail('Неверный текст статьи.'); foreach ($article['paragraphs'][$l] as $p) cms_text($p); } } unset($article);
    $ids=[];
    foreach ($content['sections'] as &$section) {
        if (!preg_match('/^[a-zA-Z0-9_-]{1,80}$/D',$section['id'] ?? '') || isset($ids[$section['id']])) cms_fail('Разделы должны иметь разные названия.');
        $ids[$section['id']]=true;
        if (($section['type'] ?? '')==='text') { $section['heading']=cms_pair($section['heading'] ?? []); $section['text']=cms_pair($section['text'] ?? []); $section['image']=cms_url($section['image'] ?? null,true); $section['button']=cms_pair($section['button'] ?? []); $section['href']=cms_url($section['href'] ?? null); }
    } unset($section);
    foreach ($content['reviews'] as &$review) { $review['name']=cms_text($review['name'] ?? '',250); $review['text']=cms_pair($review['text'] ?? []); $review['image']=cms_url($review['image'] ?? null,true); } unset($review);
    $products=&$payload['catalog']['products'];
    if (!is_array($products) || count($products)>5000) cms_fail('Каталог поддерживает до 5000 товаров.');
    $ids=[];
    foreach ($products as $i=>&$p) {
        if (!preg_match('/^[a-zA-Z0-9_-]{1,100}$/D',$p['id'] ?? '') || isset($ids[$p['id']])) cms_fail('Товары должны иметь разные артикулы системы.');
        $ids[$p['id']]=true; $p['name']=cms_pair($p['name'] ?? [],500); $p['description']=cms_pair($p['description'] ?? []);
        if (trim($p['name']['ru'])==='') cms_fail('Укажите название товара на русском.');
        if (!in_array($p['status'] ?? '',['published','draft','trash'],true)) cms_fail('Проверьте статус товара.');
        foreach (['price','oldPrice'] as $key) { $p[$key]=$p[$key] ?? null; if ($p[$key]!==null && (!is_numeric($p[$key]) || !is_finite((float)$p[$key]) || $p[$key]<0 || $p[$key]>100000000)) cms_fail('Проверьте цену товара.'); if ($p[$key]!==null) $p[$key]=(float)$p[$key]; }
        if (($p['stock'] ?? null)!==null && (filter_var($p['stock'],FILTER_VALIDATE_INT)===false || $p['stock']<0 || $p['stock']>10000000)) cms_fail('Проверьте остаток товара.');
        $p['image']=cms_url($p['image'] ?? 'assets/ivory.webp',true) ?: 'assets/ivory.webp';
        if (!is_array($p['images'] ?? null) || count($p['images'])>20) cms_fail('У товара может быть до 20 фотографий.');
        foreach ($p['images'] as &$url) $url=cms_url($url,true); unset($url);
        foreach (['sizes','colors'] as $key) { if (!is_array($p[$key] ?? null) || count($p[$key])>100) cms_fail('Проверьте размеры и цвета.'); foreach ($p[$key] as $v) cms_text($v,100); }
        foreach (['sku','palette','category','collection'] as $key) $p[$key]=cms_text($p[$key] ?? '',200);
        $p['sort']=$i; $p['concept']=(bool)($p['concept'] ?? false);
    } unset($p);
    $docs=&$payload['documents']['documents'];
    if (!is_array($docs) || count($docs)>100 || !$docs) cms_fail('Нужно от 1 до 100 документов.');
    $ids=[];
    foreach ($docs as &$doc) {
        if (!preg_match('/^[a-z0-9-]{1,80}$/D',$doc['id'] ?? '') || isset($ids[$doc['id']])) cms_fail('Документы должны иметь разные адреса.');
        $ids[$doc['id']]=true; $doc['label']=cms_pair($doc['label'] ?? [],300); $doc['title']=cms_text($doc['title'] ?? '',1000);
        if (!is_array($doc['blocks'] ?? null) || count($doc['blocks'])<2 || count($doc['blocks'])>5000) cms_fail('Проверьте содержимое документа.');
        foreach ($doc['blocks'] as &$block) { if (!in_array($block['type'] ?? '',['paragraph','heading','subheading','list-item','table'],true)) cms_fail('Неизвестный тип блока документа.'); if ($block['type']==='table') { if (!is_array($block['rows'] ?? null)) cms_fail('Проверьте таблицу документа.'); foreach ($block['rows'] as $row) { if (!is_array($row)) cms_fail('Проверьте таблицу.'); foreach ($row as $cell) cms_text($cell,10000); } } else $block['text']=cms_text($block['text'] ?? '',200000); } unset($block);
    } unset($doc);
    foreach ($payload['links']['files'] as &$url) $url=cms_url($url); unset($url);
    $payload['links']['siteUrl']=cms_url($payload['links']['siteUrl'] ?? null);
    return $payload;
}
function cms_public(array $payload, int $revision, bool $preview = false): array {
    $payload['catalog']['products']=array_values(array_filter($payload['catalog']['products'],fn($p)=>($p['status'] ?? 'published')=== 'published' || ($preview && ($p['status'] ?? '')!=='trash')));
    $payload['content']['articles']=array_values(array_filter($payload['content']['articles'] ?? [],fn($p)=>($p['status'] ?? 'published')==='published' || ($preview && ($p['status'] ?? '')!=='trash')));
    $payload['revision']=$revision; $payload['preview']=$preview; $payload['schemaVersion']=1;
    return $payload;
}
function cms_published(bool $preview = false): array {
    if ($preview && !cms_user()) $preview=false;
    return cms_db(fn(array &$s)=>cms_public($s[$preview?'draft':'published'],(int)$s[$preview?'revision':'publishedRevision'],$preview));
}
function cms_response(mixed $value, int $status=200): never { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo cms_encode($value); exit; }
function cms_exception(Throwable $error): never { if (!($error instanceof CmsError)) error_log('ZAMELANO CMS: '.$error->getMessage()); cms_response(['error'=>$error instanceof CmsError?$error->getMessage():'Сервис временно недоступен. Повторите попытку.'],$error instanceof CmsError?$error->status:500); }
