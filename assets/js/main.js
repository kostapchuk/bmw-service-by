/* bmw-service.by — интерфейсная логика лендинга. Без зависимостей. */
(function () {
    'use strict';

    /* Куда уходит заявка. Обработчик пересылает её в Telegram и держит
       токен бота у себя — в браузер токен не попадает.
       На bmw-service.by это server/action.php, на GitHub Pages —
       адрес Cloudflare Worker (см. README). */
    var FORM_ENDPOINT = 'action.php';

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- Шапка: фон появляется после прокрутки ---------- */
    var header = document.getElementById('siteHeader');
    function onScroll() {
        header.classList.toggle('is-stuck', window.scrollY > 24);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    /* ---------- Мобильное меню ---------- */
    var toggle = document.getElementById('navToggle');
    var nav = document.getElementById('siteNav');

    function setNav(open) {
        nav.classList.toggle('is-open', open);
        document.body.classList.toggle('nav-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    toggle.addEventListener('click', function () {
        setNav(!nav.classList.contains('is-open'));
    });

    nav.addEventListener('click', function (e) {
        if (e.target.closest('a')) setNav(false);
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && nav.classList.contains('is-open')) {
            setNav(false);
            toggle.focus();
        }
    });

    /* Возврат к десктопной раскладке не должен оставлять body заблокированным */
    window.addEventListener('resize', function () {
        if (window.innerWidth > 920) setNav(false);
    });

    /* ---------- Бегущая строка: дублируем содержимое для бесшовной петли ---------- */
    var track = document.querySelector('.marquee-track');
    if (track) {
        track.innerHTML += track.innerHTML;
    }

    /* ---------- Появление блоков при прокрутке ---------- */
    var revealTargets = document.querySelectorAll(
        '.sec-head, .card, .price-tile, .extra-item, .promo-flag, .promo-body, ' +
        '.bolt, .chips, .contact-info, .contact-form, .map-wrap, .gal-rail'
    );

    if (!reduced && 'IntersectionObserver' in window) {
        Array.prototype.forEach.call(revealTargets, function (el) {
            el.setAttribute('data-reveal', '');
        });

        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-in');
                    io.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

        Array.prototype.forEach.call(revealTargets, function (el) { io.observe(el); });
    }

    /* ---------- Индекс специализации: подсветка текущей темы ---------- */
    var specLinks = Array.prototype.slice.call(document.querySelectorAll('.spec-index a'));
    if (specLinks.length) {
        var specPairs = specLinks
            .map(function (a) {
                return { link: a, section: document.getElementById(a.getAttribute('href').slice(1)) };
            })
            .filter(function (pair) { return pair.section; });

        /* Активна последняя тема, чей заголовок уже прошёл треть экрана */
        function markCurrent() {
            var line = window.innerHeight * 0.35;
            var current = null;

            specPairs.forEach(function (pair) {
                if (pair.section.getBoundingClientRect().top <= line) current = pair.link;
            });

            specPairs.forEach(function (pair) {
                pair.link.classList.toggle('is-current', pair.link === current);
            });
        }

        markCurrent();
        window.addEventListener('scroll', markCurrent, { passive: true });
        window.addEventListener('resize', markCurrent);
    }

    /* ---------- Счётчик цен ---------- */
    var counters = document.querySelectorAll('[data-count]');
    if (counters.length && !reduced && 'IntersectionObserver' in window) {
        var cio = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var el = entry.target;
                cio.unobserve(el);

                var target = parseInt(el.getAttribute('data-count'), 10);
                var start = performance.now();
                var dur = 900;

                (function step(now) {
                    var p = Math.min((now - start) / dur, 1);
                    var eased = 1 - Math.pow(1 - p, 3);
                    el.textContent = Math.round(target * eased);
                    if (p < 1) requestAnimationFrame(step);
                })(start);
            });
        }, { threshold: 0.5 });

        Array.prototype.forEach.call(counters, function (el) { cio.observe(el); });
    }

    /* ---------- Форма заявки ----------
       Отправляется на FORM_ENDPOINT, оттуда уходит в Telegram.
       Ответ обработчика: {"ok": true} либо {"ok": false, "error": "..."}.
    */
    var form = document.getElementById('bookingForm');
    if (form) {
        var messages = form.querySelector('.messages');
        var submit = document.getElementById('btn_submit');
        var PHONE_HTML = '<a href="tel:+375295630919">+375 29 563 09 19</a>';

        function say(text, kind) {
            messages.innerHTML = text;
            messages.className = 'messages messages--' + kind;
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();

            var userName = document.getElementById('user_name').value.trim();
            var userPhone = document.getElementById('user_email').value.trim();
            var comment = document.getElementById('text_comment').value.trim();
            var trap = document.getElementById('form_website').value;

            if (!userName || !userPhone) {
                say('Укажите автомобиль и номер телефона — без них мы не сможем перезвонить.', 'error');
                return;
            }

            submit.disabled = true;
            var label = submit.textContent;
            submit.textContent = 'Отправляем…';
            say('', 'idle');

            fetch(FORM_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                body: new URLSearchParams({
                    user_name: userName,
                    user_email: userPhone,
                    text_comment: comment,
                    website: trap,
                    page: location.href
                }).toString()
            })
                .then(function (r) { return r.json().catch(function () { return {}; }); })
                .then(function (data) {
                    if (!data || data.ok !== true) throw new Error('rejected');

                    say('Заявка у нас в Telegram. Перезвоним в ближайшее время.', 'ok');
                    form.reset();

                    /* Цель Яндекс.Метрики — та же, что и на старом сайте */
                    try {
                        if (window.yaCounter37073655) window.yaCounter37073655.reachGoal('ZAKAZ');
                    } catch (err) { /* метрика не загрузилась — заявка уже ушла */ }
                })
                .catch(function () {
                    say('Не получилось отправить заявку. Позвоните или напишите в Telegram: ' + PHONE_HTML, 'error');
                })
                .finally(function () {
                    submit.disabled = false;
                    submit.textContent = label;
                });
        });
    }

    /* ---------- Год в подвале ---------- */
    var year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();
})();
