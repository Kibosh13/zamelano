<?php
declare(strict_types=1);
require __DIR__.'/admin/core.php';
cms_headers();
try {
    $preview=isset($_GET['preview']) && cms_user()!==null; $data=cms_published($preview);
    $template=file_get_contents(__DIR__.'/index.view.php'); if ($template===false) throw new RuntimeException('Missing view');
    $template=preg_replace('/^<\?php[^\n]*\?>\s*/','',$template,1);
    $title=htmlspecialchars($data['content']['settings']['title']['ru'],ENT_QUOTES,'UTF-8');
    $description=htmlspecialchars($data['content']['settings']['description']['ru'],ENT_QUOTES,'UTF-8');
    $template=preg_replace_callback('~<title>.*?</title>~s',fn()=>'<title>'.$title.'</title>',$template,1);
    $template=preg_replace_callback('~<meta name="description" content="[^"]*">~',fn()=>'<meta name="description" content="'.$description.'">',$template,1);
    $index=(!$preview && $data['content']['settings']['indexing'])?'index, follow':'noindex, nofollow, noarchive';
    foreach (['robots','googlebot','yandex'] as $name) $template=preg_replace('~<meta name="'.$name.'" content="[^"]*">~','<meta name="'.$name.'" content="'.$index.'">',$template);
    if ($preview) header('X-Robots-Tag: noindex, nofollow');
    header('Cache-Control: no-cache');
    $json=json_encode($data,JSON_UNESCAPED_UNICODE|JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_THROW_ON_ERROR);
    echo str_replace('</head>','<script type="application/json" id="cms-bootstrap">'.$json.'</script></head>',$template);
} catch (Throwable $error) {
    error_log('ZAMELANO storefront: '.$error->getMessage());
    $template=@file_get_contents(__DIR__.'/index.view.php');
    if ($template!==false) echo preg_replace('/^<\?php[^\n]*\?>\s*/','',$template,1);
    else { http_response_code(503); echo 'Сайт временно недоступен.'; }
}
