/* ============================================================================
 * ГРАФИКИ ИЗМЕРЕНИЙ — версия 3.0
 * Реализация по ТЗ v3.0 «Графики измерений приложения МОЙ ДОМАШНИЙ ДОКТОР»
 *
 * Макет №5 — окно выбора параметра (всплывающее)
 * Макет №6 — страница графика: рисунок, статистика, таблица, три кнопки
 *
 * Библиотеки Chart.js, html2canvas и jsPDF лежат в папке vendor и попадают
 * в кэш Service Worker, поэтому раздел работает без интернета.
 * Интернет нужен только кнопке «Отправить доктору».
 * ========================================================================== */

var Graphs = {

    STORE_KEY: 'mdd_graphs',   // история построенных графиков
    MAX_STORED: 50,            // сколько графиков помним (localStorage не резиновый)

    /* --- Параметры, доступные для построения (раздел 2.2 ТЗ) --------------- */
    PARAMS: [
        { id: 'ad_bp', label: 'АД верхнее и нижнее', hint: 'две линии на одном графике',
          name: 'АД верх/низ (мм рт.ст)', axis: 'мм рт.ст', pad: 10 },
        { id: 'pulse', label: 'Пульс', hint: 'уд/мин',
          name: 'Пульс (уд/мин)', axis: 'уд/мин', color: '#FF6B6B', pad: 10 },
        { id: 'spo2', label: 'Сатурация SpO2', hint: '%',
          name: 'SpO2 (%)', axis: '%', color: '#7B1FA2', pad: 3 },
        { id: 'sugar', label: 'Сахар', hint: 'ммоль/л',
          name: 'Сахар (ммоль/л)', axis: 'ммоль/л', color: '#FFA500', pad: 1 },
        { id: 'temp', label: 'Температура', hint: '°C',
          name: 'Температура (°C)', axis: '°C', color: '#0288D1', pad: 0.5 },
        { id: 'weight', label: 'Вес', hint: 'кг',
          name: 'Вес (кг)', axis: 'кг', color: '#00AA00', pad: 1 }
    ],

    /* --- Состояние --------------------------------------------------------- */
    _chart: null,        // текущий объект Chart.js
    _meta: null,         // метаданные построенного графика
    _sending: false,     // идёт запрос к доктору
    _busy: false,        // идёт формирование PDF

    param: function (id) {
        for (var i = 0; i < Graphs.PARAMS.length; i++) {
            if (Graphs.PARAMS[i].id === id) return Graphs.PARAMS[i];
        }
        return null;
    },

    /* ======================================================================
     * ХРАНИЛИЩЕ ГРАФИКОВ
     * ==================================================================== */
    /* История графиков своя у каждого члена семьи */
    storeKey: function () { return Storage.pkey(Graphs.STORE_KEY); },

    getAll: function () {
        var raw = localStorage.getItem(Graphs.storeKey());
        if (!raw) return {};
        try {
            return JSON.parse(raw) || {};
        } catch (e) {
            return {};
        }
    },

    save: function (meta) {
        var all = Graphs.getAll();
        all[meta.id] = meta;

        // Оставляем только последние MAX_STORED графиков — иначе история
        // измерений быстро съест место, отведённое браузером под localStorage
        var ids = Object.keys(all).sort(function (a, b) {
            return (all[a].createdAt < all[b].createdAt) ? 1 : -1;
        });
        for (var i = Graphs.MAX_STORED; i < ids.length; i++) {
            delete all[ids[i]];
        }

        try {
            localStorage.setItem(Graphs.storeKey(), JSON.stringify(all));
        } catch (e) {
            // Место кончилось — чистим историю графиков, данные дневника важнее
            localStorage.removeItem(Graphs.storeKey());
        }
    },

    newId: function () {
        return 'graph_' + Date.now().toString(36) + '_' +
            Math.random().toString(36).substring(2, 8);
    },

    /* ======================================================================
     * ШАГ 1. КНОПКА «СОЗДАТЬ ГРАФИК» (доработка №1)
     * ==================================================================== */
    start: function () {
        var days = Diary._selectedDays.slice().sort();

        // Валидация: без отмеченных дней строить нечего
        if (days.length === 0) {
            UI.showToast('Отметьте галочками хотя бы один день!', 3500);
            return;
        }

        Graphs.openParamDialog(days);
    },

    /* ======================================================================
     * МАКЕТ №5 — ВЫБОР ПАРАМЕТРА (доработка №2)
     * ==================================================================== */
    openParamDialog: function (days) {
        var overlay = document.getElementById('gr-modal');
        if (!overlay) return;

        var html = '<div class="gr-window">' +
            '<div class="gr-mhead">' +
            '<h3>📈 Выберите параметр для графика</h3>' +
            '<button class="gr-close" onclick="Graphs.closeParamDialog()" title="Закрыть">✕</button>' +
            '</div>' +
            '<div class="gr-mbody"><div class="gr-options">';

        for (var i = 0; i < Graphs.PARAMS.length; i++) {
            var p = Graphs.PARAMS[i];
            html += '<label class="gr-option">' +
                '<input type="radio" name="gr-param" value="' + p.id + '">' +
                '<span class="gr-option-text">' + UI.escapeHtml(p.label) +
                '<span class="gr-option-hint">' + UI.escapeHtml(p.hint) + '</span></span>' +
                '</label>';
        }

        html += '</div></div>' +
            '<div class="gr-mfoot">' +
            '<button class="btn btn-outline" onclick="Graphs.closeParamDialog()">Отмена</button>' +
            '<button class="btn btn-primary" onclick="Graphs.confirmParam()">Ввод</button>' +
            '</div></div>';

        overlay.innerHTML = html;
        overlay.style.display = 'flex';
        Graphs._days = days;

        // Закрытие по клику вне окна
        overlay.onclick = function (e) {
            if (e.target === overlay) Graphs.closeParamDialog();
        };
    },

    closeParamDialog: function () {
        var overlay = document.getElementById('gr-modal');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.innerHTML = '';
        }
    },

    confirmParam: function () {
        var checked = document.querySelector('input[name="gr-param"]:checked');
        if (!checked) {
            UI.showToast('Выберите параметр!', 3000);
            return;
        }
        var paramId = checked.value;
        Graphs.closeParamDialog();
        Graphs.build(Graphs._days, paramId);
    },

    /* ======================================================================
     * ШАГ 2. СБОР И СОРТИРОВКА ДАННЫХ (доработка №3)
     * ==================================================================== */
    collect: function (days, paramId) {
        var records = Diary.getRecords();
        var out = [];

        for (var i = 0; i < days.length; i++) {
            var day = days[i];
            var rec = records[day];
            if (!rec || !rec.measurements) continue;

            for (var j = 0; j < rec.measurements.length; j++) {
                var m = rec.measurements[j];
                if (!m.time) continue;

                var point = {
                    date: day,
                    time: m.time,
                    timestamp: new Date(day + 'T' + m.time + ':00').getTime()
                };

                if (paramId === 'ad_bp') {
                    // Для давления нужны оба значения сразу
                    if (m.ad_top === null || m.ad_top === undefined ||
                        m.ad_bottom === null || m.ad_bottom === undefined) continue;
                    point.ad_top = m.ad_top;
                    point.ad_bottom = m.ad_bottom;
                    point.value = m.ad_top;   // для статистики берём верхнее
                } else {
                    var v = Graphs.valueOf(m, paramId);
                    if (v === null || v === undefined || v === '') continue;
                    point.value = v;
                }

                out.push(point);
            }
        }

        // Сортировка по времени по возрастанию (шаг 4 алгоритма ТЗ)
        out.sort(function (a, b) { return a.timestamp - b.timestamp; });
        return out;
    },

    valueOf: function (m, paramId) {
        if (paramId === 'pulse') return m.pulse;
        if (paramId === 'spo2') return m.spo2;
        if (paramId === 'sugar') return m.sugar;
        if (paramId === 'temp') return m.temperature;
        if (paramId === 'weight') return m.weight;
        return null;
    },

    /* Статистика: количество, минимум, максимум, среднее */
    stats: function (points, paramId) {
        var vals = [];
        for (var i = 0; i < points.length; i++) {
            if (paramId === 'ad_bp') {
                vals.push(points[i].ad_top, points[i].ad_bottom);
            } else {
                vals.push(points[i].value);
            }
        }
        if (vals.length === 0) return { count: 0, min: 0, max: 0, avg: 0 };

        var min = vals[0], max = vals[0], sum = 0;
        for (var j = 0; j < vals.length; j++) {
            if (vals[j] < min) min = vals[j];
            if (vals[j] > max) max = vals[j];
            sum += vals[j];
        }
        return {
            count: points.length,
            min: Graphs.round(min),
            max: Graphs.round(max),
            avg: Graphs.round(sum / vals.length)
        };
    },

    round: function (v) {
        return Math.round(v * 100) / 100;
    },

    /* ======================================================================
     * ШАГ 3. ПОСТРОЕНИЕ ГРАФИКА
     * ==================================================================== */
    build: function (days, paramId) {
        var points = Graphs.collect(days, paramId);

        // Валидация: в выбранных днях может не быть нужного показателя
        if (points.length === 0) {
            var p = Graphs.param(paramId);
            UI.showToast('Отсутствуют измерения «' + p.label +
                '» в данной выборке записей', 4500);
            return;
        }

        var sorted = days.slice().sort();
        Graphs._meta = {
            id: Graphs.newId(),
            parameter: paramId,
            parameterName: Graphs.param(paramId).name,
            startDate: sorted[0],
            endDate: sorted[sorted.length - 1],
            selectedDays: sorted,
            measurements: points,
            statistics: Graphs.stats(points, paramId),
            createdAt: new Date().toISOString(),
            status: 'created'
        };
        Graphs.save(Graphs._meta);

        Graphs.openPage();
    },

    /* ======================================================================
     * МАКЕТ №6 — СТРАНИЦА ГРАФИКА (доработка №4)
     * ==================================================================== */
    openPage: function () {
        App.navigateTo('graphs');
        Graphs.renderPage();
    },

    renderPage: function () {
        var host = document.getElementById('graphs-root');
        if (!host || !Graphs._meta) return;

        var meta = Graphs._meta;
        var p = Graphs.param(meta.parameter);
        var s = meta.statistics;
        var period = UI.formatDate(meta.startDate);
        if (meta.startDate !== meta.endDate) {
            period += ' — ' + UI.formatDate(meta.endDate);
        }

        var html = '';

        // Заголовок
        html += '<div class="gr-head">' +
            '<button class="dv-back" onclick="Graphs.exit()">← Выйти</button>' +
            '<h2 class="gr-title">📈 График измерений</h2>' +
            '<p class="gr-period">' + UI.escapeHtml(period) + '</p>' +
            '<p class="gr-param">Параметр: ' + UI.escapeHtml(p.name) + '</p>' +
            '</div>';

        // Область, которую целиком снимаем в PDF
        html += '<div id="gr-shot" class="gr-shot">';
        html += '<div class="gr-canvas-box"><canvas id="gr-canvas"></canvas></div>';

        html += '<div class="gr-stats">' +
            Graphs.statBox('Всего измерений', s.count) +
            Graphs.statBox('Минимум', s.min) +
            Graphs.statBox('Максимум', s.max) +
            Graphs.statBox('Среднее', s.avg) +
            '</div>';
        html += '</div>';

        // Таблица значений — сворачиваемая, чтобы не загромождать экран
        html += '<button class="gr-toggle" onclick="Graphs.toggleTable()">' +
            '<span id="gr-toggle-text">Показать таблицу значений</span></button>';
        html += '<div class="gr-tablewrap" id="gr-tablewrap" style="display:none">' +
            Graphs.tableHtml(meta) + '</div>';

        // Кнопки
        html += '<div class="gr-buttons">' +
            '<button class="btn btn-primary" onclick="Graphs.sendToDoctor()">🩺 Отправить доктору</button>' +
            '<button class="btn btn-outline" onclick="Graphs.exportPDF()">📄 Записать в PDF</button>' +
            '<button class="btn btn-outline" onclick="Graphs.exit()">❌ Выйти</button>' +
            '</div>';

        host.innerHTML = html;
        Graphs.draw();
    },

    statBox: function (label, value) {
        return '<div class="gr-stat">' +
            '<span class="gr-stat-label">' + label + '</span>' +
            '<span class="gr-stat-value">' + value + '</span></div>';
    },

    tableHtml: function (meta) {
        var isBp = meta.parameter === 'ad_bp';
        var html = '<table class="gr-table"><thead><tr>' +
            '<th>Дата</th><th>Время</th>' +
            (isBp ? '<th>АД верх</th><th>АД низ</th>' : '<th>Значение</th>') +
            '</tr></thead><tbody>';

        for (var i = 0; i < meta.measurements.length; i++) {
            var m = meta.measurements[i];
            html += '<tr>' +
                '<td>' + UI.escapeHtml(Diary.formatDate(m.date)) + '</td>' +
                '<td>' + UI.escapeHtml(m.time) + '</td>' +
                (isBp
                    ? '<td>' + m.ad_top + '</td><td>' + m.ad_bottom + '</td>'
                    : '<td>' + m.value + '</td>') +
                '</tr>';
        }
        return html + '</tbody></table>';
    },

    toggleTable: function () {
        var box = document.getElementById('gr-tablewrap');
        var txt = document.getElementById('gr-toggle-text');
        if (!box) return;
        var hidden = box.style.display === 'none';
        box.style.display = hidden ? 'block' : 'none';
        if (txt) txt.textContent = hidden ? 'Скрыть таблицу значений' : 'Показать таблицу значений';
    },

    /* ======================================================================
     * РИСОВАНИЕ ГРАФИКА (Chart.js)
     * ==================================================================== */
    draw: function () {
        var canvas = document.getElementById('gr-canvas');
        if (!canvas || !Graphs._meta) return;

        if (Graphs._chart) {
            Graphs._chart.destroy();
            Graphs._chart = null;
        }

        var meta = Graphs._meta;
        var p = Graphs.param(meta.parameter);
        var points = meta.measurements;

        // Подписи по оси X: если период больше одного дня — с датой
        var multiDay = meta.startDate !== meta.endDate;
        var labels = points.map(function (m) {
            return multiDay ? (Diary.formatDate(m.date).slice(0, 5) + ' ' + m.time) : m.time;
        });

        var datasets;
        var allValues = [];

        if (meta.parameter === 'ad_bp') {
            var top = points.map(function (m) { return m.ad_top; });
            var bottom = points.map(function (m) { return m.ad_bottom; });
            allValues = top.concat(bottom);
            datasets = [
                {
                    label: 'АД верхнее (систолическое)',
                    data: top,
                    borderColor: '#0066CC',
                    backgroundColor: 'rgba(0, 102, 204, 0.1)',
                    borderWidth: 3,
                    pointRadius: 4,
                    fill: false,
                    tension: 0.3
                },
                {
                    label: 'АД нижнее (диастолическое)',
                    data: bottom,
                    borderColor: '#FF6B6B',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    borderWidth: 3,
                    pointRadius: 4,
                    fill: false,
                    tension: 0.3
                }
            ];
        } else {
            var vals = points.map(function (m) { return m.value; });
            allValues = vals;
            datasets = [{
                label: p.name,
                data: vals,
                borderColor: p.color,
                backgroundColor: Graphs.fade(p.color),
                borderWidth: 3,
                pointRadius: 4,
                fill: true,
                tension: 0.3
            }];
        }

        var min = Math.min.apply(null, allValues) - p.pad;
        var max = Math.max.apply(null, allValues) + p.pad;

        Graphs._chart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels: labels, datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,          // ускоряет отрисовку и съёмку в PDF
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    title: {
                        display: true,
                        text: p.name,
                        font: { size: 16, weight: 'bold' },
                        color: '#0D47A1'
                    },
                    legend: {
                        display: meta.parameter === 'ad_bp',
                        position: 'top',
                        labels: { font: { size: 13 }, boxWidth: 24 }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        suggestedMin: min,
                        suggestedMax: max,
                        title: { display: true, text: p.axis, font: { size: 13 } },
                        ticks: { font: { size: 12 } }
                    },
                    x: {
                        title: {
                            display: true,
                            text: multiDay ? 'Дата и время' : 'Время',
                            font: { size: 13 }
                        },
                        ticks: {
                            font: { size: 11 },
                            maxRotation: 60,
                            minRotation: 0,
                            autoSkipPadding: 12
                        }
                    }
                }
            }
        });
    },

    /* Полупрозрачная заливка того же цвета, что и линия */
    fade: function (hex) {
        var r = parseInt(hex.substring(1, 3), 16);
        var g = parseInt(hex.substring(3, 5), 16);
        var b = parseInt(hex.substring(5, 7), 16);
        return 'rgba(' + r + ', ' + g + ', ' + b + ', 0.12)';
    },

    /* ======================================================================
     * ОТПРАВКА ГРАФИКА ДОКТОРУ (доработка №5)
     * ==================================================================== */
    sendToDoctor: function () {
        if (!Graphs._meta) return;
        if (Graphs._sending) {
            UI.showToast('Запрос уже отправлен, подождите');
            return;
        }
        if (!navigator.onLine) {
            UI.showToast('Нет соединения с интернетом', 3500);
            return;
        }

        var meta = Graphs._meta;
        var period = UI.formatDate(meta.startDate);
        if (meta.startDate !== meta.endDate) period += ' — ' + UI.formatDate(meta.endDate);

        UI.showConfirm(
            'Отправить доктору?',
            'График «' + Graphs.param(meta.parameter).name + '» за ' + period +
            ' будет отправлен ИИ-доктору для анализа.',
            'Отправить',
            function () {
                Graphs._sending = true;
                UI.showToast('Отправляю запрос доктору...', 4000);

                var prompt = Graphs.buildPrompt(meta);

                var xhr = new XMLHttpRequest();
                xhr.open('POST', '/api/chat', true);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.timeout = 90000;

                xhr.onload = function () {
                    Graphs._sending = false;
                    if (xhr.status === 200) {
                        var data;
                        try {
                            data = JSON.parse(xhr.responseText);
                        } catch (e) {
                            UI.showToast('Ошибка обработки ответа сервера', 3500);
                            return;
                        }
                        var reply = (data.reply || '').replace('[ПРОДОЛЖЕНИЕ]', '').trim();
                        if (!reply) {
                            UI.showToast('Доктор не прислал ответ, попробуйте ещё раз', 3500);
                            return;
                        }
                        Graphs.storeConsult(meta, prompt, reply);
                        UI.showToast('Консультация получена! Смотрите историю чата', 4000);
                        App.navigateTo('diary');
                        Diary.show('chat');
                    } else if (xhr.status === 403) {
                        UI.showToast('Нужен код доступа к доктору — откройте раздел «Доктор»', 4000);
                    } else if (xhr.status === 429) {
                        UI.showToast('Слишком много запросов, подождите немного', 3500);
                    } else if (xhr.status === 401) {
                        UI.showToast('Ошибка авторизации API (проверьте ключ)', 3500);
                    } else {
                        UI.showToast('Ошибка сервера Claude (код ' + xhr.status + ')', 3500);
                    }
                };

                xhr.ontimeout = function () {
                    Graphs._sending = false;
                    UI.showToast('Сервер не ответил, попробуйте позже', 3500);
                };

                xhr.onerror = function () {
                    Graphs._sending = false;
                    UI.showToast('Нет соединения с интернетом', 3500);
                };

                xhr.send(JSON.stringify({
                    message: prompt,
                    history: [],
                    profileContext: Doctor.getProfileContext(),
                    analysesContext: '',
                    files: [],
                    accessCode: localStorage.getItem('hd_access_code') || ''
                }));
            }
        );
    },

    /* Текст запроса: период, статистика и все значения (раздел 4.2 ТЗ) */
    buildPrompt: function (meta) {
        var p = Graphs.param(meta.parameter);
        var s = meta.statistics;
        var period = UI.formatDate(meta.startDate);
        if (meta.startDate !== meta.endDate) period += ' — ' + UI.formatDate(meta.endDate);

        var lines = [];
        lines.push('ГРАФИК ИЗМЕРЕНИЙ');
        lines.push('Период: ' + period);
        lines.push('Параметр: ' + p.name);
        lines.push('Количество измерений: ' + s.count);
        lines.push('');
        lines.push('Статистика: минимум ' + s.min + ', максимум ' + s.max + ', среднее ' + s.avg);
        lines.push('');
        lines.push('Все значения по возрастанию времени:');

        for (var i = 0; i < meta.measurements.length; i++) {
            var m = meta.measurements[i];
            var stamp = Diary.formatDate(m.date) + ' ' + m.time + ': ';
            lines.push(stamp + (meta.parameter === 'ad_bp'
                ? m.ad_top + '/' + m.ad_bottom
                : m.value));
        }

        lines.push('');
        lines.push('Проанализируйте эти данные, обратите внимание на тренды и колебания. ' +
            'Дайте профессиональную рекомендацию.');
        return lines.join('\n');
    },

    /* Консультация ложится в ту же историю чата, что и запросы из дневника */
    storeConsult: function (meta, prompt, reply) {
        var p = Graphs.param(meta.parameter);
        var period = UI.formatDate(meta.startDate);
        if (meta.startDate !== meta.endDate) period += ' — ' + UI.formatDate(meta.endDate);

        var chat = Diary.getChat();
        chat.unshift({
            id: 'msg_' + Date.now().toString(36),
            timestamp: new Date().toISOString(),
            type: 'graph_consultation',
            graphId: meta.id,
            parameter: meta.parameter,
            selected_days: meta.selectedDays.slice(),
            user_message: 'Отправлен график «' + p.name + '» за ' + period,
            prompt: prompt,
            ai_response: reply,
            model: 'claude-haiku-4-5'
        });
        if (chat.length > 100) chat = chat.slice(0, 100);
        Diary.saveChat(chat);

        meta.consultedAt = new Date().toISOString();
        Graphs.save(meta);
    },

    /* ======================================================================
     * ЭКСПОРТ ГРАФИКА В PDF (доработка №6)
     *
     * Встроенные шрифты jsPDF не содержат кириллицы — русский текст,
     * добавленный через pdf.text(), превратился бы в набор знаков вопроса.
     * Поэтому весь лист (заголовок, график, статистика, таблица) сначала
     * собирается как обычная HTML-вёрстка, снимается html2canvas в картинку
     * и уже картинка кладётся в PDF. Кириллица выглядит правильно.
     * ==================================================================== */
    exportPDF: function () {
        if (!Graphs._meta || Graphs._busy) return;

        Graphs._busy = true;
        UI.showToast('Создаю PDF...', 4000);

        var meta = Graphs._meta;
        var sheet = Graphs.buildSheet(meta);
        document.body.appendChild(sheet);

        // Ждём, пока браузер загрузит картинку графика: без этого лист
        // измеряется недорисованным и низ документа обрезается
        Graphs.waitImages(sheet).then(function () {
            return html2canvas(sheet, Graphs.shotOptions(sheet));
        })
                .then(function (canvas) {
                    document.body.removeChild(sheet);

                    var jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
                    var pdf = new jsPDFCtor({ orientation: 'portrait', unit: 'mm', format: 'a4' });

                    var pageW = pdf.internal.pageSize.getWidth();
                    var pageH = pdf.internal.pageSize.getHeight();
                    var margin = 10;
                    var imgW = pageW - margin * 2;
                    var imgH = canvas.height * imgW / canvas.width;
                    var image = canvas.toDataURL('image/jpeg', 0.92);

                    if (imgH <= pageH - margin * 2) {
                        pdf.addImage(image, 'JPEG', margin, margin, imgW, imgH);
                    } else {
                        // Длинный лист режем на страницы
                        var usableH = pageH - margin * 2;
                        var offset = 0;
                        while (offset < imgH) {
                            pdf.addImage(image, 'JPEG', margin, margin - offset, imgW, imgH);
                            offset += usableH;
                            if (offset < imgH) pdf.addPage();
                        }
                    }

                    pdf.save(Graphs.fileName(meta));

                    meta.pdfInfo = {
                        filename: Graphs.fileName(meta),
                        savedAt: new Date().toISOString(),
                        status: 'saved'
                    };
                    Graphs.save(meta);

                    Graphs._busy = false;
                    UI.showToast('PDF сохранён: ' + Graphs.fileName(meta), 5000);
                })
                .catch(function (err) {
                    if (sheet.parentNode) document.body.removeChild(sheet);
                    Graphs._busy = false;
                    UI.showToast('Не удалось создать PDF: ' + (err && err.message ? err.message : 'ошибка'), 4500);
                });
    },

    /* ----------------------------------------------------------------------
     * Настройки съёмки листа для html2canvas.
     *
     * Без явных размеров библиотека снимает лист по ширине окна браузера.
     * На компьютере окно шире листа и всё попадает целиком, а на смартфоне
     * окно узкое — и правый край документа отсекался (график, легенда
     * и статистика обрывались на середине). Поэтому передаём размеры листа
     * явно и обнуляем прокрутку.
     * -------------------------------------------------------------------- */
    shotOptions: function (sheet) {
        return {
            scale: 2,
            backgroundColor: '#FFFFFF',
            logging: false,
            // Виртуальное окно шире листа, чтобы на смартфоне документ
            // не обрезался по ширине экрана
            windowWidth: Math.max(sheet.offsetWidth, sheet.scrollWidth) + 40
        };
    },

    /* Ждём загрузки всех картинок листа (график вставляется как data-URL) */
    waitImages: function (root) {
        var imgs = root.querySelectorAll('img');
        var jobs = [];
        for (var i = 0; i < imgs.length; i++) {
            (function (img) {
                if (img.complete && img.naturalWidth > 0) return;
                jobs.push(new Promise(function (resolve) {
                    img.addEventListener('load', resolve);
                    img.addEventListener('error', resolve);
                    setTimeout(resolve, 3000);   // подстраховка от зависания
                }));
            })(imgs[i]);
        }
        return Promise.all(jobs).then(function () {
            // Ещё один кадр на пересчёт вёрстки после появления картинок
            return new Promise(function (r) { setTimeout(r, 80); });
        });
    },

    /* ----------------------------------------------------------------------
     * Стили печатного листа.
     *
     * Раньше лист опирался на внешний файл graphs.css. html2canvas рисует
     * копию страницы в отдельном окне и не всегда успевает загрузить туда
     * внешние стили: на компьютере успевал, на смартфоне — нет, и документ
     * выходил без оформления, а картинка графика вылезала за правый край
     * в своём натуральном размере. Теперь стили вкладываются прямо в лист
     * и не зависят от загрузки файлов.
     * -------------------------------------------------------------------- */
    sheetCss: function () {
        return '<style>' +
            '.gr-sheet{position:fixed;left:-10000px;top:0;width:780px;background:#FFF;' +
            'color:#222;font-family:Arial,Helvetica,sans-serif;font-size:13px;' +
            'line-height:1.5;padding:28px;box-sizing:border-box}' +
            '.gr-sheet *{box-sizing:border-box}' +
            '.gr-sheet-head{text-align:center;border-bottom:2px solid #0066CC;' +
            'padding-bottom:12px;margin-bottom:16px}' +
            '.gr-sheet-head h1{margin:0;font-size:20px;color:#0066CC}' +
            '.gr-sheet-head h2{margin:6px 0 8px;font-size:16px;color:#0D47A1}' +
            '.gr-sheet-head p{margin:2px 0;font-size:13px}' +
            '.gr-sheet-patient{background:#E6F2FF;border-radius:8px;padding:10px 14px;' +
            'margin-bottom:14px;font-size:12px}' +
            '.gr-sheet-chart{text-align:center;margin-bottom:16px}' +
            '.gr-sheet-chart img{display:block;width:720px;max-width:100%;height:auto;margin:0 auto}' +
            '.gr-sheet-stats{width:100%;border-collapse:collapse;margin-bottom:18px}' +
            '.gr-sheet-stats td{border:1px solid #CCC;padding:8px;text-align:center;' +
            'font-size:13px;background:#F5F5F5}' +
            '.gr-sheet h3{font-size:15px;color:#0066CC;margin:0 0 8px}' +
            '.gr-sheet-table{width:100%;border-collapse:collapse;font-size:12px}' +
            '.gr-sheet-table th{background:#0066CC;color:#FFF;border:1px solid #CCC;' +
            'padding:6px;text-align:center}' +
            '.gr-sheet-table td{border:1px solid #CCC;padding:5px 6px;text-align:center}' +
            '.gr-sheet-table tr:nth-child(even) td{background:#F9F9F9}' +
            '.gr-sheet-foot{margin-top:18px;padding-top:10px;border-top:1px solid #DDD;' +
            'text-align:center;color:#999;font-size:11px}' +
            '</style>';
    },

    /* Имя файла по образцу из ТЗ: «Дневник график 14 июля 2026 - 20 июля 2026.pdf» */
    fileName: function (meta) {
        var start = UI.formatDate(meta.startDate);
        var end = UI.formatDate(meta.endDate);
        var range = (start === end) ? start : (start + ' - ' + end);
        return 'Дневник график ' + range + '.pdf';
    },

    /* Собирает лист для съёмки: печатная вёрстка на белом фоне */
    buildSheet: function (meta) {
        var p = Graphs.param(meta.parameter);
        var s = meta.statistics;
        var period = UI.formatDate(meta.startDate);
        if (meta.startDate !== meta.endDate) period += ' — ' + UI.formatDate(meta.endDate);

        var profileCtx = Doctor.getProfileContext();
        var sheet = document.createElement('div');
        sheet.className = 'gr-sheet';

        // Стили вкладываем в сам лист — см. комментарий к sheetCss()
        var html = Graphs.sheetCss();

        html += '<div class="gr-sheet-head">' +
            '<h1>🩺 Мой домашний доктор</h1>' +
            '<h2>График измерений</h2>' +
            '<p><strong>Период:</strong> ' + UI.escapeHtml(period) + '</p>' +
            '<p><strong>Параметр:</strong> ' + UI.escapeHtml(p.name) + '</p>' +
            '</div>';

        if (profileCtx) {
            html += '<div class="gr-sheet-patient">' +
                UI.escapeHtml(profileCtx).replace(/\n/g, '<br>') + '</div>';
        }

        // Картинка графика берётся прямо из canvas Chart.js
        var chartCanvas = document.getElementById('gr-canvas');
        if (chartCanvas) {
            html += '<div class="gr-sheet-chart"><img src="' +
                chartCanvas.toDataURL('image/png') + '"></div>';
        }

        html += '<table class="gr-sheet-stats"><tr>' +
            '<td><strong>Всего измерений</strong><br>' + s.count + '</td>' +
            '<td><strong>Минимум</strong><br>' + s.min + '</td>' +
            '<td><strong>Максимум</strong><br>' + s.max + '</td>' +
            '<td><strong>Среднее</strong><br>' + s.avg + '</td>' +
            '</tr></table>';

        html += '<h3>Таблица измерений</h3>';
        html += Graphs.tableHtml(meta).replace('class="gr-table"', 'class="gr-sheet-table"');

        html += '<div class="gr-sheet-foot">Документ сформирован ' +
            new Date().toLocaleString('ru-RU') +
            '. Носит справочный характер и не является медицинским заключением.</div>';

        sheet.innerHTML = html;
        return sheet;
    },

    /* ======================================================================
     * ВЫХОД СО СТРАНИЦЫ ГРАФИКА
     * ==================================================================== */
    exit: function () {
        if (Graphs._chart) {
            Graphs._chart.destroy();
            Graphs._chart = null;
        }
        Graphs._meta = null;
        App.navigateTo('diary');
        Diary.show('list');
    }
};
