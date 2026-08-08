/* ============================================================================
 * ПЕЧАТЬ ДНЕВНИКА ЗА ПЕРИОД — версия 3.1
 * Реализация по ТЗ v3.1, доработка №2.
 *
 * Пользователь отмечает нужные дни в дневнике и получает ОДИН файл PDF
 * вместо отдельного документа на каждый день: сводная таблица с
 * разделителями по дням плюс статистика за весь период.
 *
 * Кириллица: встроенные шрифты jsPDF её не содержат, поэтому лист
 * собирается как обычная HTML-вёрстка, снимается html2canvas в картинку
 * и уже картинка кладётся в PDF — так же, как сделано для графиков.
 * ========================================================================== */

var Period = {

    _busy: false,

    /* --- Границы для подсчёта выходов за норму (раздел 3.5 ТЗ) ------------- */
    LIMITS: {
        ad_top: { over: 140, label: 'выше 140' },
        ad_bottom: { over: 90, label: 'выше 90' },
        pulse: { over: 100, label: 'выше 100' },
        spo2: { under: 92, label: 'ниже 92' },
        sugar: { over: 7.0, label: 'выше 7.0' },
        temperature: { over: 37.5, label: 'выше 37.5' }
    },

    /* ======================================================================
     * ГЛАВНАЯ ФУНКЦИЯ
     * ==================================================================== */
    print: function () {
        if (Period._busy) {
            UI.showToast('Документ уже готовится, подождите');
            return;
        }

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

        Period._busy = true;
        UI.showToast('Создаю PDF...', 4000);

        var sheet = Period.buildSheet(list);
        document.body.appendChild(sheet);

        // Ждём отрисовки листа и снимаем его с явной шириной виртуального
        // окна — иначе на смартфоне документ обрезается (см. Graphs.shotOptions)
        Graphs.waitImages(sheet).then(function () {
            return html2canvas(sheet, Graphs.shotOptions(sheet));
        })
            .then(function (canvas) {
                document.body.removeChild(sheet);
                Period.toPDF(canvas, list);
            })
            .catch(function (err) {
                if (sheet.parentNode) document.body.removeChild(sheet);
                Period._busy = false;
                UI.showToast('Не удалось создать PDF: ' +
                    (err && err.message ? err.message : 'ошибка'), 4500);
            });
    },

    /* Раскладывает снятый лист по страницам A4 */
    toPDF: function (canvas, list) {
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
            var usableH = pageH - margin * 2;
            var offset = 0;
            while (offset < imgH) {
                pdf.addImage(image, 'JPEG', margin, margin - offset, imgW, imgH);
                offset += usableH;
                if (offset < imgH) pdf.addPage();
            }
        }

        var name = Period.fileName(list);
        pdf.save(name);

        Period._busy = false;
        UI.showToast('PDF сохранён: ' + name, 5000);
    },

    /* Имя файла по образцу ТЗ: «Дневник 14 июля 2026 - 20 июля 2026.pdf» */
    fileName: function (list) {
        var start = UI.formatDate(list[0].date);
        var end = UI.formatDate(list[list.length - 1].date);
        var range = (start === end) ? start : (start + ' - ' + end);
        return 'Дневник ' + range + '.pdf';
    },

    /* ======================================================================
     * СБОРКА ЛИСТА
     * ==================================================================== */

    /* Стили вкладываются в сам лист, а не берутся из внешнего файла:
       html2canvas рисует копию страницы в отдельном окне и на смартфоне
       не успевал подтянуть внешний CSS — документ выходил без оформления */
    sheetCss: function () {
        return '<style>' +
            '.pd-sheet{position:fixed;left:-10000px;top:0;width:780px;background:#FFF;' +
            'color:#222;font-family:Arial,Helvetica,sans-serif;font-size:13px;' +
            'line-height:1.45;padding:28px;box-sizing:border-box}' +
            '.pd-sheet *{box-sizing:border-box}' +
            '.pd-head{text-align:center;border-bottom:2px solid #0066CC;' +
            'padding-bottom:12px;margin-bottom:16px}' +
            '.pd-head h1{margin:0;font-size:20px;color:#0066CC}' +
            '.pd-head h2{margin:6px 0 8px;font-size:16px;color:#0D47A1}' +
            '.pd-head p{margin:2px 0;font-size:13px}' +
            '.pd-patient{background:#E6F2FF;border-radius:8px;padding:10px 14px;' +
            'margin-bottom:16px;font-size:12px}' +
            '.pd-table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px}' +
            '.pd-table th{background:#0066CC;color:#FFF;border:1px solid #CCC;' +
            'padding:7px 5px;text-align:center;font-size:12px}' +
            '.pd-table td{border:1px solid #CCC;padding:5px;text-align:center}' +
            '.pd-table tr.pd-day td{background:#DCDCDC;font-weight:bold;text-align:left;' +
            'font-size:13px;padding:7px 8px}' +
            '.pd-day-count{font-weight:normal;color:#555;font-size:12px}' +
            '.pd-h3{font-size:15px;color:#0066CC;margin:0 0 6px}' +
            '.pd-total{margin:0 0 10px;font-size:13px}' +
            '.pd-stats{width:100%;border-collapse:collapse;font-size:12px}' +
            '.pd-stats th{background:#0066CC;color:#FFF;border:1px solid #CCC;' +
            'padding:6px 5px;text-align:center}' +
            '.pd-stats td{border:1px solid #CCC;padding:5px 6px;text-align:center}' +
            '.pd-stats tr:nth-child(even) td{background:#F9F9F9}' +
            '.pd-stats td.pd-left{text-align:left}' +
            '.pd-over{color:#B71C1C;font-weight:bold}' +
            '.pd-weight{margin-top:10px;font-size:13px}' +
            '.pd-foot{margin-top:18px;padding-top:10px;border-top:1px solid #DDD;' +
            'text-align:center;color:#999;font-size:11px}' +
            '</style>';
    },
    buildSheet: function (list) {
        var sheet = document.createElement('div');
        sheet.className = 'pd-sheet';

        var start = UI.formatDate(list[0].date);
        var css = Period.sheetCss();
        var end = UI.formatDate(list[list.length - 1].date);
        var period = (start === end) ? start : (start + ' — ' + end);
        var profileCtx = Doctor.getProfileContext();

        var html = css +
            '<div class="pd-head">' +
            '<h1>🩺 Мой домашний доктор</h1>' +
            '<h2>Дневник здоровья</h2>' +
            '<p><strong>Период:</strong> ' + UI.escapeHtml(period) + '</p>' +
            '<p><strong>Дней в документе:</strong> ' + list.length + '</p>' +
            '</div>';

        if (profileCtx) {
            html += '<div class="pd-patient">' +
                UI.escapeHtml(profileCtx).replace(/\n/g, '<br>') + '</div>';
        }

        html += Period.tableHtml(list);
        html += Period.statsHtml(list);

        html += '<div class="pd-foot">Документ сформирован ' +
            new Date().toLocaleString('ru-RU') +
            '. Носит справочный характер и не является медицинским заключением.</div>';

        sheet.innerHTML = html;
        return sheet;
    },

    /* Одна сводная таблица; каждый день открывается строкой-разделителем */
    tableHtml: function (list) {
        var html = '<table class="pd-table"><thead><tr>' +
            '<th>Время</th><th>АД</th><th>Пульс</th><th>SpO2</th>' +
            '<th>Сахар</th><th>t°</th><th>Вес / ИМТ</th>' +
            '</tr></thead><tbody>';

        for (var i = 0; i < list.length; i++) {
            var rec = list[i];
            var rows = Diary.validRows(rec.measurements);
            rows.sort(function (a, b) { return a.time < b.time ? -1 : 1; });

            html += '<tr class="pd-day"><td colspan="7">' +
                UI.escapeHtml(UI.formatDate(rec.date)) +
                ' <span class="pd-day-count">' + rows.length +
                Diary.plural(rows.length, ' измерение', ' измерения', ' измерений') +
                '</span></td></tr>';

            for (var j = 0; j < rows.length; j++) {
                var m = rows[j];
                var ad = (m.ad_top && m.ad_bottom) ? (m.ad_top + '/' + m.ad_bottom) : '—';
                html += '<tr>' +
                    '<td>' + UI.escapeHtml(m.time) + '</td>' +
                    '<td>' + ad + '</td>' +
                    '<td>' + Period.cell(m.pulse) + '</td>' +
                    '<td>' + Period.cell(m.spo2) + '</td>' +
                    '<td>' + Period.cell(m.sugar) + '</td>' +
                    '<td>' + Period.cell(m.temperature) + '</td>' +
                    '<td>' + Period.weightCell(m.weight) + '</td>' +
                    '</tr>';
            }
        }

        return html + '</tbody></table>';
    },

    cell: function (v) {
        return (v === null || v === undefined || v === '') ? '—' : String(v);
    },

    /* Вес вместе с индексом массы тела */
    weightCell: function (weight) {
        if (weight === null || weight === undefined || weight === '') return '—';
        var bmi = Norms.bmiFor(weight);
        return bmi !== null ? (weight + ' / ' + bmi) : String(weight);
    },

    /* ======================================================================
     * СТАТИСТИКА ЗА ПЕРИОД (раздел 3.5 ТЗ)
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

        var out = { days: list.length, total: total, params: [], weight: null };

        // Давление, пульс, сатурация, сахар — минимум, максимум, среднее
        var order = [
            { key: 'ad_top', name: 'Давление верхнее (систолическое)', unit: 'мм рт.ст' },
            { key: 'ad_bottom', name: 'Давление нижнее (диастолическое)', unit: 'мм рт.ст' },
            { key: 'pulse', name: 'Пульс', unit: 'уд/мин' },
            { key: 'spo2', name: 'Сатурация SpO2', unit: '%' },
            { key: 'sugar', name: 'Сахар крови', unit: 'ммоль/л' }
        ];

        for (var k = 0; k < order.length; k++) {
            var o = order[k];
            var vals = acc[o.key];
            if (vals.length === 0) continue;
            out.params.push({
                name: o.name,
                unit: o.unit,
                min: Period.round(Math.min.apply(null, vals)),
                max: Period.round(Math.max.apply(null, vals)),
                avg: Period.round(Period.sum(vals) / vals.length),
                over: Period.countOut(vals, o.key),
                overLabel: Period.LIMITS[o.key].label
            });
        }

        // Температура — только максимум: важно, была ли повышенная
        if (acc.temperature.length > 0) {
            out.temp = {
                max: Period.round(Math.max.apply(null, acc.temperature)),
                over: Period.countOut(acc.temperature, 'temperature'),
                overLabel: Period.LIMITS.temperature.label
            };
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

    countOut: function (vals, key) {
        var lim = Period.LIMITS[key];
        var n = 0;
        for (var i = 0; i < vals.length; i++) {
            if (lim.over !== undefined && vals[i] > lim.over) n++;
            if (lim.under !== undefined && vals[i] < lim.under) n++;
        }
        return n;
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

        var html = '<h3 class="pd-h3">Статистика за период</h3>';
        html += '<p class="pd-total">Дней: <strong>' + s.days + '</strong> · ' +
            'Всего измерений: <strong>' + s.total + '</strong></p>';

        html += '<table class="pd-stats"><thead><tr>' +
            '<th>Показатель</th><th>Минимум</th><th>Максимум</th>' +
            '<th>Среднее</th><th>Вне границ</th></tr></thead><tbody>';

        for (var i = 0; i < s.params.length; i++) {
            var p = s.params[i];
            html += '<tr>' +
                '<td class="pd-left">' + UI.escapeHtml(p.name) +
                ', ' + UI.escapeHtml(p.unit) + '</td>' +
                '<td>' + p.min + '</td>' +
                '<td>' + p.max + '</td>' +
                '<td>' + p.avg + '</td>' +
                '<td class="' + (p.over > 0 ? 'pd-over' : '') + '">' +
                (p.over > 0
                    ? p.over + Diary.plural(p.over, ' раз', ' раза', ' раз') +
                      ' (' + p.overLabel + ')'
                    : 'нет') +
                '</td></tr>';
        }

        if (s.temp) {
            html += '<tr>' +
                '<td class="pd-left">Температура, °C</td>' +
                '<td>—</td>' +
                '<td>' + s.temp.max + '</td>' +
                '<td>—</td>' +
                '<td class="' + (s.temp.over > 0 ? 'pd-over' : '') + '">' +
                (s.temp.over > 0
                    ? s.temp.over + Diary.plural(s.temp.over, ' раз', ' раза', ' раз') +
                      ' (' + s.temp.overLabel + ')'
                    : 'нет') +
                '</td></tr>';
        }

        html += '</tbody></table>';

        if (s.weight) {
            var sign = s.weight.change > 0 ? '+' : '';
            html += '<p class="pd-weight"><strong>Вес:</strong> в начале периода ' +
                s.weight.first + ' кг, в конце ' + s.weight.last + ' кг ' +
                '(изменение ' + sign + s.weight.change + ' кг)</p>';
        }

        return html;
    }
};
