<?php
declare(strict_types=1);
require __DIR__.'/admin/core.php';
cms_headers();
header('Cache-Control: no-store');
try { cms_response(cms_published(isset($_GET['preview']))); } catch (Throwable $error) { cms_exception($error); }
