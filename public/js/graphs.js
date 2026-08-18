/* ============================================================================
 * ГРАФИКИ ИЗМЕРЕНИЙ — версия 3.6
 * Первая редакция по ТЗ v3.0, переработка по ТЗ v3.3 (пункты 3–7).
 *
 * Что изменилось по сравнению с версией 3.0:
 *   • показателей можно выбрать несколько, графики строятся все сразу;
 *   • точки окрашены по отклонению от индивидуальной нормы:
 *     белая — норма, жёлтая — в пределах шага тревоги, красная — дальше;
 *   • цвет линии у каждого показателя свой и не совпадает с цветом точек,
 *     поэтому линия показывает тренд, а точка — опасность;
 *   • гликемия разделена на «натощак» и «после еды», в подсказке видно,
 *     какое из двух значений показано.
 *
 * Chart.js лежит в папке vendor и попадает в кэш Service Worker, поэтому
 * раздел работает без интернета. Интернет нужен только кнопке
 * «Отправить доктору».
 * ========================================================================== */

var Graphs = {

    STORE_KEY: 'mdd_graphs',   // история построенных графиков
    MAX_STORED: 50,            // сколько графиков помним (localStorage не резиновый)

    /* ----------------------------------------------------------------------
     * Показатели, доступные для построения.
     *
     * series — линии внутри одного графика. У каждой линии свой цвет
     * (пункт 6 ТЗ) и своё поле в таблице норм, по которому красятся точки.
     * -------------------------------------------------------------------- */
    PARAMS: [
        {
            id: 'ad_bp', label: 'АД верхнее и нижнее', hint: 'две линии на одном графике',
            name: 'АД верх/низ (мм рт.ст)', axis: 'мм рт.ст', pad: 10,
            series: [
                { key: 'ad_top', label: 'АД верхнее (систолическое)', color: '#0D47A1', norm: 'ad_top' },
                { key: 'ad_bottom', label: 'АД нижнее (диастолическое)', color: '#4FC3F7', norm: 'ad_bottom' }
            ]
        },
        {
            id: 'pulse', label: 'Пульс', hint: 'уд/мин',
            name: 'Пульс (уд/мин)', axis: 'уд/мин', pad: 10,
            series: [{ key: 'pulse', label: 'Пульс', color: '#2E7D32', norm: 'pulse' }]
        },
        {
            id: 'spo2', label: 'Сатурация SpO2', hint: '%',
            name: 'SpO2 (%)', axis: '%', pad: 3,
            series: [{ key: 'spo2', label: 'Сатурация SpO2', color: '#7B1FA2', norm: 'spo2' }]
        },
        {
            id: 'sugar', label: 'Сахар (гликемия)', hint: 'натощак и после еды, ммоль/л',
            name: 'Гликемия (ммоль/л)', axis: 'ммоль/л', pad: 1,
            series: [
                { key: 'sugar', label: 'Гликемия натощак', color: '#EF6C00', norm: 'sugar' },
                { key: 'sugar_after', label: 'Гликемия после еды', color: '#FFB300', norm: 'sugar_after', dashed: true }
            ]
        },
        {
            id: 'temp', label: 'Температура', hint: '°C',
            name: 'Температура (°C)', axis: '°C', pad: 0.5,
            series: [{ key: 'temperature', label: 'Температура', color: '#795548', norm: 'temp' }]
        },
        {
            id: 'weight', label: 'Вес / ИМТ', hint: 'кг, точки красятся по ИМТ',
            name: 'Вес (кг)', axis: 'кг', pad: 1,
            series: [{ key: 'weight', label: 'Вес', color: '#00838F', norm: 'bmi', asBmi: true }]
        }
    ],

    /* Цвета точек по классификации (пункт 5 ТЗ) */
    POINT: {
        '': '#FFFFFF',          // норма — белая точка в цветной обводке
        warn: '#FFC107',        // отклонение в пределах одного шага тревоги
        danger: '#D32F2F'       // отклонение дальше шага
    },

    /* --- Состояние --------------------------------------------------------- */
    _charts: [],         // построенные объекты Chart.js
    _metas: [],          // метаданные построенных графиков
    _days: [],           // дни, выбранные в дневнике

    param: function (id) {
        for (var i = 0; i < Graphs.PARAMS.length; i++) {
            if (Graphs.PARAMS[i].id === id) return Graphs.PARAMS[i];
        }
        return null;
    },

    /* ======================================================================
     * ХРАНИЛИЩЕ ГРАФИКОВ
     * ==================================================================== */
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
     * ШАГ 1. КНОПКА «СОЗДАТЬ ГРАФИКИ»
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
     * ВЫБОР ПОКАЗАТЕЛЕЙ (пункт 3 ТЗ)
     * Раньше выбирали один показатель переключателем, теперь галочками
     * можно отметить сразу несколько.
     * ==================================================================== */
    openParamDialog: function (days) {
        var overlay = document.getElementById('gr-modal');
        if (!overlay) return;

        var html = '<div class="gr-window">' +
            '<div class="gr-mhead">' +
            '<h3>📈 Выберите показатели для графиков</h3>' +
            '<button class="gr-close" onclick="Graphs.closeParamDialog()" title="Закрыть">✕</button>' +
            '</div>' +
            '<div class="gr-mbody">' +
            '<p class="gr-mhint">Можно отметить несколько — графики построятся ' +
            'один под другим в одном документе.</p>' +
            '<div class="gr-options">';

        for (var i = 0; i < Graphs.PARAMS.length; i++) {
            var p = Graphs.PARAMS[i];
            html += '<label class="gr-option">' +
                '<input type="checkbox" name="gr-param" value="' + p.id + '"' +
                (p.id === 'ad_bp' ? ' checked' : '') + '>' +
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
        var boxes = document.querySelectorAll('input[name="gr-param"]:checked');
        if (boxes.length === 0) {
            UI.showToast('Отметьте хотя бы один показатель!', 3000);
            return;
        }

        var ids = [];
        for (var i = 0; i < boxes.length; i++) ids.push(boxes[i].value);

        Graphs.closeParamDialog();
        Graphs.build(Graphs._days, ids);
    },

    /* ======================================================================
     * ШАГ 2. СБОР ДАННЫХ
     * ==================================================================== */
    collect: function (days, paramId) {
        var p = Graphs.param(paramId);
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
                    timestamp: new Date(day + 'T' + m.time + ':00').getTime(),
                    values: {}
                };

                // Строка попадает на график, если заполнена хотя бы одна линия
                var any = false;
                for (var s = 0; s < p.series.length; s++) {
                    var v = m[p.series[s].key];
                    if (v === null || v === undefined || v === '') {
                        point.values[p.series[s].key] = null;
                    } else {
                        point.values[p.series[s].key] = v;
                        any = true;
                    }
                }
                if (!any) continue;

                out.push(point);
            }
        }

        out.sort(function (a, b) { return a.timestamp - b.timestamp; });
        return out;
    },

    /* Статистика по всем линиям графика вместе */
    stats: function (points, paramId) {
        var p = Graphs.param(paramId);
        var vals = [];

        for (var i = 0; i < points.length; i++) {
            for (var s = 0; s < p.series.length; s++) {
                var v = points[i].values[p.series[s].key];
                if (v !== null && v !== undefined) vals.push(Number(v));
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
     * ШАГ 3. ПОСТРОЕНИЕ ГРАФИКОВ
     * ==================================================================== */
    build: function (days, paramIds) {
        var sorted = days.slice().sort();
        var metas = [];
        var missing = [];

        for (var i = 0; i < paramIds.length; i++) {
            var id = paramIds[i];
            var points = Graphs.collect(days, id);

            if (points.length === 0) {
                missing.push(Graphs.param(id).label);
                continue;
            }

            metas.push({
                id: Graphs.newId(),
                parameter: id,
                parameterName: Graphs.param(id).name,
                startDate: sorted[0],
                endDate: sorted[sorted.length - 1],
                selectedDays: sorted,
                measurements: points,
                statistics: Graphs.stats(points, id),
                createdAt: new Date().toISOString(),
                status: 'created'
            });
        }

        if (metas.length === 0) {
            UI.showToast('В выбранных днях нет измерений по этим показателям', 4500);
            return;
        }
        if (missing.length > 0) {
            UI.showToast('Нет измерений: ' + missing.join(', ') +
                '. Остальные графики построены.', 4500);
        }

        Graphs._metas = metas;
        for (var k = 0; k < metas.length; k++) Graphs.save(metas[k]);

        Graphs.openPage();
    },

    /* ======================================================================
     * СТРАНИЦА ГРАФИКОВ
     * ==================================================================== */
    openPage: function () {
        App.navigateTo('graphs');
        Graphs.renderPage();
    },

    period: function () {
        var meta = Graphs._metas[0];
        var period = UI.formatDate(meta.startDate);
        if (meta.startDate !== meta.endDate) {
            period += ' — ' + UI.formatDate(meta.endDate);
        }
        return period;
    },

    renderPage: function () {
        var host = document.getElementById('graphs-root');
        if (!host || Graphs._metas.length === 0) return;

        var many = Graphs._metas.length > 1;
        var html = '';

        html += '<div class="gr-head">' +
            '<button class="dv-back" onclick="Graphs.exit()">← Выйти</button>' +
            '<h2 class="gr-title">📈 ' + (many ? 'Графики измерений' : 'График измерений') + '</h2>' +
            '<p class="gr-period">' + UI.escapeHtml(Graphs.period()) + '</p>' +
            '<p class="gr-param">' + (many ? 'Показателей: ' + Graphs._metas.length : 'Показатель: ' +
                UI.escapeHtml(Graphs.param(Graphs._metas[0].parameter).name)) + '</p>' +
            '</div>';

        for (var i = 0; i < Graphs._metas.length; i++) {
            var meta = Graphs._metas[i];
            var p = Graphs.param(meta.parameter);
            var s = meta.statistics;

            html += '<div class="gr-block">';
            html += '<div class="gr-canvas-box"><canvas id="gr-canvas-' + i + '"></canvas></div>';
            html += Graphs.pointLegend();
            html += '<div class="gr-stats">' +
                Graphs.statBox('Всего измерений', s.count) +
                Graphs.statBox('Минимум', s.min) +
                Graphs.statBox('Максимум', s.max) +
                Graphs.statBox('Среднее', s.avg) +
                '</div>';
            html += '</div>';
        }

        // Таблица значений — сворачиваемая, чтобы не загромождать экран
        html += '<button class="gr-toggle" onclick="Graphs.toggleTable()">' +
            '<span id="gr-toggle-text">Показать таблицу значений</span></button>';
        html += '<div class="gr-tablewrap" id="gr-tablewrap" style="display:none">' +
            Graphs.tableHtml() + '</div>';

        html += '<div class="gr-buttons">' +
            '<button class="btn btn-primary" onclick="Graphs.sendToDoctor()">🩺 Отправить доктору</button>' +
            '<button class="btn btn-outline" onclick="Graphs.exportPDF()">📄 Записать в PDF</button>' +
            '<button class="btn btn-outline" onclick="Graphs.exit()">❌ Выйти</button>' +
            '</div>';

        host.innerHTML = html;
        Graphs.drawAll();
    },

    /* Пояснение к цвету точек (пункт 5 ТЗ) */
    pointLegend: function () {
        return '<p class="gr-plegend">' +
            '<span class="gr-pdot gr-pdot-norm"></span> норма · ' +
            '<span class="gr-pdot gr-pdot-warn"></span> внимание · ' +
            '<span class="gr-pdot gr-pdot-danger"></span> критично</p>';
    },

    statBox: function (label, value) {
        return '<div class="gr-stat">' +
            '<span class="gr-stat-label">' + label + '</span>' +
            '<span class="gr-stat-value">' + value + '</span></div>';
    },

    /* ======================================================================
     * ОБЩАЯ ТАБЛИЦА ЗНАЧЕНИЙ (пункт 4 ТЗ)
     * Колонки — все выбранные показатели, строки — все измерения периода.
     * ==================================================================== */
    columns: function () {
        var cols = [];
        for (var i = 0; i < Graphs._metas.length; i++) {
            var p = Graphs.param(Graphs._metas[i].parameter);
            for (var s = 0; s < p.series.length; s++) {
                cols.push(p.series[s]);
            }
        }
        return cols;
    },

    /* Все измерения выбранных дней в одном списке */
    allRows: function () {
        var days = Graphs._metas[0].selectedDays;
        var records = Diary.getRecords();
        var cols = Graphs.columns();
        var out = [];

        for (var i = 0; i < days.length; i++) {
            var rec = records[days[i]];
            if (!rec || !rec.measurements) continue;

            for (var j = 0; j < rec.measurements.length; j++) {
                var m = rec.measurements[j];
                if (!m.time) continue;

                var any = false;
                for (var c = 0; c < cols.length; c++) {
                    var v = m[cols[c].key];
                    if (v !== null && v !== undefined && v !== '') any = true;
                }
                if (!any) continue;

                out.push({
                    date: days[i], time: m.time, m: m,
                    timestamp: new Date(days[i] + 'T' + m.time + ':00').getTime()
                });
            }
        }
        out.sort(function (a, b) { return a.timestamp - b.timestamp; });
        return out;
    },

    tableHtml: function (cls) {
        var cols = Graphs.columns();
        var rows = Graphs.allRows();

        var html = '<table class="' + (cls || 'gr-table') + '"><thead><tr>' +
            '<th>Дата</th><th>Время</th>';
        for (var c = 0; c < cols.length; c++) {
            html += '<th>' + UI.escapeHtml(cols[c].label) + '</th>';
        }
        html += '</tr></thead><tbody>';

        for (var i = 0; i < rows.length; i++) {
            html += '<tr>' +
                '<td>' + UI.escapeHtml(Diary.formatDate(rows[i].date)) + '</td>' +
                '<td>' + UI.escapeHtml(rows[i].time) + '</td>';
            for (var k = 0; k < cols.length; k++) {
                var v = rows[i].m[cols[k].key];
                html += '<td>' + ((v === null || v === undefined || v === '') ? '—' : v) + '</td>';
            }
            html += '</tr>';
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
     * РИСОВАНИЕ (Chart.js)
     * ==================================================================== */
    drawAll: function () {
        for (var i = 0; i < Graphs._charts.length; i++) {
            if (Graphs._charts[i]) Graphs._charts[i].destroy();
        }
        Graphs._charts = [];

        for (var k = 0; k < Graphs._metas.length; k++) {
            Graphs._charts.push(Graphs.draw(k));
        }
    },

    /* ----------------------------------------------------------------------
     * Цвет каждой точки по отклонению от индивидуальной нормы (пункт 5 ТЗ).
     * Белая точка на белом фоне была бы не видна, поэтому она рисуется
     * с обводкой цвета своей линии — получается «пустой» кружок, как
     * и в легенде.
     * -------------------------------------------------------------------- */
    pointColors: function (values, serie, article, height) {
        var fill = [];
        var border = [];
        var radius = [];

        for (var i = 0; i < values.length; i++) {
            var v = values[i];
            var check = null;

            if (v !== null && v !== undefined && article) {
                var forNorm = serie.asBmi ? Norms.bmi(v, height) : v;
                check = Norms.check(article, serie.norm, forNorm);
            }

            var level = check ? check.level : '';
            fill.push(Graphs.POINT[level]);
            border.push(level ? Graphs.POINT[level] : serie.color);
            radius.push(level ? 6 : 4);
        }
        return { fill: fill, border: border, radius: radius };
    },

    draw: function (index) {
        var canvas = document.getElementById('gr-canvas-' + index);
        var meta = Graphs._metas[index];
        if (!canvas || !meta) return null;

        var p = Graphs.param(meta.parameter);
        var points = meta.measurements;

        var profile = Storage.getActiveProfile();
        var height = profile ? profile.height : null;
        var article = Norms.articleFor(profile);

        // Подписи по оси X: если период больше одного дня — с датой
        var multiDay = meta.startDate !== meta.endDate;
        var labels = points.map(function (m) {
            return multiDay ? (Diary.formatDate(m.date).slice(0, 5) + ' ' + m.time) : m.time;
        });

        var datasets = [];
        var allValues = [];

        for (var s = 0; s < p.series.length; s++) {
            var serie = p.series[s];
            var vals = points.map(function (m) {
                var v = m.values[serie.key];
                return (v === null || v === undefined) ? null : v;
            });

            for (var v = 0; v < vals.length; v++) {
                if (vals[v] !== null) allValues.push(Number(vals[v]));
            }

            var colors = Graphs.pointColors(vals, serie, article, height);

            datasets.push({
                label: serie.label,
                data: vals,
                borderColor: serie.color,
                backgroundColor: Graphs.fade(serie.color),
                borderWidth: 3,
                borderDash: serie.dashed ? [6, 4] : [],
                pointBackgroundColor: colors.fill,
                pointBorderColor: colors.border,
                pointBorderWidth: 2,
                pointRadius: colors.radius,
                pointHoverRadius: 7,
                fill: false,
                spanGaps: true,
                tension: 0.3,
                _unit: p.axis
            });
        }

        if (allValues.length === 0) return null;

        var min = Math.min.apply(null, allValues) - p.pad;
        var max = Math.max.apply(null, allValues) + p.pad;

        return new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels: labels, datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,          // ускоряет отрисовку и печать
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    title: {
                        display: true,
                        text: p.name,
                        font: { size: 16, weight: 'bold' },
                        color: '#0D47A1'
                    },
                    legend: {
                        display: p.series.length > 1,
                        position: 'top',
                        labels: { font: { size: 13 }, boxWidth: 24 }
                    },
                    tooltip: {
                        callbacks: {
                            // Пункт 7 ТЗ: в подсказке видно, натощак измерение
                            // или после еды — название линии это уже говорит
                            label: function (ctx) {
                                if (ctx.parsed.y === null) return '';
                                return ctx.dataset.label + ': ' + ctx.parsed.y +
                                    ' ' + ctx.dataset._unit;
                            }
                        }
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
     * ОТПРАВКА ДОКТОРУ
     * ==================================================================== */
    sendToDoctor: function () {
        if (Graphs._metas.length === 0) return;

        var names = Graphs._metas.map(function (m) {
            return Graphs.param(m.parameter).name;
        }).join(', ');

        UI.showConfirm(
            'Отправить доктору?',
            'Данные за ' + Graphs.period() + ' по показателям: ' + names +
            ' будут отправлены ИИ-доктору для анализа. Вопрос и ответ появятся ' +
            'в чате раздела «Доктор».',
            'Отправить',
            function () {
                for (var i = 0; i < Graphs._metas.length; i++) {
                    Graphs._metas[i].consultedAt = new Date().toISOString();
                    Graphs.save(Graphs._metas[i]);
                }
                Doctor.sendFromApp(Graphs.buildPrompt());
            }
        );
    },

    buildPrompt: function () {
        var lines = ['ГРАФИКИ ИЗМЕРЕНИЙ'];
        lines.push('Период: ' + Graphs.period());
        lines.push('');

        for (var i = 0; i < Graphs._metas.length; i++) {
            var meta = Graphs._metas[i];
            var p = Graphs.param(meta.parameter);
            var s = meta.statistics;

            lines.push(p.name.toUpperCase());
            lines.push('Измерений: ' + s.count + ', минимум ' + s.min +
                ', максимум ' + s.max + ', среднее ' + s.avg);

            for (var j = 0; j < meta.measurements.length; j++) {
                var m = meta.measurements[j];
                var parts = [];
                for (var k = 0; k < p.series.length; k++) {
                    var v = m.values[p.series[k].key];
                    if (v === null || v === undefined) continue;
                    parts.push((p.series.length > 1 ? p.series[k].label + ' ' : '') + v);
                }
                if (parts.length === 0) continue;
                lines.push(Diary.formatDate(m.date) + ' ' + m.time + ': ' + parts.join(', '));
            }
            lines.push('');
        }

        lines.push('Проанализируйте эти данные, обратите внимание на тренды и колебания. ' +
            'Дайте профессиональную рекомендацию.');
        return lines.join('\n');
    },

    /* ======================================================================
     * ВЫГРУЗКА ДОКУМЕНТА
     *
     * Документ отдаётся браузеру на печать: графики вставляются картинками
     * из canvas Chart.js, таблица остаётся настоящей таблицей, поэтому
     * браузер не рвёт её строки между страницами. У картинок явно заданы
     * размеры — иначе документ иногда уходил на печать раньше, чем график
     * успевал раскодироваться, и страница выходила пустой.
     * ==================================================================== */
    exportPDF: function () {
        if (Graphs._metas.length === 0) return;

        var many = Graphs._metas.length > 1;
        var body = '<h2>' + (many ? 'Графики измерений' : 'График измерений') + '</h2>' +
            '<p><strong>Период:</strong> ' + UI.escapeHtml(Graphs.period()) + '</p>';

        for (var i = 0; i < Graphs._metas.length; i++) {
            var meta = Graphs._metas[i];
            var p = Graphs.param(meta.parameter);
            var s = meta.statistics;
            var canvas = document.getElementById('gr-canvas-' + i);

            body += '<h3>' + UI.escapeHtml(p.name) + '</h3>';

            if (canvas) {
                body += '<div class="chart-box"><img src="' + canvas.toDataURL('image/png') +
                    '" width="' + canvas.width + '" height="' + canvas.height + '"' +
                    ' alt="' + UI.escapeHtml(p.name) + '"' +
                    ' style="width:100%;max-width:720px;height:auto"></div>';
            }

            body += '<p style="text-align:center;font-size:12px;color:#555">' +
                '◯ норма · ● внимание (жёлтая точка) · ● критично (красная точка)</p>';

            body += '<table class="grid"><tr>' +
                '<th>Всего измерений</th><th>Минимум</th><th>Максимум</th><th>Среднее</th>' +
                '</tr><tr>' +
                '<td>' + s.count + '</td><td>' + s.min + '</td>' +
                '<td>' + s.max + '</td><td>' + s.avg + '</td>' +
                '</tr></table>';
        }

        body += '<h3>Таблица измерений</h3>';
        body += Graphs.tableHtml('grid');

        // Статистика за тот же период по всем показателям — считается тем же
        // кодом, что и в дневнике, чтобы цифры в двух документах не расходились
        var records = Diary.getRecords();
        var days = Graphs._metas[0].selectedDays;
        var list = [];
        for (var d = 0; d < days.length; d++) {
            var rec = records[days[d]];
            if (rec && Diary.validRows(rec.measurements).length > 0) list.push(rec);
        }
        if (list.length > 0) {
            list.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
            body += Period.statsHtml(list);
        }

        Diary.printDocument((many ? 'Графики' : 'График') + ' — ' + Graphs.period(), body);

        for (var k = 0; k < Graphs._metas.length; k++) {
            Graphs._metas[k].pdfInfo = {
                filename: Graphs.fileName(),
                savedAt: new Date().toISOString(),
                status: 'printed'
            };
            Graphs.save(Graphs._metas[k]);
        }
    },

    fileName: function () {
        return 'Дневник графики ' + Graphs.period() + '.pdf';
    },

    /* ======================================================================
     * ВЫХОД СО СТРАНИЦЫ ГРАФИКОВ
     * ==================================================================== */
    exit: function () {
        for (var i = 0; i < Graphs._charts.length; i++) {
            if (Graphs._charts[i]) Graphs._charts[i].destroy();
        }
        Graphs._charts = [];
        Graphs._metas = [];
        App.navigateTo('diary');
        Diary.show('list');
    }
};
