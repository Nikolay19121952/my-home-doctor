/* ============================================================================
 * ДНЕВНИК ЗДОРОВЬЯ — версия 2.1 (WEB/PWA)
 * Реализация по ТЗ v2.1 «Раздел ДНЕВНИК приложения МОЙ ДОМАШНИЙ ДОКТОР»
 *
 * Главная идея ТЗ: одна ЗАПИСЬ = все измерения за ОДИН ДЕНЬ (от 1 до 36).
 *
 * Три экрана (в терминологии ТЗ — «макеты»):
 *   Макет №2  — список дневников + панель управления (VIEW_LIST)
 *   Макет №3  — форма записи измерений, таблица 36×8      (VIEW_FORM)
 *   Макет №4  — чат с историей консультаций Claude        (VIEW_CHAT)
 *
 * Хранилище — localStorage браузера (никаких файлов на диске).
 * ========================================================================== */

var Diary = {

    /* --- Ключи localStorage ------------------------------------------------ */
    RECORDS_KEY: 'mdd_diary_records',   // завершённые записи по дням
    CURRENT_KEY: 'mdd_diary_current',   // текущий незавершённый черновик
    CHAT_KEY: 'mdd_diary_chat',         // история консультаций по дневнику
    SETTINGS_KEY: 'mdd_diary_settings', // настройки раздела
    LEGACY_KEY: 'mdd_diary',            // старый формат (v1) — для переноса
    LEGACY_BACKUP_KEY: 'mdd_diary_v1_backup',

    MAX_ROWS: 36,       // лимит измерений в одном дне (валидация №12)
    VISIBLE_ROWS: 12,   // сколько строк показывать без прокрутки

    /* --- Допустимые диапазоны (раздел 4.2 ТЗ) ------------------------------ */
    RANGES: {
        ad_top: { min: 60, max: 250, label: 'АД верх', unit: 'мм рт.ст', show: '60–250' },
        ad_bottom: { min: 30, max: 150, label: 'АД низ', unit: 'мм рт.ст', show: '30–150' },
        pulse: { min: 20, max: 200, label: 'пульса', unit: 'уд/мин', show: '20–200' },
        spo2: { min: 85, max: 100, label: 'SpO2', unit: '', show: '85–100%' },
        sugar: { min: 2.0, max: 20.0, label: 'сахара', unit: 'ммоль/л', show: '2.0–20.0' },
        temperature: { min: 34.0, max: 43.0, label: 'температуры', unit: '°C', show: '34.0–43.0' },
        weight: { min: 20, max: 250, label: 'веса', unit: 'кг', show: '20–250' }
    },

    FIELDS: ['time', 'ad_top', 'ad_bottom', 'pulse', 'spo2', 'sugar', 'temperature', 'weight'],

    /* --- Состояние экрана -------------------------------------------------- */
    view: 'list',
    _selectedDays: [],   // отмеченные галочками дни в Макете №2
    _filterFrom: '',
    _filterTo: '',
    _rowOffset: 0,       // прокрутка таблицы измерений кнопками «Вверх/Вниз»
    _listOffset: 0,      // прокрутка списка записей
    _dirty: false,       // есть несохранённые изменения (валидация №14)
    _current: null,      // черновик записи, с которым работаем сейчас
    _editingDay: null,   // если открыли на редактирование готовую запись
    _sending: false,     // идёт запрос к Claude

    /* ======================================================================
     * ИНИЦИАЛИЗАЦИЯ
     * ==================================================================== */
    init: function () {
        Diary.migrateLegacy();

        // Валидация №14: предупреждение при закрытии вкладки с черновиком
        window.addEventListener('beforeunload', function (e) {
            if (Diary.view === 'form' && Diary._dirty) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        });
    },

    /* ----------------------------------------------------------------------
     * Перенос данных из старого дневника (v1: одно измерение = одна запись).
     * Старые записи группируются по дате и превращаются в записи нового
     * формата. Исходные данные сохраняются под резервным ключом — ничего
     * не теряется.
     * -------------------------------------------------------------------- */
    migrateLegacy: function () {
        var raw = localStorage.getItem(Diary.LEGACY_KEY);
        if (!raw) return;

        var old;
        try {
            old = JSON.parse(raw);
        } catch (e) {
            return;
        }
        if (!old || !old.length) {
            localStorage.removeItem(Diary.LEGACY_KEY);
            return;
        }

        var records = Diary.getRecords();
        var byDay = {};

        for (var i = 0; i < old.length; i++) {
            var e = old[i];
            if (!e.date) continue;
            if (!byDay[e.date]) byDay[e.date] = [];
            byDay[e.date].push({
                time: e.time || '00:00',
                ad_top: e.systolic || null,
                ad_bottom: e.diastolic || null,
                pulse: e.pulse || null,
                spo2: null,               // в v1 сатурация не измерялась
                sugar: e.sugar || null,
                temperature: e.temperature || null,
                weight: e.weight || null,
                notes: e.notes || ''
            });
        }

        var migrated = 0;
        for (var day in byDay) {
            if (!byDay.hasOwnProperty(day)) continue;
            if (records[day]) continue;   // не затираем уже существующее

            var list = byDay[day].slice(0, Diary.MAX_ROWS);
            list.sort(function (a, b) { return a.time < b.time ? -1 : 1; });
            for (var n = 0; n < list.length; n++) list[n].id = n + 1;

            records[day] = {
                date: day,
                measurements: list,
                completed: true,
                created_at: new Date(day + 'T00:00:00').toISOString(),
                completed_at: new Date(day + 'T23:59:00').toISOString(),
                migrated_from_v1: true
            };
            migrated++;
        }

        if (migrated > 0) {
            Diary.saveRecords(records);
        }
        localStorage.setItem(Diary.LEGACY_BACKUP_KEY, raw);
        localStorage.removeItem(Diary.LEGACY_KEY);
    },

    /* ======================================================================
     * ХРАНИЛИЩЕ
     * ==================================================================== */
    _read: function (key, fallback) {
        var data = localStorage.getItem(key);
        if (!data) return fallback;
        try {
            var parsed = JSON.parse(data);
            return parsed === null ? fallback : parsed;
        } catch (e) {
            return fallback;
        }
    },

    /* Ключи привязаны к активному профилю: у каждого члена семьи
       свой дневник, свои консультации и свои настройки раздела */
    recordsKey: function () { return Storage.pkey(Diary.RECORDS_KEY); },
    currentKey: function () { return Storage.pkey(Diary.CURRENT_KEY); },
    chatKey: function () { return Storage.pkey(Diary.CHAT_KEY); },
    settingsKey: function () { return Storage.pkey(Diary.SETTINGS_KEY); },

    getRecords: function () { return Diary._read(Diary.recordsKey(), {}); },
    saveRecords: function (r) { localStorage.setItem(Diary.recordsKey(), JSON.stringify(r)); },

    getChat: function () { return Diary._read(Diary.chatKey(), []); },
    saveChat: function (c) { localStorage.setItem(Diary.chatKey(), JSON.stringify(c)); },

    getSettings: function () {
        return Diary._read(Diary.settingsKey(), { theme: 'light', language: 'ru' });
    },
    saveSettings: function (s) { localStorage.setItem(Diary.settingsKey(), JSON.stringify(s)); },

    getCurrent: function () { return Diary._read(Diary.currentKey(), null); },
    saveCurrent: function (c) {
        if (c === null) {
            localStorage.removeItem(Diary.currentKey());
        } else {
            c.last_saved = new Date().toISOString();
            localStorage.setItem(Diary.currentKey(), JSON.stringify(c));
        }
    },

    /* Автосохранение — вызывается при каждом изменении ячейки (раздел 3.1) */
    autosave: function () {
        if (!Diary._current) return;
        Diary.saveCurrent(Diary._current);
        Diary._dirty = false;
        Diary.updateSaveHint('Черновик сохранён автоматически');
    },

    /* ======================================================================
     * ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ
     * ==================================================================== */
    render: function () {
        if (Diary.view === 'form') return Diary.renderForm();
        if (Diary.view === 'chat') return Diary.renderChat();
        return Diary.renderList();
    },

    show: function (view) {
        Diary.view = view;
        Diary.render();
        window.scrollTo(0, 0);
    },

    /* Точка входа из App.navigateTo('diary') */
    renderEntries: function () {
        Diary.render();
    },

    /* ======================================================================
     * МАКЕТ №2 — ПАНЕЛЬ УПРАВЛЕНИЯ ЗАПИСЯМИ
     * ==================================================================== */
    renderList: function () {
        var host = document.getElementById('diary-root');
        if (!host) return;

        var records = Diary.getRecords();
        var allDays = Object.keys(records).sort(function (a, b) { return a < b ? 1 : -1; });
        var days = Diary.applyFilter(allDays);
        var current = Diary.getCurrent();

        var html = '';

        // Заголовок называет владельца дневника (ТЗ v3.1, пункт 3.2)
        var owner = Storage.activeName();
        html += '<div class="dv-head">' +
            '<h2 class="dv-title">📔 ' +
            (owner ? 'Дневник — ' + UI.escapeHtml(owner) : 'Мой дневник') + '</h2>' +
            '<p class="dv-sub">Показано ' + days.length + ' из ' + allDays.length +
            (allDays.length === 1 ? ' записи' : ' записей') + '</p>' +
            '</div>';

        // Напоминание о резервной копии — данные хранятся только в браузере
        if (More.backupDue()) {
            html += '<div class="dv-backup">' +
                '<div class="dv-backup-text">💾 ' + UI.escapeHtml(More.backupText()) +
                '<br><span class="dv-muted">Все записи хранятся только в этом браузере. ' +
                'Сохраните копию, чтобы не потерять их.</span></div>' +
                '<div class="dv-backup-btns">' +
                '<button class="btn btn-primary btn-small" onclick="More.backupNow()">Сохранить копию</button>' +
                '<button class="btn btn-outline btn-small" onclick="More.backupLater()">Позже</button>' +
                '</div></div>';
        }

        // Незавершённый черновик — заметная подсказка вернуться к нему
        if (current && current.date) {
            var filled = Diary.filledCount(current.measurements);
            html += '<div class="dv-draft">' +
                '<div class="dv-draft-text">✏️ Незавершённая запись за <strong>' +
                UI.escapeHtml(Diary.formatDay(current.date)) + '</strong>' +
                '<br><span class="dv-muted">Внесено измерений: ' + filled + '</span></div>' +
                '<button class="btn btn-primary" onclick="Diary.openForm()">Продолжить</button>' +
                '</div>';
        }

        // Фильтр по периоду (кнопка №1)
        html += '<div class="dv-filter" id="dv-filter" style="display:' +
            (Diary._filterFrom || Diary._filterTo ? 'block' : 'none') + '">' +
            '<div class="dv-filter-row">' +
            '<label>С даты<input type="date" id="dv-from" value="' + Diary._filterFrom + '"></label>' +
            '<label>По дату<input type="date" id="dv-to" value="' + Diary._filterTo + '"></label>' +
            '</div>' +
            '<div class="dv-filter-btns">' +
            '<button class="btn btn-primary btn-small" onclick="Diary.applyPeriod()">Показать</button>' +
            '<button class="btn btn-outline btn-small" onclick="Diary.clearPeriod()">Сбросить</button>' +
            '</div></div>';

        // Панель управления. Экспорт и импорт с версии 2.3 живут в разделе
        // «Настройки» — там они выгружают всю конфигурацию целиком,
        // а не только дневник.
        html += '<div class="dv-panel">' +
            Diary.panelBtn('1', '📅', 'Выбрать период', 'Diary.togglePeriod()') +
            Diary.panelBtn('2', '⬆️', 'Прокрутить вверх', 'Diary.scrollList(-1)') +
            Diary.panelBtn('3', '⬇️', 'Прокрутить вниз', 'Diary.scrollList(1)') +
            Diary.panelBtn('4', '📝', 'Запись измерений', 'Diary.openForm()', 'dv-btn-main') +
            Diary.panelBtn('5', '💬', 'История чата', 'Diary.show(\'chat\')') +
            Diary.panelBtn('6', '📈', 'Создать график', 'Graphs.start()') +
            Diary.panelBtn('7', '🖨️', 'Файл / Печать периода', 'Period.print()') +
            '</div>';

        // Отметить все / снять отметки — чтобы не щёлкать каждый день вручную
        if (days.length > 0) {
            var allChecked = Diary.allSelected(days);
            html += '<div class="dv-selectall">' +
                '<button class="btn btn-outline btn-small" onclick="Diary.toggleAll()">' +
                (allChecked ? '☑ Снять все отметки' : '☐ Отметить все') +
                '</button>' +
                '<button class="btn btn-outline btn-small dv-btn-danger" onclick="Diary.deleteSelected()">' +
                '🗑 Удалить отмеченные</button>' +
                '</div>';
        }

        // Кнопка консультации — появляется, когда отмечены дни
        html += '<div class="dv-selbar" id="dv-selbar" style="display:none">' +
            '<span id="dv-selcount">Выбрано дней: 0</span>' +
            '<button class="btn btn-primary" onclick="Diary.askDoctor()">🩺 Отправить доктору</button>' +
            '</div>';

        // Список записей
        if (days.length === 0) {
            html += '<div class="empty-state">' +
                '<div class="empty-icon">📔</div>' +
                '<h3>' + (allDays.length === 0 ? 'Нет записей' : 'Ничего не найдено') + '</h3>' +
                '<p>' + (allDays.length === 0
                    ? 'Нажмите «Запись измерений», чтобы завести первую запись за день.'
                    : 'В выбранном периоде записей нет. Измените период или сбросьте фильтр.') +
                '</p></div>';
        } else {
            var pageDays = days.slice(Diary._listOffset, Diary._listOffset + 10);
            html += '<div class="dv-list">';
            for (var i = 0; i < pageDays.length; i++) {
                html += Diary.listRow(records[pageDays[i]]);
            }
            html += '</div>';

            if (days.length > 10) {
                html += '<p class="dv-muted dv-center">Записи ' + (Diary._listOffset + 1) + '–' +
                    Math.min(Diary._listOffset + 10, days.length) + ' из ' + days.length +
                    '. Листайте кнопками ⬆️ ⬇️.</p>';
            }

            // Пояснение к цветным отметкам — показываем, только если они есть
            var hasFlags = false;
            for (var f = 0; f < pageDays.length; f++) {
                if (Diary.dayLevel(records[pageDays[f]])) { hasFlags = true; break; }
            }
            if (hasFlags) {
                var art = Diary.article();
                html += '<p class="dv-legend">Под датой перечислены показатели, вышедшие ' +
                    'за границы нормы: <span class="dv-val dv-val-warn">🟡 жёлтым</span> — ' +
                    'отклонение от 5 до 15%, <span class="dv-val dv-val-danger">🔴 красным</span> — ' +
                    'больше 15%. Показатели в норме не перечисляются.' +
                    (art ? '<br>Нормы подобраны по карточке профиля: <strong>' +
                        UI.escapeHtml(art.title) + '</strong>.' : '') +
                    '<br>Это справочная подсказка, а не диагноз — ' +
                    'оценить показатели может только врач.</p>';
            }

            // Без даты рождения и роста нормы подобрать не из чего
            if (!Diary.article()) {
                html += '<p class="dv-legend">ℹ️ Чтобы приложение показывало отклонения ' +
                    'от нормы, заполните в карточке профиля дату рождения, рост и диагнозы: ' +
                    'нормы подбираются по возрасту и заболеваниям.</p>';
            }
        }

        host.innerHTML = html;
        Diary.updateSelBar();
    },

    listRow: function (rec) {
        var last = Diary.lastMeasurement(rec.measurements);
        var brief = '';
        if (last) {
            brief = 'Последнее: ' + UI.escapeHtml(last.time || '--:--');
            var vals = [];
            if (last.ad_top && last.ad_bottom) {
                vals.push(Diary.mark('ad', [last.ad_top, last.ad_bottom],
                    'АД ' + last.ad_top + '/' + last.ad_bottom));
            }
            if (last.pulse) vals.push(Diary.mark('pulse', last.pulse, 'пульс ' + last.pulse));
            if (last.spo2) vals.push(Diary.mark('spo2', last.spo2, 'SpO2 ' + last.spo2 + '%'));
            if (last.sugar) vals.push(Diary.mark('sugar', last.sugar, 'сахар ' + last.sugar));
            if (last.temperature) vals.push(Diary.mark('temp', last.temperature, 't° ' + last.temperature));
            if (last.weight) vals.push('вес ' + last.weight);
            if (vals.length) brief += ' (' + vals.join(', ') + ')';
        }
        var count = Diary.filledCount(rec.measurements);
        var checked = Diary._selectedDays.indexOf(rec.date) !== -1;

        // Перечень отклонений от индивидуальных норм (ТЗ v3.1 часть 2, раздел 5)
        var devs = Diary.deviations(rec);
        var counts = { danger: 0, warn: 0 };
        for (var k = 0; k < devs.length; k++) {
            if (devs[k].level === 'danger') counts.danger++; else counts.warn++;
        }
        var level = counts.danger ? 'danger' : (counts.warn ? 'warn' : '');

        // Счётчики у даты: сколько красных и сколько жёлтых
        var flag = '';
        if (level) {
            flag = ' <span class="dv-flag dv-flag-danger">🔴 ' + counts.danger + '</span>' +
                ' <span class="dv-flag dv-flag-warn">🟡 ' + counts.warn + '</span>';
        }

        // Строки отклонений. Длинный список подрезаем, чтобы карточка дня
        // не разрасталась на весь экран
        var devHtml = '';
        if (devs.length) {
            var shown = devs.slice(0, 6);
            devHtml = '<div class="dv-devs">';
            for (var n = 0; n < shown.length; n++) {
                var dv = shown[n];
                var sign = dv.percent > 0 ? '+' : '';
                devHtml += '<div class="dv-dev dv-dev-' + dv.level + '">' +
                    '<span class="dv-dev-time">' + UI.escapeHtml(dv.time) + '</span> ' +
                    UI.escapeHtml(dv.label) + ': <strong>' + UI.escapeHtml(String(dv.value)) + '</strong>' +
                    ' <span class="dv-dev-norm">(норма ' + dv.range[0] + '–' + dv.range[1] + ')</span>' +
                    ' <span class="dv-dev-pct">' + sign + dv.percent + '%</span>' +
                    '</div>';
            }
            if (devs.length > shown.length) {
                devHtml += '<div class="dv-dev-more">и ещё ' + (devs.length - shown.length) +
                    Diary.plural(devs.length - shown.length, ' отклонение', ' отклонения', ' отклонений') +
                    ' — откройте запись</div>';
            }
            devHtml += '</div>';
        }

        return '<div class="dv-item' + (level ? ' dv-item-' + level : '') + '">' +
            '<label class="dv-check">' +
            '<input type="checkbox" ' + (checked ? 'checked' : '') +
            ' onchange="Diary.toggleDay(\'' + rec.date + '\', this.checked)">' +
            '<span></span></label>' +
            '<div class="dv-item-body">' +
            '<div class="dv-item-date">' + UI.escapeHtml(Diary.formatDay(rec.date)) + flag +
            ' <span class="dv-badge">' + count + Diary.plural(count, ' измерение', ' измерения', ' измерений') + '</span></div>' +
            '<div class="dv-item-brief">' + brief + '</div>' +
            devHtml +
            '</div>' +
            '<div class="dv-item-actions">' +
            '<button class="btn btn-outline btn-small" onclick="Diary.openRecord(\'' + rec.date + '\')">Откр.</button>' +
            '<button class="btn btn-outline btn-small" onclick="Diary.printRecord(\'' + rec.date + '\')" title="Печать или сохранение в PDF">🖨️ / 📄</button>' +
            '<button class="dv-del" onclick="Diary.deleteRecord(\'' + rec.date + '\')" title="Удалить">✕</button>' +
            '</div></div>';
    },

    panelBtn: function (num, icon, label, action, extra) {
        return '<button class="dv-pbtn ' + (extra || '') + '" onclick="' + action + '">' +
            '<span class="dv-pbtn-icon">' + icon + '</span>' +
            '<span class="dv-pbtn-label">' + label + '</span></button>';
    },

    applyFilter: function (days) {
        if (!Diary._filterFrom && !Diary._filterTo) return days;
        return days.filter(function (d) {
            if (Diary._filterFrom && d < Diary._filterFrom) return false;
            if (Diary._filterTo && d > Diary._filterTo) return false;
            return true;
        });
    },

    togglePeriod: function () {
        var box = document.getElementById('dv-filter');
        if (!box) return;
        box.style.display = box.style.display === 'none' ? 'block' : 'none';
    },

    applyPeriod: function () {
        var from = document.getElementById('dv-from');
        var to = document.getElementById('dv-to');
        Diary._filterFrom = from ? from.value : '';
        Diary._filterTo = to ? to.value : '';
        if (Diary._filterFrom && Diary._filterTo && Diary._filterFrom > Diary._filterTo) {
            UI.showToast('Дата «с» позже даты «по» — проверьте период', 3000);
            return;
        }
        Diary._listOffset = 0;
        Diary.renderList();
    },

    clearPeriod: function () {
        Diary._filterFrom = '';
        Diary._filterTo = '';
        Diary._listOffset = 0;
        Diary.renderList();
    },

    scrollList: function (dir) {
        var records = Diary.getRecords();
        var days = Diary.applyFilter(Object.keys(records).sort(function (a, b) { return a < b ? 1 : -1; }));
        var next = Diary._listOffset + dir * 10;
        if (next < 0) next = 0;
        if (next >= days.length) next = Math.max(0, days.length - 10);
        if (next === Diary._listOffset) {
            UI.showToast(dir < 0 ? 'Это начало списка' : 'Это конец списка');
            return;
        }
        Diary._listOffset = next;
        Diary.renderList();
    },

    toggleDay: function (day, checked) {
        if (checked) {
            if (Diary._selectedDays.indexOf(day) === -1) Diary._selectedDays.push(day);
        } else {
            Diary._selectedDays = Diary._selectedDays.filter(function (d) { return d !== day; });
        }
        Diary.updateSelBar();
    },

    /* Отмечены ли все дни, попавшие в текущий фильтр */
    allSelected: function (days) {
        if (!days.length) return false;
        for (var i = 0; i < days.length; i++) {
            if (Diary._selectedDays.indexOf(days[i]) === -1) return false;
        }
        return true;
    },

    /* Кнопка «Отметить все»: работает по дням текущего фильтра, а не по видимой странице */
    toggleAll: function () {
        var records = Diary.getRecords();
        var days = Diary.applyFilter(
            Object.keys(records).sort(function (a, b) { return a < b ? 1 : -1; })
        );
        if (days.length === 0) return;

        if (Diary.allSelected(days)) {
            Diary._selectedDays = Diary._selectedDays.filter(function (d) {
                return days.indexOf(d) === -1;
            });
            UI.showToast('Отметки сняты');
        } else {
            for (var i = 0; i < days.length; i++) {
                if (Diary._selectedDays.indexOf(days[i]) === -1) {
                    Diary._selectedDays.push(days[i]);
                }
            }
            UI.showToast('Отмечено дней: ' + days.length);
        }
        Diary.renderList();
    },

    /* ----------------------------------------------------------------------
     * Удаление отмеченных записей (ТЗ v3.1 часть 2, раздел 6.1).
     * Действие необратимое, поэтому спрашиваем подтверждение и называем,
     * сколько именно записей будет удалено.
     * -------------------------------------------------------------------- */
    deleteSelected: function () {
        var days = Diary._selectedDays.slice().sort();
        if (days.length === 0) {
            UI.showToast('Отметьте галочками записи, которые нужно удалить');
            return;
        }

        var label = days.length === 1
            ? 'Запись за ' + Diary.formatDay(days[0]) + ' будет удалена.'
            : 'Будет удалено записей: ' + days.length + ' — с ' +
              Diary.formatDay(days[0]) + ' по ' + Diary.formatDay(days[days.length - 1]) + '.';

        UI.showConfirm(
            'Удалить отмеченные записи?',
            label + ' Это действие нельзя отменить.',
            'Удалить',
            function () {
                var records = Diary.getRecords();
                for (var i = 0; i < days.length; i++) {
                    delete records[days[i]];
                }
                Diary.saveRecords(records);
                Diary._selectedDays = [];
                UI.showToast('Удалено записей: ' + days.length);
                Diary.renderList();
            }
        );
    },

    updateSelBar: function () {
        var bar = document.getElementById('dv-selbar');
        var cnt = document.getElementById('dv-selcount');
        if (!bar) return;
        bar.style.display = Diary._selectedDays.length > 0 ? 'flex' : 'none';
        if (cnt) cnt.textContent = 'Выбрано дней: ' + Diary._selectedDays.length;
    },

    /* ======================================================================
     * МАКЕТ №3 — ФОРМА ЗАПИСИ ИЗМЕРЕНИЙ
     * ==================================================================== */

    /* Открыть форму: продолжить черновик или начать новую запись */
    openForm: function () {
        var current = Diary.getCurrent();
        if (current && current.date) {
            Diary._current = current;
        } else {
            Diary._current = Diary.blankRecord('');
        }
        Diary._editingDay = null;
        Diary._rowOffset = 0;
        Diary._dirty = false;
        Diary._returnTo = 'list';
        Diary.show('form');
    },

    /* ----------------------------------------------------------------------
     * БЫСТРАЯ ЗАПИСЬ (ТЗ v3.1, доработка №1)
     *
     * Открывает запись за сегодня, подставляет текущее время в первую
     * свободную строку и ставит в неё курсор. Раньше на одно измерение
     * уходило 8–10 действий, теперь 4–5.
     * -------------------------------------------------------------------- */
    quickRecord: function () {
        var today = Diary.todayISO();
        var records = Diary.getRecords();

        if (records[today]) {
            // Запись за сегодня уже завершена — открываем её на дополнение
            Diary.openRecord(today, 'home');
        } else {
            var draft = Diary.getCurrent();

            // Черновик за другой день не трогаем (условие 3 раздела 2.4 ТЗ)
            if (draft && draft.date && draft.date !== today &&
                Diary.filledCount(draft.measurements) > 0) {
                UI.showToast('Сначала завершите запись за ' + Diary.formatDay(draft.date), 4000);
                App.navigateTo('diary');
                Diary.show('list');
                return;
            }

            Diary._current = (draft && draft.date === today)
                ? draft
                : Diary.blankRecord(today);
            Diary._current.date = today;
            Diary._editingDay = null;
            Diary._returnTo = 'home';
            Diary._dirty = false;
            Diary.saveCurrent(Diary._current);
        }

        App.navigateTo('diary');
        Diary.prepareQuickRow();
    },

    /* Готовит первую свободную строку: время, прокрутка, курсор, подсветка */
    prepareQuickRow: function () {
        var rec = Diary._current;
        if (!rec) return;

        var row = Diary.firstFreeRow(rec.measurements);

        // Валидация: в сутках не больше 36 измерений
        if (row === -1) {
            UI.showToast('Лимит 36 измерений за день достигнут. Завершите запись!', 4000);
            Diary.show('form');
            return;
        }

        // Дописываем строки до нужной и ставим текущее время
        while (rec.measurements.length <= row) {
            rec.measurements.push({
                id: rec.measurements.length + 1,
                time: '', ad_top: null, ad_bottom: null, pulse: null, spo2: null,
                sugar: null, temperature: null, weight: null, notes: ''
            });
        }
        if (!rec.measurements[row].time) {
            rec.measurements[row].time = Diary.nowHHMM();
        }
        Diary.saveCurrent(rec);

        // Показываем страницу таблицы, на которой находится эта строка
        Diary._rowOffset = Math.floor(row / Diary.VISIBLE_ROWS) * Diary.VISIBLE_ROWS;
        Diary._quickRow = row;
        Diary.show('form');

        // Подсветка и курсор — после отрисовки таблицы
        setTimeout(function () {
            var tr = document.querySelector('.dv-table tr[data-row="' + row + '"]');
            if (tr) {
                tr.classList.add('dv-row-new');
                if (tr.scrollIntoView) {
                    tr.scrollIntoView({ block: 'center' });
                }
            }
            Diary.focusCell(row, 'ad_top');
        }, 60);
    },

    /* Индекс первой строки без времени; -1 — если все 36 заняты */
    firstFreeRow: function (list) {
        for (var i = 0; i < Diary.MAX_ROWS; i++) {
            var m = list[i];
            if (!m || !m.time) return i;
        }
        return -1;
    },

    todayISO: function () {
        var d = new Date();
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
    },

    /* Текущее время без округления — момент измерения важен */
    nowHHMM: function () {
        var d = new Date();
        return String(d.getHours()).padStart(2, '0') + ':' +
            String(d.getMinutes()).padStart(2, '0');
    },

    /* Открыть готовую запись на редактирование (кнопка «Откр.») */
    openRecord: function (day, returnTo) {
        var records = Diary.getRecords();
        var rec = records[day];
        if (!rec) return;

        var draft = Diary.getCurrent();
        if (draft && draft.date && draft.date !== day && Diary.filledCount(draft.measurements) > 0) {
            UI.showToast('Сначала завершите запись за ' + Diary.formatDay(draft.date), 3500);
            return;
        }

        Diary._current = {
            date: rec.date,
            measurements: JSON.parse(JSON.stringify(rec.measurements)),
            status: 'editing',
            created_at: rec.created_at
        };
        Diary._editingDay = day;
        Diary._rowOffset = 0;
        Diary._dirty = false;
        Diary._returnTo = returnTo || 'list';
        if (returnTo !== 'home') Diary.show('form');
    },

    blankRecord: function (date) {
        return {
            date: date,
            measurements: [],
            status: 'editing',
            created_at: new Date().toISOString()
        };
    },

    renderForm: function () {
        var host = document.getElementById('diary-root');
        if (!host) return;

        var rec = Diary._current;
        var filled = Diary.filledCount(rec.measurements);
        // Валидация №2: дата блокируется, как только в таблице есть данные
        var dateLocked = filled > 0;

        var html = '';

        html += '<div class="dv-head">' +
            '<button class="dv-back" onclick="Diary.leaveForm()">← Назад</button>' +
            '<h2 class="dv-title">📝 Запись измерений</h2>' +
            '</div>';

        html += '<div class="dv-daterow">' +
            '<label for="dv-date">Дата записи</label>' +
            '<input type="date" id="dv-date" value="' + (rec.date || '') + '"' +
            (dateLocked ? ' data-locked="1"' : '') +
            ' onchange="Diary.onDateChange(this)">' +
            (dateLocked
                ? '<span class="dv-lock">🔒 Изменение даты в этом окне заблокировано</span>'
                : '') +
            '</div>';
        html += '<div class="dv-err" id="dv-date-err"></div>';

        html += '<div class="dv-counter">Внесено: <strong>' + filled + '</strong> из ' +
            Diary.MAX_ROWS + ' измерений<span id="dv-savehint" class="dv-savehint"></span></div>';

        html += Diary.tableHtml();

        // Панель управления — 5 кнопок ТЗ
        html += '<div class="dv-panel">' +
            Diary.panelBtn('1', '🩺', 'Отправить доктору', 'Diary.askDoctorCurrent()') +
            Diary.panelBtn('2', '⬆️', 'Вверх', 'Diary.scrollRows(-1)') +
            Diary.panelBtn('3', '⬇️', 'Вниз', 'Diary.scrollRows(1)') +
            Diary.panelBtn('4', '💾', 'Сохранить и выйти', 'Diary.saveAndExit()') +
            Diary.panelBtn('5', '✅', 'Завершить запись', 'Diary.completeRecord()', 'dv-btn-done') +
            '</div>';

        host.innerHTML = html;
        Diary.bindTable();
    },

    tableHtml: function () {
        var rec = Diary._current;
        var from = Diary._rowOffset;
        var to = Math.min(from + Diary.VISIBLE_ROWS, Diary.MAX_ROWS);

        var html = '<div class="dv-tablewrap"><table class="dv-table">' +
            '<thead><tr>' +
            '<th class="dv-c-num">№</th>' +
            '<th>Время</th>' +
            '<th>АД верх</th>' +
            '<th>АД низ</th>' +
            '<th>Пульс</th>' +
            '<th>SpO2</th>' +
            '<th>Сахар</th>' +
            '<th>t°</th>' +
            '<th>Вес / ИМТ</th>' +
            '</tr></thead><tbody>';

        for (var i = from; i < to; i++) {
            var m = rec.measurements[i] || {};
            html += '<tr data-row="' + i + '">' +
                '<td class="dv-c-num">' + (i + 1) + '</td>' +
                Diary.cell(i, 'time', m.time, 'time') +
                Diary.cell(i, 'ad_top', m.ad_top, 'number') +
                Diary.cell(i, 'ad_bottom', m.ad_bottom, 'number') +
                Diary.cell(i, 'pulse', m.pulse, 'number') +
                Diary.cell(i, 'spo2', m.spo2, 'number') +
                Diary.cell(i, 'sugar', m.sugar, 'decimal') +
                Diary.cell(i, 'temperature', m.temperature, 'decimal') +
                Diary.weightCell(i, m.weight) +
                '</tr>';
        }

        html += '</tbody></table></div>';
        html += '<p class="dv-muted dv-center">Строки ' + (from + 1) + '–' + to +
            ' из ' + Diary.MAX_ROWS + '. Листайте кнопками ⬆️ ⬇️.</p>';
        html += '<div class="dv-err" id="dv-cell-err"></div>';
        return html;
    },

    /* ----------------------------------------------------------------------
     * Ячейка веса с индексом массы тела (ТЗ v3.1 часть 2, раздел 3).
     * ИМТ не вводится и не хранится — считается из веса и роста профиля,
     * поэтому всегда соответствует текущим данным карточки.
     * -------------------------------------------------------------------- */
    weightCell: function (row, weight) {
        var bmi = Norms.bmiFor(weight);
        var hint = bmi !== null
            ? '<span class="dv-bmi" id="dv-bmi-' + row + '">ИМТ ' + bmi + '</span>'
            : '<span class="dv-bmi" id="dv-bmi-' + row + '"></span>';

        return '<td class="dv-c-weight"><input type="text" class="dv-cell" data-row="' + row +
            '" data-field="weight" value="' + UI.escapeHtml(weight === null || weight === undefined ? '' : String(weight)) +
            '" inputmode="decimal" maxlength="5">' + hint + '</td>';
    },

    /* Пересчитать подпись ИМТ после ввода веса */
    refreshBmi: function (row) {
        var el = document.getElementById('dv-bmi-' + row);
        if (!el || !Diary._current) return;
        var m = Diary._current.measurements[row];
        var bmi = m ? Norms.bmiFor(m.weight) : null;
        el.textContent = bmi !== null ? 'ИМТ ' + bmi : '';
    },

    cell: function (row, field, value, kind) {
        var attrs = 'inputmode="' + (kind === 'time' ? 'numeric' : 'decimal') + '"';
        if (kind === 'time') {
            attrs += ' maxlength="5" placeholder="ЧЧ:ММ"';
        } else if (kind === 'decimal') {
            attrs += ' maxlength="5"';
        } else {
            attrs += ' maxlength="3"';
        }
        var v = (value === null || value === undefined) ? '' : value;
        return '<td><input type="text" class="dv-cell" data-row="' + row +
            '" data-field="' + field + '" value="' + UI.escapeHtml(String(v)) + '" ' + attrs + '></td>';
    },

    bindTable: function () {
        var cells = document.querySelectorAll('.dv-cell');
        for (var i = 0; i < cells.length; i++) {
            cells[i].addEventListener('focus', function () {
                this.classList.add('dv-cell-active');
            });
            cells[i].addEventListener('blur', function () {
                this.classList.remove('dv-cell-active');
                Diary.commitCell(this);
            });
            cells[i].addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    Diary.commitCell(this);
                    Diary.focusCell(Number(this.getAttribute('data-row')) + 1, 'time');
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    Diary.revertCell(this);
                    this.blur();
                }
            });
        }
    },

    focusCell: function (row, field) {
        var el = document.querySelector('.dv-cell[data-row="' + row + '"][data-field="' + field + '"]');
        if (el) { el.focus(); el.select(); }
    },

    revertCell: function (input) {
        var row = Number(input.getAttribute('data-row'));
        var field = input.getAttribute('data-field');
        var m = Diary._current.measurements[row];
        var v = m && m[field] !== null && m[field] !== undefined ? m[field] : '';
        input.value = String(v);
        input.classList.remove('dv-cell-err', 'dv-cell-warn');
        Diary.showCellError('');
    },

    /* ----------------------------------------------------------------------
     * Запись значения ячейки с полной валидацией (проверки 3–11, 12, 15, 16)
     * -------------------------------------------------------------------- */
    commitCell: function (input) {
        var row = Number(input.getAttribute('data-row'));
        var field = input.getAttribute('data-field');
        var raw = input.value.trim();

        input.classList.remove('dv-cell-err', 'dv-cell-warn');
        Diary.showCellError('');

        // Валидация №1: без даты работать нельзя
        if (!Diary._current.date && raw !== '') {
            Diary.showDateError('Введите дату записи');
            input.value = '';
            Diary.focusDate();
            return;
        }

        var rec = Diary._current;
        while (rec.measurements.length <= row) {
            rec.measurements.push({
                id: rec.measurements.length + 1,
                time: '', ad_top: null, ad_bottom: null, pulse: null, spo2: null,
                sugar: null, temperature: null, weight: null, notes: ''
            });
        }
        var m = rec.measurements[row];

        /* --- Время ------------------------------------------------------- */
        if (field === 'time') {
            if (raw === '') {
                if (Diary.rowHasValues(m)) {
                    // Валидация №3: время обязательно, если строка заполнена
                    input.classList.add('dv-cell-err');
                    Diary.showCellError('Введите СНАЧАЛА время измерения!');
                    return;
                }
                m.time = '';
                Diary.afterChange(row);
                return;
            }
            var norm = Diary.normalizeTime(raw);
            if (norm === null) {
                // Валидация №10: формат HH:MM
                input.classList.add('dv-cell-err');
                Diary.showCellError('Формат времени: ЧЧ:ММ (например 08:00)');
                return;
            }
            var hh = Number(norm.split(':')[0]);
            var mm = Number(norm.split(':')[1]);
            if (hh > 23 || mm > 59) {
                // Валидация №11: корректность часов и минут
                input.classList.add('dv-cell-err');
                Diary.showCellError('Некорректное время (часов 0–23, минут 0–59)');
                return;
            }
            m.time = norm;
            input.value = norm;
            Diary.afterChange(row);
            return;
        }

        /* --- Числовые поля ---------------------------------------------- */
        if (raw === '') {
            m[field] = null;
            Diary.afterChange(row);
            return;
        }

        // Валидация №3: сначала время, потом всё остальное
        if (!m.time) {
            input.classList.add('dv-cell-err');
            Diary.showCellError('Введите СНАЧАЛА время измерения!');
            input.value = '';
            Diary.focusCell(row, 'time');
            return;
        }

        var num = Number(raw.replace(',', '.'));
        // Валидация №15: только числа
        if (raw.replace(',', '.').match(/^-?\d*\.?\d+$/) === null || isNaN(num)) {
            input.classList.add('dv-cell-err');
            Diary.showCellError('Введите число (без букв и специальных символов)');
            return;
        }

        // Валидации №4–9: диапазоны значений
        var r = Diary.RANGES[field];
        if (r && (num < r.min || num > r.max)) {
            input.classList.add('dv-cell-err');
            Diary.showCellError(('Диапазон ' + r.label + ': ' + r.show + ' ' + r.unit).trim());
            return;
        }

        m[field] = num;
        input.value = String(num);

        // Валидация №16: верхнее давление должно быть больше нижнего (предупреждение)
        if ((field === 'ad_top' || field === 'ad_bottom') && m.ad_top && m.ad_bottom) {
            if (m.ad_top < m.ad_bottom) {
                input.classList.add('dv-cell-warn');
                Diary.showCellError('Внимание: верхнее давление должно быть больше нижнего. Проверьте!', true);
            }
        }

        // Валидация №17: предупреждения о низкой сатурации.
        // Значение уже прошло проверку диапазона 85–100, здесь только
        // подсказываем, насколько показатель тревожный.
        if (field === 'spo2') {
            var alert17 = Diary.spo2Alert(num);
            if (alert17) {
                input.classList.add('dv-cell-warn');
                Diary.showCellError(alert17, true);
            }
        }

        // Валидация №12: лимит 36 измерений
        if (Diary.filledCount(rec.measurements) >= Diary.MAX_ROWS) {
            UI.showToast('Лимит 36 измерений достигнут. Завершите запись!', 3500);
        }

        Diary.afterChange(row);
    },

    afterChange: function (row) {
        Diary._dirty = true;
        Diary.autosave();
        Diary.refreshCounter();
        if (typeof row === 'number') Diary.refreshBmi(row);
    },

    refreshCounter: function () {
        var box = document.querySelector('.dv-counter strong');
        if (box) box.textContent = String(Diary.filledCount(Diary._current.measurements));
        // Как только появились данные — дата блокируется (валидация №2)
        var dateInput = document.getElementById('dv-date');
        if (dateInput && Diary.filledCount(Diary._current.measurements) > 0 &&
            !dateInput.getAttribute('data-locked')) {
            dateInput.setAttribute('data-locked', '1');
            var row = dateInput.parentNode;
            if (row && !row.querySelector('.dv-lock')) {
                var hint = document.createElement('span');
                hint.className = 'dv-lock';
                hint.textContent = '🔒 Изменение даты в этом окне заблокировано';
                row.appendChild(hint);
            }
        }
    },

    onDateChange: function (input) {
        var rec = Diary._current;
        var newDate = input.value;

        // Валидация №2: менять дату нельзя, если в таблице уже есть данные
        if (input.getAttribute('data-locked') && rec.date && newDate !== rec.date) {
            input.value = rec.date;
            Diary.showDateError('Дата заблокирована! Завершите запись кнопкой «Завершить запись»');
            return;
        }

        if (!newDate) {
            Diary.showDateError('Введите дату записи');
            rec.date = '';
            return;
        }

        // Нельзя завести черновик на день, который уже завершён
        var records = Diary.getRecords();
        if (records[newDate] && Diary._editingDay !== newDate) {
            input.value = rec.date || '';
            Diary.showDateError('Запись за ' + Diary.formatDay(newDate) +
                ' уже существует. Откройте её кнопкой «Откр.» в списке.');
            return;
        }

        Diary.showDateError('');
        rec.date = newDate;
        Diary.autosave();
    },

    focusDate: function () {
        var d = document.getElementById('dv-date');
        if (d) d.focus();
    },

    showDateError: function (msg) {
        var box = document.getElementById('dv-date-err');
        if (box) {
            box.textContent = msg ? '🩺 ' + msg : '';
            box.style.display = msg ? 'block' : 'none';
        }
        if (msg) UI.showToast(msg, 3500);
    },

    showCellError: function (msg, isWarning) {
        var box = document.getElementById('dv-cell-err');
        if (box) {
            box.textContent = msg ? '🩺 ' + msg : '';
            box.style.display = msg ? 'block' : 'none';
            box.className = 'dv-err' + (isWarning ? ' dv-err-warn' : '');
        }
        if (msg) UI.showToast(msg, 3500);
    },

    updateSaveHint: function (text) {
        var el = document.getElementById('dv-savehint');
        if (!el) return;
        el.textContent = ' · ' + text;
        clearTimeout(Diary._hintTimer);
        Diary._hintTimer = setTimeout(function () {
            var e2 = document.getElementById('dv-savehint');
            if (e2) e2.textContent = '';
        }, 2000);
    },
    _hintTimer: null,

    scrollRows: function (dir) {
        var next = Diary._rowOffset + dir * Diary.VISIBLE_ROWS;
        if (next < 0) next = 0;
        if (next >= Diary.MAX_ROWS) next = Diary.MAX_ROWS - Diary.VISIBLE_ROWS;
        if (next === Diary._rowOffset) {
            UI.showToast(dir < 0 ? 'Это первая строка' : 'Это последняя строка');
            return;
        }
        Diary._rowOffset = next;
        Diary.renderForm();
    },

    /* --- Кнопка №4: сохранить черновик и выйти ---------------------------- */
    saveAndExit: function () {
        var rec = Diary._current;
        if (!rec.date) {
            Diary.showDateError('Введите дату записи');
            Diary.focusDate();
            return;
        }

        if (Diary._editingDay) {
            // Редактирование готовой записи — сохраняем прямо в неё
            Diary.commitEdit(false);
            return;
        }

        Diary.saveCurrent(rec);
        Diary._dirty = false;
        UI.showToast('Измерение сохранено!');
        Diary.leave();
    },

    /* ----------------------------------------------------------------------
     * Куда возвращаться после сохранения. Если запись начата кнопкой
     * быстрой записи с главного экрана, туда же и возвращаемся: пользователь
     * пришёл оттуда и может сразу записать следующее измерение.
     * -------------------------------------------------------------------- */
    leave: function () {
        var to = Diary._returnTo;
        Diary._returnTo = 'list';
        Diary._quickRow = -1;
        if (to === 'home') {
            App.navigateTo('home');
        } else {
            Diary.show('list');
        }
    },

    /* --- Кнопка №5: завершить запись -------------------------------------- */
    completeRecord: function () {
        var rec = Diary._current;

        // Валидация №1
        if (!rec.date) {
            Diary.showDateError('Введите дату записи');
            Diary.focusDate();
            return;
        }

        // Валидация №13: нельзя завершить пустую запись
        var rows = Diary.validRows(rec.measurements);
        if (rows.length === 0) {
            UI.showToast('Нет данных для сохранения. Введите хотя бы одно измерение', 3500);
            return;
        }

        // Сортировка по времени (требование ТЗ, раздел 7.2)
        rows.sort(function (a, b) { return a.time < b.time ? -1 : (a.time > b.time ? 1 : 0); });
        for (var i = 0; i < rows.length; i++) rows[i].id = i + 1;

        var records = Diary.getRecords();
        var existing = records[rec.date];

        records[rec.date] = {
            date: rec.date,
            measurements: rows,
            completed: true,
            created_at: (existing && existing.created_at) || rec.created_at || new Date().toISOString(),
            completed_at: new Date().toISOString()
        };
        Diary.saveRecords(records);

        if (!Diary._editingDay) {
            Diary.saveCurrent(null);   // черновик очищается
        }
        Diary._current = null;
        Diary._editingDay = null;
        Diary._dirty = false;

        UI.showToast('Запись завершена и сохранена!');
        Diary._returnTo = 'list';
        Diary.leave();

        // Печать записи (PDF через браузер) — после возврата в список
        setTimeout(function () { Diary.printRecord(records[rec.date].date); }, 400);
    },

    /* Сохранение при редактировании готовой записи */
    commitEdit: function (silent) {
        var rec = Diary._current;
        var rows = Diary.validRows(rec.measurements);
        if (rows.length === 0) {
            UI.showToast('Нет данных для сохранения. Введите хотя бы одно измерение', 3500);
            return;
        }
        rows.sort(function (a, b) { return a.time < b.time ? -1 : (a.time > b.time ? 1 : 0); });
        for (var i = 0; i < rows.length; i++) rows[i].id = i + 1;

        var records = Diary.getRecords();
        records[rec.date].measurements = rows;
        records[rec.date].completed_at = new Date().toISOString();
        Diary.saveRecords(records);

        Diary._current = null;
        Diary._editingDay = null;
        Diary._dirty = false;
        if (!silent) UI.showToast('Измерение сохранено!');
        Diary.leave();
    },

    /* Выход из формы кнопкой «Назад» — валидация №14 */
    leaveForm: function () {
        if (Diary._dirty) {
            UI.showConfirm(
                'Есть несохранённые данные!',
                'Используйте «Сохранить и выйти» или «Завершить запись». Выйти без сохранения?',
                'Выйти',
                function () {
                    Diary._dirty = false;
                    Diary._current = null;
                    Diary._editingDay = null;
                    Diary.leave();
                }
            );
            return;
        }
        Diary._current = null;
        Diary._editingDay = null;
        Diary.leave();
    },

    deleteRecord: function (day) {
        UI.showConfirm(
            'Удалить запись?',
            'Запись за ' + Diary.formatDay(day) + ' будет удалена. Это действие нельзя отменить.',
            'Удалить',
            function () {
                var records = Diary.getRecords();
                delete records[day];
                Diary.saveRecords(records);
                Diary._selectedDays = Diary._selectedDays.filter(function (d) { return d !== day; });
                UI.showToast('Запись удалена!');
                Diary.renderList();
            }
        );
    },

    /* ======================================================================
     * КОНСУЛЬТАЦИЯ CLAUDE
     * ==================================================================== */

    /* Из Макета №2 — по отмеченным дням */
    askDoctor: function () {
        if (Diary._selectedDays.length === 0) {
            UI.showToast('Отметьте галочками дни для консультации');
            return;
        }
        var days = Diary._selectedDays.slice().sort();
        var records = Diary.getRecords();
        var payload = [];
        for (var i = 0; i < days.length; i++) {
            if (records[days[i]]) payload.push(records[days[i]]);
        }
        Diary.sendConsult(payload, days);
    },

    /* Из Макета №3 — по текущей записи */
    askDoctorCurrent: function () {
        var rec = Diary._current;
        if (!rec || !rec.date) {
            Diary.showDateError('Введите дату записи');
            return;
        }
        var rows = Diary.validRows(rec.measurements);
        if (rows.length === 0) {
            UI.showToast('Введите хотя бы одно измерение');
            return;
        }
        rows.sort(function (a, b) { return a.time < b.time ? -1 : 1; });
        Diary.sendConsult([{ date: rec.date, measurements: rows }], [rec.date]);
    },

    sendConsult: function (records, days) {
        if (Diary._sending) {
            UI.showToast('Запрос уже отправлен, подождите');
            return;
        }
        if (!navigator.onLine) {
            UI.showToast('Нет соединения с интернетом', 3500);
            return;
        }

        var dayLabels = days.map(function (d) { return Diary.formatDay(d); }).join(', ');

        UI.showConfirm(
            'Отправить доктору?',
            'Данные за ' + dayLabels + ' будут отправлены ИИ-доктору для анализа.',
            'Отправить',
            function () {
                Diary._sending = true;
                UI.showToast('Отправляю запрос доктору...', 4000);

                var prompt = Diary.buildPrompt(records);

                var xhr = new XMLHttpRequest();
                xhr.open('POST', '/api/chat', true);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.timeout = 90000;   // запас на длинные заключения

                xhr.onload = function () {
                    Diary._sending = false;
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
                        Diary.storeConsult(days, prompt, reply);
                        Diary._selectedDays = [];
                        UI.showToast('Ответ получен! Смотрите историю консультаций', 4000);
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
                    Diary._sending = false;
                    UI.showToast('Сервер не ответил, попробуйте позже', 3500);
                };

                xhr.onerror = function () {
                    Diary._sending = false;
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

    /* Формирование текста запроса (раздел 5.1 ТЗ) */
    buildPrompt: function (records) {
        var lines = ['ДНЕВНИК ЗДОРОВЬЯ:', ''];

        for (var i = 0; i < records.length; i++) {
            var rec = records[i];
            lines.push(Diary.formatDay(rec.date).toUpperCase() + ':');
            var rows = Diary.validRows(rec.measurements);
            rows.sort(function (a, b) { return a.time < b.time ? -1 : 1; });
            for (var j = 0; j < rows.length; j++) {
                var m = rows[j];
                var parts = [];
                if (m.ad_top && m.ad_bottom) parts.push('АД ' + m.ad_top + '/' + m.ad_bottom);
                if (m.pulse) parts.push('Пульс ' + m.pulse);
                if (m.spo2) parts.push('SpO2 ' + m.spo2 + '%');
                if (m.sugar) parts.push('Сахар ' + m.sugar);
                if (m.temperature) parts.push('t° ' + m.temperature);
                if (m.weight) {
                    var bmi = Norms.bmiFor(m.weight);
                    parts.push('Вес ' + m.weight + ' кг' + (bmi !== null ? ' (ИМТ ' + bmi + ')' : ''));
                }
                lines.push(m.time + ' — ' + parts.join(', '));
            }
            lines.push('');
        }

        lines.push('Вопрос: Как вы оцениваете эти показатели? Есть ли рекомендации?');
        return lines.join('\n');
    },

    storeConsult: function (days, prompt, reply) {
        var chat = Diary.getChat();
        chat.unshift({
            id: 'msg_' + Date.now().toString(36),
            timestamp: new Date().toISOString(),
            selected_days: days.slice(),
            user_message: 'Отправлен дневник за ' + days.map(function (d) {
                return Diary.formatDay(d);
            }).join(', '),
            prompt: prompt,
            ai_response: reply,
            model: 'claude-haiku-4-5'
        });
        if (chat.length > 100) chat = chat.slice(0, 100);
        Diary.saveChat(chat);
    },

    /* ======================================================================
     * МАКЕТ №4 — ИСТОРИЯ КОНСУЛЬТАЦИЙ
     * ==================================================================== */
    renderChat: function () {
        var host = document.getElementById('diary-root');
        if (!host) return;

        var chat = Diary.getChat();
        var html = '';

        html += '<div class="dv-head">' +
            '<button class="dv-back" onclick="Diary.show(\'list\')">← Назад</button>' +
            '<h2 class="dv-title">💬 История консультаций</h2>' +
            '</div>';

        if (chat.length === 0) {
            html += '<div class="empty-state">' +
                '<div class="empty-icon">💬</div>' +
                '<h3>Консультаций пока нет</h3>' +
                '<p>Отметьте дни в списке записей и нажмите «Отправить доктору».</p>' +
                '</div>';
            host.innerHTML = html;
            return;
        }

        for (var i = 0; i < chat.length; i++) {
            var c = chat[i];
            var when = Diary.formatStamp(c.timestamp);
            var daysText = (c.selected_days || []).map(function (d) {
                return Diary.formatDay(d);
            }).join(', ');

            html += '<div class="dv-msg">';
            html += '<div class="dv-msg-user">' +
                '<div class="dv-msg-who">🧑 Вы · ' + UI.escapeHtml(when) + '</div>' +
                '<div class="dv-msg-days">Отправлены дни: ' + UI.escapeHtml(daysText) + '</div>' +
                '</div>';
            html += '<div class="dv-msg-ai">' +
                '<div class="dv-msg-who">🩺 Доктор</div>' +
                '<div class="dv-msg-text">' + Diary.formatReply(c.ai_response) + '</div>' +
                '</div>';
            html += '<div class="dv-msg-actions">' +
                '<button class="btn btn-outline btn-small" onclick="Diary.copyConsult(\'' + c.id + '\')">📋 Копировать</button>' +
                // v2.2: одна кнопка вместо трёх — браузер сам предложит
                // напечатать или сохранить в PDF
                '<button class="btn btn-outline btn-small" title="Печать или сохранение в PDF"' +
                ' onclick="Diary.printConsult(\'' + c.id + '\')">🖨️ Печать / 💾 Файл</button>' +
                '<button class="dv-del" onclick="Diary.deleteConsult(\'' + c.id + '\')" title="Удалить">✕</button>' +
                '</div>';
            html += '</div>';
        }

        host.innerHTML = html;
    },

    findConsult: function (id) {
        var chat = Diary.getChat();
        for (var i = 0; i < chat.length; i++) {
            if (chat[i].id === id) return chat[i];
        }
        return null;
    },

    copyConsult: function (id) {
        var c = Diary.findConsult(id);
        if (!c) return;
        var text = c.ai_response;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
                UI.showToast('Скопировано в буфер обмена');
            }).catch(function () {
                Diary.fallbackCopy(text);
            });
        } else {
            Diary.fallbackCopy(text);
        }
    },

    fallbackCopy: function (text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            UI.showToast('Скопировано в буфер обмена');
        } catch (e) {
            UI.showToast('Не удалось скопировать');
        }
        document.body.removeChild(ta);
    },

    printConsult: function (id) {
        var c = Diary.findConsult(id);
        if (!c) return;
        var days = (c.selected_days || []).map(function (d) { return Diary.formatDay(d); }).join(', ');
        var body = '<h2>Консультация ИИ-доктора</h2>' +
            '<p><strong>Дата консультации:</strong> ' + UI.escapeHtml(Diary.formatStamp(c.timestamp)) + '</p>' +
            '<p><strong>Данные за:</strong> ' + UI.escapeHtml(days) + '</p><hr>' +
            Diary.formatReply(c.ai_response);
        Diary.printDocument('Консультация — ' + days, body);
    },

    deleteConsult: function (id) {
        UI.showConfirm('Удалить консультацию?', 'Запись из истории будет удалена.', 'Удалить', function () {
            var chat = Diary.getChat().filter(function (c) { return c.id !== id; });
            Diary.saveChat(chat);
            UI.showToast('Консультация удалена');
            Diary.renderChat();
        });
    },

    /* ======================================================================
     * ПЕЧАТЬ / PDF (через браузер — «Сохранить как PDF»)
     * ==================================================================== */
    printRecord: function (day) {
        var records = Diary.getRecords();
        var rec = records[day];
        if (!rec) return;

        var rows = Diary.validRows(rec.measurements);
        rows.sort(function (a, b) { return a.time < b.time ? -1 : 1; });

        var body = '<h2>Дневник здоровья за ' + UI.escapeHtml(Diary.formatDay(day)) + '</h2>';
        body += '<table class="grid"><tr>' +
            '<th>№</th><th>Время</th><th>АД верх</th><th>АД низ</th>' +
            '<th>Пульс</th><th>SpO2, %</th><th>Сахар</th><th>t°</th>' +
            '<th>Вес</th><th>ИМТ</th></tr>';
        for (var i = 0; i < rows.length; i++) {
            var m = rows[i];
            body += '<tr>' +
                '<td>' + (i + 1) + '</td>' +
                '<td>' + UI.escapeHtml(m.time || '') + '</td>' +
                '<td>' + Diary.cellText(m.ad_top) + '</td>' +
                '<td>' + Diary.cellText(m.ad_bottom) + '</td>' +
                '<td>' + Diary.cellText(m.pulse) + '</td>' +
                '<td>' + Diary.cellText(m.spo2) + '</td>' +
                '<td>' + Diary.cellText(m.sugar) + '</td>' +
                '<td>' + Diary.cellText(m.temperature) + '</td>' +
                '<td>' + Diary.cellText(m.weight) + '</td>' +
                '<td>' + Diary.cellText(Norms.bmiFor(m.weight)) + '</td>' +
                '<td>' + Diary.cellText(m.weight) + '</td>' +
                '</tr>';
        }
        body += '</table>';
        body += '<p><strong>Всего измерений:</strong> ' + rows.length + '</p>';

        Diary.printDocument('Дневник — ' + Diary.formatDay(day), body);
    },

    cellText: function (v) {
        return (v === null || v === undefined || v === '') ? '—' : String(v);
    },

    printDocument: function (title, bodyHtml) {
        var profileCtx = (typeof Doctor !== 'undefined' && Doctor.getProfileContext)
            ? Doctor.getProfileContext() : '';
        var today = new Date().toLocaleDateString('ru-RU');

        var html = '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">' +
            '<title>' + UI.escapeHtml(title) + '</title><style>' +
            'body{font-family:Arial,sans-serif;max-width:760px;margin:0 auto;padding:30px;' +
            'color:#222;font-size:14px;line-height:1.6}' +
            '.header{text-align:center;border-bottom:2px solid #0066CC;padding-bottom:16px;margin-bottom:24px}' +
            '.header h1{color:#0066CC;margin:0;font-size:22px}' +
            '.header p{margin:4px 0;color:#666;font-size:13px}' +
            '.patient-info{background:#E6F2FF;padding:12px 16px;border-radius:8px;margin-bottom:20px;font-size:13px}' +
            'h2{color:#0066CC;font-size:18px;margin-top:20px}' +
            'h3{color:#0D47A1;font-size:15px;margin-top:16px}' +
            'table.grid{width:100%;border-collapse:collapse;margin:14px 0;font-size:12px}' +
            'table.grid th{background:#0066CC;color:#fff;border:1px solid #CCC;padding:7px 6px;text-align:center}' +
            'table.grid td{border:1px solid #CCC;padding:6px;text-align:center}' +
            'table.grid tr:nth-child(even) td{background:#F9F9F9}' +
            'tr{page-break-inside:avoid;break-inside:avoid}' +
            'p{margin:6px 0}hr{border:none;border-top:1px solid #ddd;margin:16px 0}' +
            '.footer{text-align:center;margin-top:30px;padding-top:16px;border-top:1px solid #ddd;' +
            'color:#999;font-size:11px}' +
            '@media print{body{padding:14px}}' +
            '</style></head><body>' +
            '<div class="header"><h1>🩺 Мой домашний доктор</h1>' +
            '<p>' + UI.escapeHtml(title) + ' · документ от ' + today + '</p></div>' +
            (profileCtx ? '<div class="patient-info">' + UI.escapeHtml(profileCtx).replace(/\n/g, '<br>') + '</div>' : '') +
            bodyHtml +
            '<div class="footer">Документ носит справочный характер и не является медицинским заключением.<br>' +
            'Для постановки диагноза обратитесь к врачу.</div>' +
            '</body></html>';

        var w = window.open('', '_blank');
        if (!w) {
            UI.showToast('Разрешите всплывающие окна для печати', 4000);
            return;
        }
        w.document.write(html);
        w.document.close();
        w.focus();
        w.print();
        UI.showToast('Для сохранения в PDF выберите принтер «Сохранить как PDF»', 5000);
    },

    /* ======================================================================
     * ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
     * ==================================================================== */

    /* Строка считается заполненной, если есть время и хотя бы один показатель */
    rowHasValues: function (m) {
        if (!m) return false;
        return !!(m.ad_top || m.ad_bottom || m.pulse || m.spo2 ||
            m.sugar || m.temperature || m.weight);
    },

    /* ======================================================================
     * ОТКЛОНЕНИЯ ОТ ИНДИВИДУАЛЬНЫХ НОРМ (ТЗ v3.1 часть 2, разделы 2, 4, 5)
     *
     * Норма берётся из справочника Norms по возрасту и диагнозам активного
     * профиля. Отклонение считается от ближайшей границы диапазона:
     * до 5% — норма, 5–15% — жёлтое, больше 15% — красное.
     * ==================================================================== */

    /* Показатели, по которым проверяются отклонения */
    DEV_FIELDS: [
        { norm: 'ad_top', from: 'ad_top', label: 'АД верх' },
        { norm: 'ad_bottom', from: 'ad_bottom', label: 'АД низ' },
        { norm: 'pulse', from: 'pulse', label: 'Пульс' },
        { norm: 'spo2', from: 'spo2', label: 'SpO2' },
        { norm: 'sugar', from: 'sugar', label: 'Сахар' },
        { norm: 'temp', from: 'temperature', label: 't°' },
        { norm: 'bmi', from: '_bmi', label: 'ИМТ' }
    ],

    /* Статья норм для активного профиля; null — если данных в карточке мало */
    article: function () {
        return Norms.articleFor(Storage.getActiveProfile());
    },

    /* Уровень отклонения одного значения: '', 'warn' или 'danger' */
    level: function (field, value) {
        var res = Norms.check(Diary.article(), field, value);
        return res ? res.level : '';
    },

    /* Оборачивает текст значения в цветную метку, если есть отклонение.
       Для давления на вход приходит пара [верхнее, нижнее]. */
    mark: function (field, value, text) {
        var lvl;
        if (field === 'ad') {
            var top = Diary.level('ad_top', value[0]);
            var bottom = Diary.level('ad_bottom', value[1]);
            lvl = (top === 'danger' || bottom === 'danger') ? 'danger'
                : ((top || bottom) ? 'warn' : '');
        } else {
            lvl = Diary.level(field, value);
        }
        var safe = UI.escapeHtml(text);
        return lvl ? '<span class="dv-val dv-val-' + lvl + '">' + safe + '</span>' : safe;
    },

    /* ----------------------------------------------------------------------
     * Перечень отклонений за день: время, показатель, значение, норма,
     * процент. Значения в пределах нормы в перечень не попадают.
     * Красные идут перед жёлтыми (раздел 5 ТЗ).
     * -------------------------------------------------------------------- */
    deviations: function (rec) {
        var out = [];
        if (!rec || !rec.measurements) return out;

        var article = Diary.article();
        if (!article) return out;   // без даты рождения норму не подобрать

        var profile = Storage.getActiveProfile();
        var height = profile ? profile.height : null;

        var rows = Diary.validRows(rec.measurements);
        rows.sort(function (a, b) { return a.time < b.time ? -1 : 1; });

        for (var i = 0; i < rows.length; i++) {
            var m = rows[i];

            for (var j = 0; j < Diary.DEV_FIELDS.length; j++) {
                var f = Diary.DEV_FIELDS[j];

                // ИМТ не хранится, а считается по весу и росту из карточки
                var value = (f.from === '_bmi')
                    ? Norms.bmi(m.weight, height)
                    : m[f.from];

                var res = Norms.check(article, f.norm, value);
                if (!res || !res.level) continue;

                out.push({
                    time: m.time,
                    label: f.label,
                    value: value,
                    bound: res.bound,
                    range: res.range,
                    percent: res.percent,
                    level: res.level
                });
            }
        }

        // Сначала красные, внутри группы — по времени
        out.sort(function (a, b) {
            if (a.level !== b.level) return a.level === 'danger' ? -1 : 1;
            return a.time < b.time ? -1 : (a.time > b.time ? 1 : 0);
        });
        return out;
    },

    /* Сколько красных и жёлтых отклонений за день */
    dayCounts: function (rec) {
        var devs = Diary.deviations(rec);
        var danger = 0, warn = 0;
        for (var i = 0; i < devs.length; i++) {
            if (devs[i].level === 'danger') danger++; else warn++;
        }
        return { danger: danger, warn: warn, total: devs.length };
    },

    /* Худший уровень за весь день */
    dayLevel: function (rec) {
        var c = Diary.dayCounts(rec);
        if (c.danger > 0) return 'danger';
        if (c.warn > 0) return 'warn';
        return '';
    },

    /* ----------------------------------------------------------------------
     * Валидация №17: уровни тревожности сатурации (ТЗ раздел 2.4).
     * Возвращает текст предупреждения или пустую строку, если всё в норме.
     * Значения вне 85–100 отсекаются раньше проверкой диапазона.
     * -------------------------------------------------------------------- */
    spo2Alert: function (v) {
        if (v === null || v === undefined || isNaN(v)) return '';
        if (v < 88) return 'КРИТИЧЕСКИ НИЗКАЯ САТУРАЦИЯ! Требуется помощь!';
        if (v < 92) return 'НИЗКАЯ САТУРАЦИЯ! Проверьте кислород!';
        if (v < 95) return 'Сатурация низкая, рекомендуется контроль';
        return '';
    },

    filledCount: function (list) {
        if (!list) return 0;
        var n = 0;
        for (var i = 0; i < list.length; i++) {
            if (Diary.rowHasValues(list[i])) n++;
        }
        return n;
    },

    /* Строки, годные для сохранения: есть время и хотя бы один показатель */
    validRows: function (list) {
        var out = [];
        if (!list) return out;
        for (var i = 0; i < list.length; i++) {
            var m = list[i];
            if (m && m.time && Diary.rowHasValues(m)) {
                out.push(JSON.parse(JSON.stringify(m)));
            }
        }
        return out;
    },

    lastMeasurement: function (list) {
        var rows = Diary.validRows(list);
        if (rows.length === 0) return null;
        rows.sort(function (a, b) { return a.time < b.time ? -1 : 1; });
        return rows[rows.length - 1];
    },

    /* Приводит ввод к формату ЧЧ:ММ. Понимает «8:00», «0800», «08.00» */
    normalizeTime: function (raw) {
        var s = raw.replace(/[.\-\s]/g, ':');
        if (s.match(/^\d{3,4}$/)) {
            s = s.length === 3 ? '0' + s : s;
            s = s.substring(0, 2) + ':' + s.substring(2);
        }
        var parts = s.split(':');
        if (parts.length !== 2) return null;
        if (!parts[0].match(/^\d{1,2}$/) || !parts[1].match(/^\d{1,2}$/)) return null;
        var hh = parts[0].length === 1 ? '0' + parts[0] : parts[0];
        var mm = parts[1].length === 1 ? '0' + parts[1] : parts[1];
        if (!(hh + ':' + mm).match(/^\d{2}:\d{2}$/)) return null;
        return hh + ':' + mm;
    },

    formatDay: function (day) {
        if (!day) return '';
        return UI.formatDate(day);
    },

    /* Короткий формат ДД.ММ.ГГГГ — используется также в разделе «Анализы» */
    formatDate: function (dateStr) {
        if (!dateStr) return '';
        var parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        return parts[2] + '.' + parts[1] + '.' + parts[0];
    },

    formatStamp: function (iso) {
        if (!iso) return '';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        return d.toLocaleDateString('ru-RU') + ' ' +
            String(d.getHours()).padStart(2, '0') + ':' +
            String(d.getMinutes()).padStart(2, '0');
    },

    plural: function (n, one, few, many) {
        var lastTwo = n % 100;
        var lastOne = n % 10;
        if (lastTwo >= 11 && lastTwo <= 19) return many;
        if (lastOne === 1) return one;
        if (lastOne >= 2 && lastOne <= 4) return few;
        return many;
    },

    /* Простое оформление ответа доктора: заголовки, списки, жирный текст */
    formatReply: function (text) {
        if (!text) return '';
        var lines = String(text).split('\n');
        var html = '';
        var inList = false;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var trimmed = line.trim();

            if (trimmed === '') {
                if (inList) { html += '</ul>'; inList = false; }
                continue;
            }

            if (trimmed.match(/^#{1,4}\s/)) {
                if (inList) { html += '</ul>'; inList = false; }
                var text2 = UI.escapeHtml(trimmed.replace(/^#{1,4}\s/, ''));
                html += '<h3>' + text2 + '</h3>';
                continue;
            }

            if (trimmed.match(/^[-•*]\s/)) {
                if (!inList) { html += '<ul>'; inList = true; }
                html += '<li>' + Diary.inlineFormat(trimmed.replace(/^[-•*]\s/, '')) + '</li>';
                continue;
            }

            if (inList) { html += '</ul>'; inList = false; }
            html += '<p>' + Diary.inlineFormat(trimmed) + '</p>';
        }
        if (inList) html += '</ul>';
        return html;
    },

    inlineFormat: function (s) {
        return UI.escapeHtml(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    }
};
