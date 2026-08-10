/* ============================================================================
 * ПЕЧАТЬ ДНЕВНИКА ЗА ПЕРИОД — версия 3.2
 * Реализация по ТЗ v3.1, доработка №2; исправления по ТЗ части 3, пп. 6 и 8.
 *
 * Пользователь отмечает нужные дни в дневнике и получает ОДИН документ
 * вместо отдельного на каждый день: сводная таблица с разделителями по дням
 * плюс статистика за весь период.
 *
 * Пункт 8 ТЗ. Раньше лист снимался в картинку через html2canvas и вставлялся
 * в PDF картинкой — на смартфоне документ обрезался по краям и по высоте.
 * Теперь используется тот же механизм, что у кнопки «🖨️ / 📄»: обычная
 * страница отдаётся браузеру на печать, а браузер сам верстает её по
 * страницам и предлагает «Сохранить как PDF». Обрезать нечего.
 *
 * Пункт 6 ТЗ. Столбец «Вне границ» считался по фиксированным порогам
 * (выше 140, выше 90 и т.д.) и почти всегда показывал «нет», хотя дневник
 * отмечал отклонения. Теперь он считается по той же индивидуальной норме
 * из карточки профиля, что и отклонения в записях.
 * ========================================================================== */

var Period = {

    /* Соответствие полей измерения полям таблицы норм */
    NORM_FIELD: {
        ad_top: 'ad_top',
        ad_bottom: 'ad_bottom',
        pulse: 'pulse',
        spo2: 'spo2',
        sugar: 'sugar',
        temperature: 'temp'
    },

    /* ======================================================================
     * ГЛАВНАЯ ФУНКЦИЯ
     * ==================================================================== */
    print: function () {
        var days = Diary._selectedDays.slice().sort();

        // Валидация: без отмеченных дней печатать нечего
        if (days.length === 0) {
            UI.showToast('Отметьте галочками хотя бы один день для печати!', 3500);
            return;
        }

        var records = Diary.getRecords();
        var list = [];
        for (var i = 0; i < days.length; i++) {
            var rec = records[days[i]];
            if (rec && Diary.validRows(rec.measurements).length > 0) {
                list.push(rec);
            }
        }

        if (list.length === 0) {
            UI.showToast('В выбранных днях нет заполненных измерений', 4000);
            return;
        }

        var start = UI.formatDate(list[0].date);
        var end = UI.formatDate(list[list.length - 1].date);
        var period = (start === end) ? start : (start + ' — ' + end);

        var body = '<h2>Дневник здоровья за период</h2>' +
            '<p><strong>Период:</strong> ' + UI.escapeHtml(period) + '<br>' +
            '<strong>Дней в документе:</strong> ' + list.length + '</p>' +
            Period.tableHtml(list) +
            Period.statsHtml(list);

        Diary.printDocument('Дневник — ' + period, body);
    },

    /* ======================================================================
     * СВОДНАЯ ТАБЛИЦА
     * Одна таблица на весь период; каждый день открывается строкой-разделителем.
     * ==================================================================== */
    tableHtml: function (list) {
        var html = '<table class="grid"><tr>' +
            '<th>Время</th><th>АД верх</th><th>АД низ</th><th>Пульс</th>' +
            '<th>SpO2, %</th><th>Сахар</th><th>t°</th><th>Вес</th><th>ИМТ</th>' +
            '</tr>';

        for (var i = 0; i < list.length; i++) {
            var rec = list[i];
            var rows = Diary.validRows(rec.measurements);
            rows.sort(function (a, b) { return a.time < b.time ? -1 : 1; });

            html += '<tr><td colspan="9" style="background:#DCDCDC;font-weight:bold;' +
                'text-align:left;padding:7px 8px">' +
                UI.escapeHtml(UI.formatDate(rec.date)) +
                ' <span style="font-weight:normal;color:#555">' + rows.length +
                Diary.plural(rows.length, ' измерение', ' измерения', ' измерений') +
                '</span></td></tr>';

            for (var j = 0; j < rows.length; j++) {
                var m = rows[j];
                html += '<tr>' +
                    '<td>' + UI.escapeHtml(m.time || '') + '</td>' +
                    '<td>' + Diary.cellText(m.ad_top) + '</td>' +
                    '<td>' + Diary.cellText(m.ad_bottom) + '</td>' +
                    '<td>' + Diary.cellText(m.pulse) + '</td>' +
                    '<td>' + Diary.cellText(m.spo2) + '</td>' +
                    '<td>' + Diary.cellText(m.sugar) + '</td>' +
                    '<td>' + Diary.cellText(m.temperature) + '</td>' +
                    '<td>' + Diary.cellText(m.weight) + '</td>' +
                    '<td>' + Diary.cellText(Norms.bmiFor(m.weight)) + '</td>' +
                    '</tr>';
            }
        }

        return html + '</table>';
    },

    /* ======================================================================
     * СТАТИСТИКА ЗА ПЕРИОД
     * ==================================================================== */
    stats: function (list) {
        var acc = {
            ad_top: [], ad_bottom: [], pulse: [], spo2: [], sugar: [], temperature: []
        };
        var weights = [];
        var total = 0;

        for (var i = 0; i < list.length; i++) {
            var rows = Diary.validRows(list[i].measurements);
            rows.sort(function (a, b) { return a.time < b.time ? -1 : 1; });
            total += rows.length;

            for (var j = 0; j < rows.length; j++) {
                var m = rows[j];
                for (var f in acc) {
                    if (acc.hasOwnProperty(f) && m[f] !== null &&
                        m[f] !== undefined && m[f] !== '') {
                        acc[f].push(m[f]);
                    }
                }
                if (m.weight !== null && m.weight !== undefined && m.weight !== '') {
                    weights.push(m.weight);
                }
            }
        }

        var article = Diary.article();
        var out = {
            days: list.length, total: total, params: [],
            weight: null, article: article
        };

        var order = [
            { key: 'ad_top', name: 'Давление верхнее (систолическое)', unit: 'мм рт.ст' },
            { key: 'ad_bottom', name: 'Давление нижнее (диастолическое)', unit: 'мм рт.ст' },
            { key: 'pulse', name: 'Пульс', unit: 'уд/мин' },
            { key: 'spo2', name: 'Сатурация SpO2', unit: '%' },
            { key: 'sugar', name: 'Сахар крови', unit: 'ммоль/л' },
            { key: 'temperature', name: 'Температура', unit: '°C' }
        ];

        for (var k = 0; k < order.length; k++) {
            var o = order[k];
            var vals = acc[o.key];
            if (vals.length === 0) continue;

            var outside = Period.countOut(vals, o.key, article);
            out.params.push({
                name: o.name,
                unit: o.unit,
                min: Period.round(Math.min.apply(null, vals)),
                max: Period.round(Math.max.apply(null, vals)),
                avg: Period.round(Period.sum(vals) / vals.length),
                over: outside.count,
                norm: outside.norm
            });
        }

        // Вес — начало, конец и разница: среднее для веса смысла не имеет
        if (weights.length > 0) {
            var first = weights[0];
            var last = weights[weights.length - 1];
            out.weight = {
                first: Period.round(first),
                last: Period.round(last),
                change: Period.round(last - first)
            };
        }

        return out;
    },

    /* ----------------------------------------------------------------------
     * Пункт 6 ТЗ: сколько измерений вышло за индивидуальную норму профиля.
     * Считается ровно тем же Norms.check, что и отклонения в записях дня,
     * поэтому расхождения между дневником и статистикой больше нет.
     * -------------------------------------------------------------------- */
    countOut: function (vals, key, article) {
        var field = Period.NORM_FIELD[key];
        if (!article || !field || !article[field]) {
            return { count: null, norm: null };
        }

        var range = article[field];
        var n = 0;
        for (var i = 0; i < vals.length; i++) {
            var res = Norms.check(article, field, vals[i]);
            if (res && res.level) n++;
        }
        return { count: n, norm: range[0] + '–' + range[1] };
    },

    sum: function (vals) {
        var s = 0;
        for (var i = 0; i < vals.length; i++) s += vals[i];
        return s;
    },

    round: function (v) {
        return Math.round(v * 10) / 10;
    },

    statsHtml: function (list) {
        var s = Period.stats(list);

        var html = '<h3>Статистика за период</h3>';
        html += '<p>Дней: <strong>' + s.days + '</strong> · ' +
            'Всего измерений: <strong>' + s.total + '</strong></p>';

        html += '<table class="grid"><tr>' +
            '<th>Показатель</th><th>Минимум</th><th>Максимум</th>' +
            '<th>Среднее</th><th>Норма</th><th>Вне нормы</th></tr>';

        for (var i = 0; i < s.params.length; i++) {
            var p = s.params[i];

            var outText;
            if (p.over === null) {
                outText = '—';
            } else if (p.over > 0) {
                outText = '<span style="color:#B71C1C;font-weight:bold">' + p.over +
                    Diary.plural(p.over, ' раз', ' раза', ' раз') + '</span>';
            } else {
                outText = 'нет';
            }

            html += '<tr>' +
                '<td style="text-align:left">' + UI.escapeHtml(p.name) +
                ', ' + UI.escapeHtml(p.unit) + '</td>' +
                '<td>' + p.min + '</td>' +
                '<td>' + p.max + '</td>' +
                '<td>' + p.avg + '</td>' +
                '<td>' + (p.norm || '—') + '</td>' +
                '<td>' + outText + '</td></tr>';
        }

        html += '</table>';

        if (s.weight) {
            var sign = s.weight.change > 0 ? '+' : '';
            html += '<p><strong>Вес:</strong> в начале периода ' +
                s.weight.first + ' кг, в конце ' + s.weight.last + ' кг ' +
                '(изменение ' + sign + s.weight.change + ' кг)</p>';
        }

        if (s.article) {
            html += '<p style="font-size:12px;color:#555">Норма подобрана по карточке ' +
                'профиля: <strong>' + UI.escapeHtml(s.article.title) + '</strong>. ' +
                'Вне нормы считаются значения, отклонившиеся от границы диапазона ' +
                'на 5% и больше.<br>⚠️ ' + UI.escapeHtml(Norms.COMMON_NOTE) + '</p>';
        } else {
            html += '<p style="font-size:12px;color:#555">Норма не подобрана: ' +
                'в карточке профиля не заполнены дата рождения, рост или диагнозы.</p>';
        }

        return html;
    }
};
