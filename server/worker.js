/**
 * Cloudflare Worker — то же самое, что action.php, но без PHP.
 * Нужен, если сайт стоит на GitHub Pages: там серверного кода нет.
 *
 * Разворачивание:
 *   1. Создать Worker на dash.cloudflare.com и вставить этот файл.
 *   2. Settings → Variables → добавить секреты BOT_TOKEN и CHAT_ID.
 *   3. В assets/js/main.js прописать адрес воркера в FORM_ENDPOINT.
 *
 * Токен живёт в секретах Cloudflare и в браузер не отдаётся.
 */

const ALLOWED_ORIGINS = [
    'https://bmw-service.by',
    'https://www.bmw-service.by',
    'https://kostapchuk.github.io',
];

function corsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin',
    };
}

function json(body, status, origin) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
    });
}

/** Обрезаем и чистим поле: в Telegram уходит обычный текст, без разметки. */
function field(form, key, max) {
    return String(form.get(key) || '')
        .replace(/\r\n?/g, '\n')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
        .trim()
        .slice(0, max);
}

export default {
    async fetch(request, env) {
        const origin = request.headers.get('Origin') || '';

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders(origin) });
        }
        if (request.method !== 'POST') {
            return json({ ok: false, error: 'Только POST' }, 405, origin);
        }

        const form = await request.formData();

        // Скрытое поле формы: заполнено — значит бот. Молча принимаем.
        if (field(form, 'website', 100) !== '') {
            return json({ ok: true }, 200, origin);
        }

        const car = field(form, 'user_name', 200);
        const phone = field(form, 'user_email', 60);
        const comment = field(form, 'text_comment', 2000);
        const page = field(form, 'page', 300);

        if (!car || !phone) {
            return json({ ok: false, error: 'Не заполнены автомобиль или телефон' }, 400, origin);
        }
        if ((phone.match(/\d/g) || []).length < 7) {
            return json({ ok: false, error: 'Похоже, номер телефона указан не полностью' }, 400, origin);
        }

        const lines = ['🔧 Заявка с bmw-service.by', '', `Авто: ${car}`, `Телефон: ${phone}`];
        if (comment) lines.push(`Запрос: ${comment}`);
        lines.push('', `Время: ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`);
        if (page) lines.push(`Страница: ${page}`);

        const tg = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: env.CHAT_ID,
                text: lines.join('\n'),
                disable_web_page_preview: true,
            }),
        });

        if (!tg.ok) {
            // Ответ Telegram пишем в логи воркера, наружу не отдаём.
            console.error('Telegram ответил', tg.status, await tg.text());
            return json({ ok: false, error: 'Не удалось передать заявку' }, 502, origin);
        }

        return json({ ok: true }, 200, origin);
    },
};
