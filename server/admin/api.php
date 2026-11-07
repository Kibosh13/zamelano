<?php
declare(strict_types=1);
require __DIR__.'/core.php';
cms_headers(true);
try {
    $action = $_GET['action'] ?? 'session';
    cms_session();
    if ($action === 'session' && $_SERVER['REQUEST_METHOD']==='GET') {
        $user=cms_user(); $initialized=cms_db(fn(array &$s)=>count($s['users'])>0);
        cms_response(['user'=>$user,'csrf'=>cms_csrf(),'initialized'=>$initialized,'setupAvailable'=>!$initialized && cms_setup_config()!==null,'version'=>CMS_VERSION]);
    }
    if ($action==='login' || $action==='setup') {
        cms_post(); $body=cms_body();
        $result=cms_db(function(array &$s) use($action,$body) {
            $now=time(); $key=hash('sha256',($_SERVER['REMOTE_ADDR'] ?? '').'|'.$action);
            $s['attempts']=array_filter($s['attempts'],fn($row)=>($row['at']??0)>$now-900);
            $limit=$s['attempts'][$key] ?? ['at'=>$now,'count'=>0];
            if ($limit['count']>=8) return ['error'=>'Слишком много попыток. Повторите через 15 минут.','status'=>429];
            $limit['count']++; $s['attempts'][$key]=$limit;
            if ($action==='setup') {
                if ($s['users']) return ['error'=>'Администратор уже создан. Войдите в панель.','status'=>409];
                $config=cms_setup_config(); $token=$body['token'] ?? '';
                if (!$config || !is_string($token) || !hash_equals($config['tokenHash'],hash('sha256',$token))) return ['error'=>'Одноразовая ссылка недействительна или истекла.','status'=>403];
                $login=cms_login_name((string)($body['login'] ?? '')); $password=(string)($body['password'] ?? ''); cms_password($password);
                $id=bin2hex(random_bytes(12)); $user=['id'=>$id,'login'=>$login,'name'=>trim(cms_text($body['name'] ?? 'Администратор',120)) ?: 'Администратор','passwordHash'=>password_hash($password,PASSWORD_DEFAULT),'sessionVersion'=>1];
                $s['users'][$id]=$user; unset($s['attempts'][$key]); cms_audit($s,'Создан доступ владельца',$login); return ['user'=>$user];
            }
            $login=strtolower(trim((string)($body['login'] ?? ''))); $user=null;
            foreach ($s['users'] as $candidate) if ($candidate['login']===$login) $user=$candidate;
            $hash=$user['passwordHash'] ?? password_hash('invalid-'.bin2hex(random_bytes(12)),PASSWORD_DEFAULT);
            if (!password_verify((string)($body['password'] ?? ''),$hash) || !$user) { cms_audit($s,'Неудачная попытка входа'); return ['error'=>'Неверный логин или пароль.','status'=>401]; }
            if (password_needs_rehash($user['passwordHash'],PASSWORD_DEFAULT)) { $user['passwordHash']=password_hash((string)$body['password'],PASSWORD_DEFAULT); $s['users'][$user['id']]=$user; }
            unset($s['attempts'][$key]); cms_audit($s,'Вход в панель',$user['login']); return ['user'=>$user];
        },true);
        if (isset($result['error'])) cms_fail($result['error'],$result['status']);
        if ($action==='setup') @rename(cms_storage().'/owner-setup.json',cms_storage().'/owner-setup.used.json');
        cms_login_session($result['user']); cms_response(['user'=>cms_user(),'csrf'=>cms_csrf()]);
    }
    $user=cms_require_user();
    if ($action==='data' && $_SERVER['REQUEST_METHOD']==='GET') {
        $result=cms_db(fn(array &$s)=>['draft'=>$s['draft'],'revision'=>$s['revision'],'publishedRevision'=>$s['publishedRevision'],'publishedAt'=>$s['publishedAt'],'history'=>array_reverse($s['history']),'audit'=>array_reverse($s['audit']),'media'=>array_values($s['media'])]);
        $result['user']=$user; $result['csrf']=cms_csrf();
        $root=cms_root(); $base=[];
        foreach (glob($root.'/assets/*') ?: [] as $file) if (preg_match('/\.(?:webp|png|jpg|jpeg)$/i',$file)) {
            $dims=@getimagesize($file); $base[]=['id'=>'base-'.basename($file),'url'=>'assets/'.basename($file),'name'=>basename($file),'mime'=>mime_content_type($file),'size'=>filesize($file),'width'=>$dims[0]??null,'height'=>$dims[1]??null,'kind'=>'image','base'=>true,'trash'=>false];
        }
        $result['media']=array_merge($base,$result['media']); cms_response($result);
    }
    if ($action==='backup' && $_SERVER['REQUEST_METHOD']==='GET') {
        $payload=cms_db(fn(array &$s)=>$s['draft']); header('Content-Disposition: attachment; filename="zamelano-backup-'.gmdate('Y-m-d').'.json"'); cms_response(['format'=>'zamelano-content-v1','exportedAt'=>gmdate('c'),'payload'=>$payload]);
    }
    cms_post();
    if ($action==='logout') {
        $_SESSION=[]; $params=session_get_cookie_params(); setcookie(session_name(),'', ['expires'=>time()-3600,'path'=>'/','secure'=>$params['secure'],'httponly'=>true,'samesite'=>'Strict']); session_destroy(); cms_response(['ok'=>true]);
    }
    if ($action==='upload') {
        $file=$_FILES['file'] ?? null;
        if (!$file || is_array($file['error']) || $file['error']!==UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) cms_fail('Файл не загружен. Максимальный размер — 10 МБ.');
        if ($file['size']<1 || $file['size']>10*1024*1024) cms_fail('Размер файла должен быть от 1 байта до 10 МБ.',413);
        $mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']); $id=bin2hex(random_bytes(16)); $bytes=null; $width=null; $height=null; $kind='document'; $ext='';
        if (in_array($mime,['image/jpeg','image/png','image/webp'],true)) {
            $dims=@getimagesize($file['tmp_name']);
            if (!$dims || $dims[0]*$dims[1]>16000000 || $dims[0]>8000 || $dims[1]>8000) cms_fail('Фото должно содержать не более 16 мегапикселей.');
            $image=@imagecreatefromstring(file_get_contents($file['tmp_name'])); if (!$image) cms_fail('Не удалось прочитать изображение.');
            $width=imagesx($image); $height=imagesy($image); $kind='image';
            ob_start();
            if ($mime==='image/jpeg') { $ext='jpg'; imagejpeg($image,null,90); }
            elseif ($mime==='image/png') { $ext='png'; imagesavealpha($image,true); imagepng($image,null,6); }
            else { $ext='webp'; imagewebp($image,null,90); }
            $bytes=ob_get_clean(); imagedestroy($image);
        } elseif ($mime==='application/pdf' && file_get_contents($file['tmp_name'],false,null,0,5)==='%PDF-') { $ext='pdf'; $bytes=file_get_contents($file['tmp_name']); }
        elseif (in_array($mime,['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/zip','application/octet-stream'],true) && strtolower(pathinfo($file['name'],PATHINFO_EXTENSION))==='docx') {
            $zip=new ZipArchive();
            if ($zip->open($file['tmp_name'])!==true) cms_fail('Не удалось прочитать Word-файл.');
            $stat=$zip->statName('word/document.xml');
            if (!$stat || $stat['size']>2*1024*1024 || $zip->locateName('word/vbaProject.bin')!==false) { $zip->close(); cms_fail('Допустим обычный DOCX без макросов, до 2 МБ текста.'); }
            $zip->close(); $ext='docx'; $mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document'; $bytes=file_get_contents($file['tmp_name']);
        } else cms_fail('Допустимы JPG, PNG, WebP, PDF и DOCX. Исполняемые файлы и SVG не принимаются.');
        if (!is_string($bytes) || $bytes==='') cms_fail('Не удалось обработать файл.');
        $path=cms_storage().'/media/'.$id.'.'.$ext; cms_atomic($path,$bytes);
        $row=['id'=>$id,'url'=>'media.php?id='.$id,'name'=>mb_substr(basename((string)$file['name']),0,160),'mime'=>$mime,'ext'=>$ext,'size'=>strlen($bytes),'width'=>$width,'height'=>$height,'kind'=>$kind,'createdAt'=>gmdate('c'),'trash'=>false,'public'=>false];
        cms_db(function(array &$s) use($row) { $s['media'][$row['id']]=$row; cms_audit($s,'Загружен файл',$row['name']); },true);
        cms_response(['file'=>$row]);
    }
    $body=cms_body();
    if ($action==='save') {
        $payload=cms_payload($body['payload'] ?? null);
        $result=cms_db(function(array &$s) use($body,$payload) {
            if (($body['revision'] ?? null)!==$s['revision']) cms_fail('Данные уже изменены в другом окне. Обновите панель и повторите правку.',409);
            cms_snapshot($s,'До изменения: '.mb_substr((string)($body['label'] ?? 'Содержимое'),0,100));
            $s['draft']=$payload; $s['revision']++; cms_audit($s,'Сохранён черновик',(string)($body['label'] ?? 'Содержимое'));
            return ['revision'=>$s['revision'],'publishedRevision'=>$s['publishedRevision']];
        },true); cms_response($result);
    }
    if ($action==='publish') {
        $result=cms_db(function(array &$s) use($body) {
            if (($body['revision'] ?? null)!==$s['revision']) cms_fail('Черновик изменился. Обновите панель перед публикацией.',409);
            $payload=cms_payload($s['draft']); cms_snapshot($s,'Опубликованная версия до публикации',$s['published']);
            $s['published']=$payload; $s['publishedRevision']=$s['revision']; $s['publishedAt']=gmdate('c');
            $encoded=cms_encode($payload);
            foreach ($s['media'] as &$m) $m['public']=str_contains($encoded,'id='.$m['id']); unset($m);
            cms_audit($s,'Опубликовано на zamelano.com и zamelano.ru');
            return ['revision'=>$s['revision'],'publishedRevision'=>$s['publishedRevision'],'publishedAt'=>$s['publishedAt']];
        },true); cms_response($result);
    }
    if ($action==='restore') {
        $result=cms_db(function(array &$s) use($body) {
            if (($body['revision'] ?? null)!==$s['revision']) cms_fail('Черновик изменился. Обновите панель.',409);
            $id=$body['id'] ?? ''; $match=null;
            foreach ($s['history'] as $row) if ($row['id']===$id) $match=$row;
            if (!$match || !preg_match('/^[a-f0-9]{24}$/D',$id)) cms_fail('Версия не найдена.',404);
            $payload=cms_payload(cms_json_file(cms_storage().'/versions/'.$id.'.json')); cms_snapshot($s,'До восстановления');
            $s['draft']=$payload; $s['revision']++; cms_audit($s,'Восстановлена версия в черновик',$match['at']); return ['revision'=>$s['revision']];
        },true); cms_response($result);
    }
    if ($action==='media-trash') {
        $result=cms_db(function(array &$s) use($body) {
            $id=$body['id'] ?? ''; if (!isset($s['media'][$id])) cms_fail('Файл не найден.',404);
            if (empty($body['restore']) && (str_contains(cms_encode($s['draft']),'id='.$id) || str_contains(cms_encode($s['published']),'id='.$id))) cms_fail('Файл используется на сайте. Сначала замените его в материалах.',409);
            $s['media'][$id]['trash']=empty($body['restore']); cms_audit($s,empty($body['restore'])?'Файл перемещён в корзину':'Файл восстановлен',$s['media'][$id]['name']); return ['ok'=>true];
        },true); cms_response($result);
    }
    if ($action==='import-docx') {
        $file=cms_db(fn(array &$s)=>$s['media'][$body['id'] ?? ''] ?? null);
        if (!$file || $file['ext']!=='docx') cms_fail('Выберите DOCX из медиатеки.');
        $zip=new ZipArchive(); $zip->open(cms_storage().'/media/'.$file['id'].'.docx'); $xml=$zip->getFromName('word/document.xml'); $zip->close();
        $dom=new DOMDocument(); if (!$dom->loadXML($xml,LIBXML_NONET)) cms_fail('Не удалось прочитать текст Word.');
        $xp=new DOMXPath($dom); $xp->registerNamespace('w','http://schemas.openxmlformats.org/wordprocessingml/2006/main'); $blocks=[];
        foreach ($xp->query('//w:body//w:p') as $p) {
            $text=''; foreach ($xp->query('.//w:t|.//w:tab|.//w:br',$p) as $node) $text.=$node->localName==='tab'?"\t":($node->localName==='br'?"\n":$node->textContent);
            $text=trim($text); if ($text==='') continue;
            $type=preg_match('/^\d+\.\s+/u',$text)?'heading':'paragraph';
            $block=['type'=>$type,'text'=>$text]; if ($type==='heading' && preg_match('/^(\d+)\./',$text,$m)) $block['id']='section-'.$m[1]; $blocks[]=$block;
        }
        cms_response(['blocks'=>$blocks]);
    }
    if ($action==='password') {
        $new=(string)($body['newPassword'] ?? ''); cms_password($new);
        $fresh=cms_db(function(array &$s) use($body,$new,$user) {
            $row=$s['users'][$user['id']];
            if (!password_verify((string)($body['currentPassword'] ?? ''),$row['passwordHash'])) cms_fail('Текущий пароль неверен.',403);
            $row['passwordHash']=password_hash($new,PASSWORD_DEFAULT); $row['sessionVersion']++; $s['users'][$row['id']]=$row; cms_audit($s,'Изменён пароль владельца'); return $row;
        },true); cms_login_session($fresh); cms_response(['ok'=>true,'csrf'=>cms_csrf()]);
    }
    cms_fail('Действие не найдено.',404);
} catch (Throwable $error) { cms_exception($error); }
