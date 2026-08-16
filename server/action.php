<?php
/**
 * Приём заявки с формы и пересылка в Telegram.
 *
 * Кладётся в корень сайта рядом с index.html (путь в main.js — FORM_ENDPOINT).
 * Токен бота лежит в config.php, который не попадает в git.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function reply(bool $ok, string $error = ''): never
{
    http_response_code($ok ? 200 : 400);
    echo json_encode(
        $ok ? ['ok' => true] : ['ok' => false, 'error' => $error],
        JSON_UNESCAPED_UNICODE
    );
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    reply(false, 'Только POST');
}

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    error_log('bmw-service: нет config.php рядом с action.php');
    reply(false, 'Обработчик не настроен');
}
$config = require $configPath;

/** Обрезаем и чистим поле: в Telegram уходит обычный текст, без разметки. */
function field(string $key, int $max): string
{
    $value = (string) ($_POST[$key] ?? '');
    $value = str_replace(["\r\n", "\r"], "\n", trim($value));
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $value) ?? '';

    return mb_substr($value, 0, $max);
}

// Скрытое поле формы. Человек его не видит, бот заполняет — молча принимаем и выходим.
if (field('website', 100) !== '') {
    reply(true);
}

$car     = field('user_name', 200);
$phone   = field('user_email', 60);
$comment = field('text_comment', 2000);
$page    = field('page', 300);

if ($car === '' || $phone === '') {
    reply(false, 'Не заполнены автомобиль или телефон');
}

// В номере должно быть хотя бы 7 цифр — отсекает мусорные отправки.
if (preg_match_all('/\d/', $phone) < 7) {
    reply(false, 'Похоже, номер телефона указан не полностью');
}

$lines = [
    '🔧 Заявка с bmw-service.by',
    '',
    'Авто: ' . $car,
    'Телефон: ' . $phone,
];

if ($comment !== '') {
    $lines[] = 'Запрос: ' . $comment;
}

$lines[] = '';
$lines[] = 'Время: ' . date('d.m.Y H:i');

if ($page !== '') {
    $lines[] = 'Страница: ' . $page;
}

$payload = http_build_query([
    'chat_id'                  => $config['chat_id'],
    'text'                     => implode("\n", $lines),
    'disable_web_page_preview' => 'true',
]);

$ch = curl_init('https://api.telegram.org/bot' . $config['bot_token'] . '/sendMessage');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
]);

$response = curl_exec($ch);
$status   = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($response === false || $status !== 200) {
    // Ошибку Telegram пишем в лог сервера, наружу её не отдаём.
    error_log('bmw-service: Telegram ответил ' . $status . ' ' . $curlErr . ' ' . (string) $response);
    reply(false, 'Не удалось передать заявку');
}

reply(true);
