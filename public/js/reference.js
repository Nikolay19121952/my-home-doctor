/* ============================================================================
 * СПРАВОЧНИК ПОКАЗАТЕЛЕЙ ЗДОРОВЬЯ — версия 3.7
 * Реализация по ТЗ v3.4, пункт 12.
 *
 * Раздел показывает ту же таблицу норм, по которой приложение красит
 * отклонения в дневнике и точки на графиках. Источник данных один —
 * объект Norms, поэтому справочник не может разойтись с дневником:
 * если норма поменяется в одном месте, она поменяется и здесь.
 *
 * Задача раздела — чтобы человек понимал, откуда берётся жёлтая или
 * красная отметка, и не пугался её без причины.
 * ========================================================================== */

var Reference = {

    /* Колонки таблицы: поле статьи, заголовок, единицы измерения */
    COLUMNS: [
        { key: 'ad_top', title: 'АД верх', unit: 'мм рт. ст.' },
        { key: 'ad_bottom', title: 'АД низ', unit: 'мм рт. ст.' },
        { key: 'pulse', title: 'Пульс', unit: 'уд/мин' },
        { key: 'spo2', title: 'SpO₂', unit: '%' },
        { key: 'sugar', title: 'Гликемия натощак', unit: 'ммоль/л' },
        { key: 'sugar_after', title: 'Гликемия после еды', unit: 'ммоль/л' },
        { key: 'temp', title: 'Температура', unit: '°C' },
        { key: 'bmi', title: 'ИМТ', unit: 'кг/м²' }
    ],

    /* ----------------------------------------------------------------------
     * Пояснения «почему такие границы».
     *
     * Клинические обоснования по гликемии взяты из «Клинического справочника
     * целевых уровней гликемии» (ВОЗ). Остальное — из технических заданий
     * Доктора, редакции v3.1–v3.4.
     * -------------------------------------------------------------------- */
    WHY: {
        child_3_5: 'Обмен веществ у ребёнка нестабилен, запасы гликогена в печени ' +
            'невелики, поэтому натощак допускаются более низкие значения сахара. ' +
            'Пульс в этом возрасте заметно чаще взрослого — это норма.',
        child_6_11: 'Классический детский коридор показателей. Для гликемии важна ' +
            'стабильность режима питания.',
        teen_12_17: 'Период полового созревания: гормональные пики вызывают ' +
            'физиологическую невосприимчивость к инсулину, поэтому колебания сахара ' +
            'в этом возрасте обычны.',
        young_18_40: 'Стандарты оптимального обмена веществ у людей с минимальным ' +
            'сердечно-сосудистым риском.',
        adult_41_64: 'Возраст, в котором повышается риск скрытого предиабета. ' +
            'Значения натощак 5.6–6.9 ммоль/л уже считаются нарушенной гликемией.',
        senior_65: 'С возрастом снижается переносимость глюкозы, а излишне жёсткий ' +
            'контроль давления и сахара становится опаснее умеренно повышенных ' +
            'значений. Поэтому границы мягче, чем у молодых.',
        pregnant: 'Критерии ВОЗ для беременных предельно строгие: превышение ' +
            '5.1 ммоль/л натощак классифицируется как гестационный диабет. ' +
            'Прибавка веса оценивается по графику триместров, а не по ИМТ.',

        hypertension1: 'Органы-мишени пока не пострадали. Гликемия держится в узком ' +
            'коридоре, чтобы исключить сосудистые осложнения.',
        hypertension2: 'Умеренно повышен риск ишемических атак. Резкие падения сахара ' +
            'вызывают выброс адреналина и гипертонические кризы, поэтому нижняя ' +
            'граница гликемии поднята.',
        hypertension3: 'Крайне высокий риск сосудистых катастроф. Резкие падения ' +
            'сахара категорически нежелательны, границы смещены вверх.',
        hypertension_bca: 'Ишемизированный миокард и суженные сонные артерии очень ' +
            'чувствительны к падению сахара и давления. Цели по гликемии сознательно ' +
            'завышены: недостаток глюкозы здесь опаснее её избытка.',
        hypotension: 'При хронически низком давлении важно исключить гипогликемию — ' +
            'она даёт похожие симптомы: слабость, потемнение в глазах, дурноту.',

        diabetes1: 'Полный дефицит инсулина. Цели гибкие и ориентированы на то, ' +
            'чтобы не допустить ночных падений сахара.',
        diabetes2: 'Невосприимчивость тканей к инсулину. Границы уточняются врачом ' +
            'по возрасту и сопутствующим болезням, ориентир по HbA1c — ниже 6.5–7.0%.',
        diabetes3: 'Специфические формы, включая панкреатогенный диабет. Из-за ' +
            'нехватки глюкагона высок риск падений сахара, поэтому контроль мягкий.',

        copd: 'Хроническая нехватка кислорода в тканях. Сатурация 90–96% для такого ' +
            'пациента рабочая, а не тревожная. Лечение гормонами закономерно ' +
            'повышает сахар.',
        heart_failure: 'Сердечной мышце в условиях недостаточности нужен стабильный ' +
            'приток глюкозы без провалов. Низкое давление при этом может быть опасно.',
        arrhythmia: 'Падение сахара вызывает выброс катехоламинов и может ' +
            'спровоцировать приступ фибрилляции предсердий. Важнее регулярность ' +
            'пульса, чем его частота.',
        hypothyroidism: 'При компенсированном гипотиреозе показатели обычные. ' +
            'Некомпенсированный замедляет обмен: температура падает, глюкоза ' +
            'усваивается хуже.',
        anemia: 'Учащённый пульс при нормальном давлении — типичный признак. ' +
            'Из-за укороченной жизни эритроцитов анализ на HbA1c неточен, ' +
            'сахар контролируется только глюкометром.',
        ckd: 'Снижена почечная фильтрация и разрушение инсулина, поэтому падения ' +
            'сахара бывают тяжёлыми и затяжными. Границы подняты. Давление влияет ' +
            'на почки напрямую и требует особого внимания.'
    },

    /* --- Состояние --------------------------------------------------------- */
    _search: '',
    _group: 'all',       // all | age | diagnosis | mine
    _openId: null,       // раскрытая статья
    _seen: [],           // история просмотров (ТЗ, раздел З)

    /* Все статьи в одном списке, с пометкой вида */
    articles: function () {
        var out = [];
        var i;
        for (i = 0; i < Norms.AGE_ARTICLES.length; i++) {
            out.push({ a: Norms.AGE_ARTICLES[i], kind: 'age' });
        }
        for (i = 0; i < Norms.DIAGNOSIS_ARTICLES.length; i++) {
            out.push({ a: Norms.DIAGNOSIS_ARTICLES[i], kind: 'diagnosis' });
        }
        return out;
    },

    /* Статьи, подходящие активному профилю */
    mineIds: function () {
        var p = Storage.getActiveProfile();
        if (!p) return [];

        var age = UI.calculateAge(p.birthDate);
        var ids = [];

        if (age !== null) {
            var byAge = Norms.ageArticle(age);
            if (byAge) ids.push(byAge.id);
        }
        var diagnoses = Norms.normalizeIds(p.diagnoses || []);
        for (var i = 0; i < diagnoses.length; i++) ids.push(diagnoses[i]);
        return ids;
    },

    filtered: function () {
        var all = Reference.articles();
        var mine = Reference.mineIds();
        var q = Reference._search.toLowerCase().trim();
        var out = [];

        for (var i = 0; i < all.length; i++) {
            var item = all[i];

            if (Reference._group === 'age' && item.kind !== 'age') continue;
            if (Reference._group === 'diagnosis' && item.kind !== 'diagnosis') continue;
            if (Reference._group === 'mine' && mine.indexOf(item.a.id) === -1) continue;

            if (q && item.a.title.toLowerCase().indexOf(q) === -1) continue;

            out.push(item);
        }
        return out;
    },

    /* ======================================================================
     * ОТРИСОВКА
     * ==================================================================== */
    show: function () {
        More.currentView = 'reference';
        Reference.render();
    },

    render: function () {
        var host = document.querySelector('#more .container');
        if (!host) return;

        var list = Reference.filtered();
        var mine = Reference.mineIds();

        var html = '<div class="section-header">' +
            '<button class="btn btn-outline btn-back" onclick="More.showMenu()">← Назад</button>' +
            '<h2>Справочник показателей здоровья</h2>' +
            '</div>';

        html += '<p class="rf-intro">Это те самые границы, по которым приложение ' +
            'отмечает измерения жёлтым и красным. Жёлтая отметка — не диагноз, ' +
            'а повод посмотреть внимательнее.</p>';

        // --- Поиск и фильтры ---
        html += '<div class="rf-tools">' +
            '<input type="search" id="rf-search" class="rf-search" placeholder="Поиск по названию" ' +
            'value="' + UI.escapeHtml(Reference._search) + '" oninput="Reference.onSearch(this.value)">' +
            '<div class="rf-filters">' +
            Reference.filterBtn('all', 'Все') +
            Reference.filterBtn('age', 'По возрасту') +
            Reference.filterBtn('diagnosis', 'По диагнозам') +
            (mine.length ? Reference.filterBtn('mine', '⭐ Мои нормы') : '') +
            '</div>' +
            '<div class="rf-actions">' +
            '<button class="btn btn-outline btn-small" onclick="Reference.print()">🖨️ / 📄 Печать</button>' +
            '<button class="btn btn-outline btn-small" onclick="Reference.copy()">📋 Копировать</button>' +
            (Reference._group !== 'all' || Reference._search
                ? '<button class="btn btn-outline btn-small" onclick="Reference.reset()">Сбросить</button>'
                : '') +
            '</div></div>';

        if (Reference._seen.length > 0) {
            html += '<p class="rf-seen">Недавно смотрели: ';
            var seen = [];
            for (var s = 0; s < Reference._seen.length; s++) {
                var art = Norms.byId(Reference._seen[s]);
                if (!art) continue;
                seen.push('<button class="rf-seen-btn" onclick="Reference.open(\'' +
                    art.id + '\')">' + UI.escapeHtml(art.title) + '</button>');
            }
            html += seen.join(' · ') + '</p>';
        }

        if (list.length === 0) {
            html += '<div class="empty-state"><div class="empty-icon">🔎</div>' +
                '<h3>Ничего не найдено</h3><p>Измените запрос или сбросьте фильтр.</p></div>';
        } else {
            html += Reference.tableHtml(list, mine);
        }

        html += '<div class="rf-sources"><strong>Источники</strong><ul>';
        for (var k = 0; k < Norms.SOURCES.length; k++) {
            html += '<li>' + UI.escapeHtml(Norms.SOURCES[k]) + '</li>';
        }
        html += '</ul><p>⚠️ ' + UI.escapeHtml(Norms.COMMON_NOTE) + '</p></div>';

        host.innerHTML = html;
    },

    filterBtn: function (id, label) {
        return '<button class="rf-filter' + (Reference._group === id ? ' rf-filter-on' : '') +
            '" onclick="Reference.setGroup(\'' + id + '\')">' + label + '</button>';
    },

    tableHtml: function (list, mine) {
        var html = '<div class="rf-tablewrap"><table class="rf-table"><thead><tr>' +
            '<th class="rf-c-name">Категория</th>';

        for (var c = 0; c < Reference.COLUMNS.length; c++) {
            html += '<th title="' + UI.escapeHtml(Reference.COLUMNS[c].unit) + '">' +
                Reference.COLUMNS[c].title +
                '<span class="rf-unit">' + Reference.COLUMNS[c].unit + '</span></th>';
        }
        html += '</tr></thead><tbody>';

        for (var i = 0; i < list.length; i++) {
            var a = list[i].a;
            var isMine = mine.indexOf(a.id) !== -1;
            var open = Reference._openId === a.id;

            html += '<tr class="' + (isMine ? 'rf-row-mine' : '') + '">' +
                '<td class="rf-c-name">' +
                '<button class="rf-name" onclick="Reference.open(\'' + a.id + '\')">' +
                (isMine ? '⭐ ' : '') + UI.escapeHtml(a.title) +
                '<span class="rf-more">' + (open ? 'скрыть' : 'подробнее') + '</span>' +
                '</button></td>';

            for (var k = 0; k < Reference.COLUMNS.length; k++) {
                html += '<td>' + Reference.range(a, Reference.COLUMNS[k].key) + '</td>';
            }
            html += '</tr>';

            if (open) {
                html += '<tr class="rf-details"><td colspan="' +
                    (Reference.COLUMNS.length + 1) + '">' +
                    Reference.detailsHtml(a) + '</td></tr>';
            }
        }

        return html + '</tbody></table></div>';
    },

    range: function (article, key) {
        var r = article[key];
        if (!r) return '<span class="rf-none">по возрасту</span>';
        return Norms.num(r[0]) + '–' + Norms.num(r[1]);
    },

    detailsHtml: function (a) {
        var html = '<div class="rf-det">';
        html += '<h4>' + UI.escapeHtml(a.title) + '</h4>';

        // Возрастные ограничения статьи
        var limits = [];
        if (a.minAge !== undefined && a.minAge > 0) limits.push('от ' + a.minAge + ' лет');
        if (a.maxAge !== undefined && a.maxAge < 200) limits.push('до ' + a.maxAge + ' лет');
        if (limits.length) {
            html += '<p class="rf-det-age">Применяется: ' + limits.join(', ') + '</p>';
        }

        html += '<p><strong>Почему такие границы.</strong> ' +
            UI.escapeHtml(Reference.WHY[a.id] || 'Границы соответствуют рекомендациям ВОЗ ' +
                'для этой категории.') + '</p>';

        if (a.note) {
            html += '<p class="rf-det-note">⚠️ ' + UI.escapeHtml(a.note) + '</p>';
        }

        html += '<p><strong>Как приложение это использует.</strong> Значение внутри ' +
            'границ отметки не получает. Отклонение в пределах одного «шага тревоги» ' +
            'даёт жёлтую отметку, дальше шага — красную. Шаги: давление 15 и 10 ' +
            'единиц, пульс 15, сатурация 3, гликемия 1, температура 0.5, ИМТ 3.</p>';

        html += '<p><strong>Связь показателей.</strong> Давление и пульс смотрят ' +
            'вместе: учащённый пульс при нормальном давлении и высокое давление ' +
            'при редком пульсе означают разное. Падение сахара поднимает пульс и ' +
            'давление, поэтому при слабости стоит измерить и то, и другое.</p>';

        html += '<p class="rf-det-src">Источник: ' + UI.escapeHtml(Norms.SOURCES[0]) +
            ', ' + UI.escapeHtml(Norms.SOURCES[1]) + '</p>';

        html += '</div>';
        return html;
    },

    /* ======================================================================
     * ДЕЙСТВИЯ
     * ==================================================================== */
    onSearch: function (value) {
        Reference._search = value;
        Reference.render();
        var box = document.getElementById('rf-search');
        if (box) {
            box.focus();
            box.setSelectionRange(box.value.length, box.value.length);
        }
    },

    setGroup: function (id) {
        Reference._group = id;
        Reference._openId = null;
        Reference.render();
    },

    reset: function () {
        Reference._search = '';
        Reference._group = 'all';
        Reference._openId = null;
        Reference.render();
    },

    open: function (id) {
        Reference._openId = (Reference._openId === id) ? null : id;

        if (Reference._openId) {
            var seen = Reference._seen.filter(function (x) { return x !== id; });
            seen.unshift(id);
            Reference._seen = seen.slice(0, 5);
        }
        Reference.render();
    },

    /* ----------------------------------------------------------------------
     * Печать: только то, что сейчас на экране после фильтра.
     * -------------------------------------------------------------------- */
    print: function () {
        var list = Reference.filtered();
        if (list.length === 0) {
            UI.showToast('Нечего печатать: список пуст', 3000);
            return;
        }

        var body = '<h2>Справочник показателей здоровья</h2>';
        body += '<p>Границы, по которым приложение отмечает измерения. ' +
            'Категорий в документе: ' + list.length + '.</p>';

        body += '<table class="grid"><tr><th>Категория</th>';
        for (var c = 0; c < Reference.COLUMNS.length; c++) {
            body += '<th>' + Reference.COLUMNS[c].title + ', ' +
                Reference.COLUMNS[c].unit + '</th>';
        }
        body += '</tr>';

        for (var i = 0; i < list.length; i++) {
            var a = list[i].a;
            body += '<tr><td style="text-align:left">' + UI.escapeHtml(a.title) + '</td>';
            for (var k = 0; k < Reference.COLUMNS.length; k++) {
                var r = a[Reference.COLUMNS[k].key];
                body += '<td>' + (r ? Norms.num(r[0]) + '–' + Norms.num(r[1]) : 'по возрасту') + '</td>';
            }
            body += '</tr>';
        }
        body += '</table>';

        body += '<h3>Пояснения</h3>';
        for (var j = 0; j < list.length; j++) {
            var art = list[j].a;
            body += '<p><strong>' + UI.escapeHtml(art.title) + '.</strong> ' +
                UI.escapeHtml(Reference.WHY[art.id] || '') +
                (art.note ? ' ' + UI.escapeHtml(art.note) : '') + '</p>';
        }

        body += '<h3>Источники</h3><ul>';
        for (var s = 0; s < Norms.SOURCES.length; s++) {
            body += '<li>' + UI.escapeHtml(Norms.SOURCES[s]) + '</li>';
        }
        body += '</ul><p>⚠️ ' + UI.escapeHtml(Norms.COMMON_NOTE) + '</p>';

        Diary.printDocument('Справочник показателей здоровья', body);
    },

    /* Копирование в буфер — чтобы отправить врачу в мессенджере */
    copy: function () {
        var list = Reference.filtered();
        if (list.length === 0) {
            UI.showToast('Нечего копировать: список пуст', 3000);
            return;
        }

        var lines = ['СПРАВОЧНИК ПОКАЗАТЕЛЕЙ ЗДОРОВЬЯ', ''];
        for (var i = 0; i < list.length; i++) {
            var a = list[i].a;
            lines.push(a.title + ':');
            for (var k = 0; k < Reference.COLUMNS.length; k++) {
                var col = Reference.COLUMNS[k];
                var r = a[col.key];
                lines.push('  ' + col.title + ': ' +
                    (r ? Norms.num(r[0]) + '–' + Norms.num(r[1]) + ' ' + col.unit : 'по возрасту'));
            }
            if (a.note) lines.push('  Примечание: ' + a.note);
            lines.push('');
        }
        lines.push('Источники: ' + Norms.SOURCES.join('; '));
        lines.push(Norms.COMMON_NOTE);

        Doctor.copyReply(lines.join('\n'));
    }
};
