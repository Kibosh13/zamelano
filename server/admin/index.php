<?php
declare(strict_types=1);
require __DIR__.'/core.php';
cms_headers(true);
header('Content-Type: text/html; charset=utf-8');
$template=file_get_contents(__DIR__.'/admin.view.php');
echo preg_replace('/^<\?php[^\n]*\?>\s*/','',$template ?: '',1);
