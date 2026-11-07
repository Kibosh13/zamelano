<?php
declare(strict_types=1);
require __DIR__.'/admin/core.php';
cms_headers();
try {
    $id=$_GET['id'] ?? ''; if (!is_string($id) || !preg_match('/^[a-f0-9]{32}$/D',$id)) cms_fail('Файл не найден.',404);
    $file=cms_db(fn(array &$s)=>$s['media'][$id] ?? null);
    if (!$file || (!$file['public'] && !cms_user())) cms_fail('Файл не найден.',404);
    $path=cms_storage().'/media/'.$id.'.'.$file['ext']; if (!is_file($path)) cms_fail('Файл не найден.',404);
    header('Content-Type: '.$file['mime']); header('Content-Length: '.filesize($path));
    header('Cache-Control: '.($file['public']?'public, max-age=31536000, immutable':'private, no-store'));
    if ($file['kind']!=='image') { header("Content-Disposition: attachment; filename=\"document.".$file['ext']."\"; filename*=UTF-8''".rawurlencode($file['name'])); header("Content-Security-Policy: sandbox; default-src 'none'"); }
    readfile($path);
} catch (Throwable $error) { cms_exception($error); }
