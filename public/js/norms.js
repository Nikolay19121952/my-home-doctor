/* ============================================================================
 * ИНДИВИДУАЛЬНЫЕ НОРМЫ ИЗМЕРЕНИЙ — версия 3.2
 * Реализация по ТЗ «Доработки v3.1 — часть 3 (финальная версия)».
 *
 * Норма подбирается под конкретного человека: по возрасту из даты рождения
 * и по диагнозам из карточки профиля. Отклонение считается от ближайшей
 * границы диапазона: 125 при норме 140–180 даёт −10.7%.
 *
 * Что изменилось по сравнению с частью 2:
 *   • гипертония разделена на три степени, диабет — на три типа (раздел 1);
 *   • диагнозы одной группы взаимно исключают друг друга (раздел 2);
 *   • диапазоны расширены, чтобы не создавать ложных тревог (раздел 3);
 *   • у каждой статьи появилось примечание о консультации врача (раздел 4);
 *   • пороги отклонений: 5–20% жёлтое, свыше 20% красное (раздел 5).
 *
 * ВАЖНО. Границы ориентировочные. Они нужны только для предварительной
 * подсветки при вводе измерений; персональную норму определяет врач.
 * ========================================================================== */

var Norms = {

    /* Показатели, по которым задаются диапазоны */
    FIELDS: ['ad_top', 'ad_bottom', 'pulse', 'spo2', 'sugar', 'temp', 'bmi'],

    /* Общее примечание, обязательное по разделу 4 ТЗ */
    COMMON_NOTE: 'Границы ориентировочные. Для определения вашей персональной ' +
        'нормы проконсультируйтесь с врачом!',

    /* --- Возрастные статьи ------------------------------------------------ */
    AGE_ARTICLES: [
        {
            id: 'child_3_5', title: 'Дети 3–5 лет', minAge: 3, maxAge: 5,
            ad_top: [95, 115], ad_bottom: [55, 75], pulse: [80, 130],
            spo2: [97, 100], sugar: [3.3, 5.5], temp: [36.3, 37.2], bmi: [14.0, 18.5]
        },
        {
            id: 'child_6_11', title: 'Дети 6–11 лет', minAge: 6, maxAge: 11,
            ad_top: [100, 125], ad_bottom: [60, 80], pulse: [70, 110],
            spo2: [97, 100], sugar: [3.5, 5.5], temp: [36.2, 37.0], bmi: [14.5, 21.0]
        },
        {
            id: 'teen_12_17', title: 'Подростки 12–17 лет', minAge: 12, maxAge: 17,
            ad_top: [110, 140], ad_bottom: [65, 90], pulse: [60, 100],
            spo2: [97, 100], sugar: [3.3, 5.5], temp: [36.2, 37.0], bmi: [16.0, 23.0]
        },
        {
            id: 'young_18_40', title: 'Молодые взрослые 18–40 лет', minAge: 18, maxAge: 40,
            ad_top: [100, 135], ad_bottom: [60, 90], pulse: [60, 100],
            spo2: [96, 100], sugar: [3.3, 5.5], temp: [36.2, 36.9], bmi: [18.5, 24.9]
        },
        {
            id: 'adult_41_64', title: 'Взрослые 41–64 года', minAge: 41, maxAge: 64,
            ad_top: [110, 140], ad_bottom: [65, 90], pulse: [60, 100],
            spo2: [95, 100], sugar: [3.3, 5.5], temp: [36.2, 36.9], bmi: [18.5, 24.9]
        },
        {
            id: 'senior_65', title: 'Пожилые 65 лет и старше', minAge: 65, maxAge: 200,
            ad_top: [120, 150], ad_bottom: [75, 95], pulse: [55, 85],
            spo2: [94, 98], sugar: [4.0, 6.5], temp: [36.0, 36.7], bmi: [20.0, 28.0]
        }
    ],

    /* ----------------------------------------------------------------------
     * Статьи по диагнозам (раздел 3 ТЗ, таблица с расширенными границами).
     *
     * group — группа взаимоисключающих диагнозов: степень гипертонии может
     * быть только одна, тип диабета тоже один (раздел 2 ТЗ).
     * -------------------------------------------------------------------- */
    DIAGNOSIS_ARTICLES: [
        {
            id: 'hypertension1', title: 'Гипертония 1-й степени',
            short: 'Гипертония 1 ст.', group: 'hypertension', minAge: 18,
            ad_top: [140, 180], ad_bottom: [90, 110], pulse: [55, 90],
            spo2: [95, 100], sugar: [3.3, 5.5], temp: [36.2, 36.9], bmi: [18.5, 27.0],
            note: 'Границы ориентировочные, уточните с врачом.'
        },
        {
            id: 'hypertension2', title: 'Гипертония 2-й степени',
            short: 'Гипертония 2 ст.', group: 'hypertension', minAge: 18,
            ad_top: [160, 200], ad_bottom: [100, 120], pulse: [55, 90],
            spo2: [95, 100], sugar: [3.3, 5.5], temp: [36.2, 36.9], bmi: [18.5, 27.0],
            note: 'Требует постоянного контроля, консультируйтесь с врачом.'
        },
        {
            id: 'hypertension3', title: 'Гипертония 3-й степени',
            short: 'Гипертония 3 ст.', group: 'hypertension', minAge: 18,
            ad_top: [180, 220], ad_bottom: [120, 140], pulse: [55, 90],
            spo2: [95, 100], sugar: [3.3, 5.5], temp: [36.2, 36.9], bmi: [18.5, 27.0],
            note: 'Критично! Требует немедленного контроля и консультации врача.'
        },
        {
            id: 'hypertension_bca', title: 'Гипертония 2-й степени с атеросклерозом БЦА',
            short: 'Гипертония 2 ст. + атеросклероз БЦА',
            group: 'hypertension', minAge: 70,
            ad_top: [110, 180], ad_bottom: [65, 110], pulse: [55, 80],
            spo2: [94, 100], sugar: [4.0, 6.5], temp: [36.0, 36.8], bmi: [20.0, 28.0],
            note: 'Сужение сосудов требует особого контроля. ' +
                'Ваша персональная норма определяется врачом!'
        },
        {
            id: 'diabetes1', title: 'Сахарный диабет 1 типа',
            short: 'Диабет 1 типа', group: 'diabetes', minAge: 0,
            ad_top: [110, 135], ad_bottom: [65, 85], pulse: [60, 100],
            spo2: [97, 100], sugar: [4.5, 8.5], sugarAfterMeal: [4.5, 10.0],
            temp: [36.2, 37.0], bmi: [18.5, 23.0],
            note: 'Контроль сахара критичен! Целевые значения уточняются с эндокринологом.'
        },
        {
            id: 'diabetes2', title: 'Сахарный диабет 2 типа',
            short: 'Диабет 2 типа', group: 'diabetes', minAge: 40,
            ad_top: [130, 150], ad_bottom: [80, 100], pulse: [60, 90],
            spo2: [95, 100], sugar: [4.5, 8.5], sugarAfterMeal: [4.5, 10.0],
            temp: [36.2, 36.9], bmi: [18.5, 25.0],
            note: 'Требует постоянного мониторинга, уточните норму с эндокринологом.'
        },
        {
            id: 'diabetes3', title: 'Сахарный диабет 3 типа',
            short: 'Диабет 3 типа', group: 'diabetes', minAge: 0,
            ad_top: [110, 140], ad_bottom: [65, 90], pulse: [60, 100],
            spo2: [95, 100], sugar: [4.5, 8.5], sugarAfterMeal: [4.5, 10.0],
            temp: [36.2, 36.9], bmi: [18.5, 25.0],
            note: 'Редкая форма, требует специализированной консультации.'
        },
        {
            id: 'copd', title: 'ХОБЛ', short: 'ХОБЛ', minAge: 40,
            ad_top: [120, 150], ad_bottom: [75, 95], pulse: [60, 95],
            spo2: [90, 96], sugar: [3.3, 5.5], temp: [36.2, 36.9], bmi: [18.5, 25.0],
            note: 'Сатурация ниже 90% требует дополнительного кислорода!'
        },
        {
            id: 'heart_failure', title: 'Хроническая сердечная недостаточность',
            short: 'ХСН', minAge: 50,
            ad_top: [95, 135], ad_bottom: [55, 85], pulse: [50, 85],
            spo2: [95, 100], sugar: [3.3, 5.5], temp: [36.2, 36.9], bmi: [18.5, 25.0],
            note: 'Низкое давление может быть опасно! ' +
                'Контролируйте слабость и одышку.'
        },
        {
            id: 'arrhythmia', title: 'Аритмия', short: 'Аритмия', minAge: 18,
            ad_top: [100, 145], ad_bottom: [60, 95], pulse: [40, 120],
            spo2: [95, 100], sugar: [3.3, 5.5], temp: [36.2, 36.9], bmi: [18.5, 25.0],
            note: 'Главное — регулярность пульса, а не его частота. ' +
                'Перебои требуют консультации кардиолога.'
        },
        {
            id: 'hypothyroidism', title: 'Гипотиреоз', short: 'Гипотиреоз', minAge: 18,
            ad_top: [110, 140], ad_bottom: [65, 90], pulse: [50, 80],
            spo2: [95, 100], sugar: [3.3, 5.5], temp: [35.5, 36.5], bmi: [20.0, 28.0],
            note: 'Низкая температура вместе с усталостью — проверьте лечение.'
        },
        {
            id: 'anemia', title: 'Анемия', short: 'Анемия', minAge: 0,
            ad_top: [100, 135], ad_bottom: [60, 90], pulse: [70, 110],
            spo2: [94, 100], sugar: [3.3, 5.5], temp: [36.2, 36.9], bmi: null,
            note: 'Высокий пульс при нормальном давлении — типичный признак.'
        },
        {
            id: 'ckd', title: 'Хроническая болезнь почек 3–4 стадии',
            short: 'ХБП 3–4', minAge: 50,
            ad_top: [130, 150], ad_bottom: [80, 100], pulse: [60, 90],
            spo2: [95, 100], sugar: [4.0, 6.5], temp: [36.2, 36.9], bmi: [18.5, 25.0],
            note: 'Давление критично влияет на почки! Контролируйте его особенно тщательно.'
        },
        {
            id: 'pregnant', title: 'Беременность', short: 'Беременность', minAge: 0,
            ad_top: [100, 150], ad_bottom: [60, 95], pulse: [70, 100],
            spo2: [95, 100], sugar: [3.5, 8.0], temp: [36.3, 37.0], bmi: null,
            note: 'Набор веса — строго по графику триместров, наблюдение у врача обязательно.'
        }
    ],

    /* Диагнозы для выбора в карточке профиля */
    DIAGNOSIS_LIST: function () {
        var out = [{ id: 'none', title: 'Хронических заболеваний нет' }];
        for (var i = 0; i < Norms.DIAGNOSIS_ARTICLES.length; i++) {
            var a = Norms.DIAGNOSIS_ARTICLES[i];
            out.push({ id: a.id, title: a.title, group: a.group || '' });
        }
        return out;
    },

    /* Ключевые слова для переноса диагнозов, записанных текстом */
    KEYWORDS: [
        { id: 'hypertension_bca', words: ['атеросклероз бца', 'атеросклероз брахиоцефал'] },
        { id: 'hypertension3', words: ['гипертония 3', 'гипертензия 3', 'гипертони́ческая 3'] },
        { id: 'hypertension2', words: ['гипертония 2', 'гипертензия 2'] },
        { id: 'hypertension1', words: ['гипертони', 'гипертензи'] },
        { id: 'diabetes1', words: ['диабет 1', 'диабет i тип', 'диабета 1'] },
        { id: 'diabetes3', words: ['диабет 3', 'диабета 3', 'панкреатогенн'] },
        { id: 'diabetes2', words: ['диабет 2', 'диабет ii тип', 'диабета 2', 'сахарный диабет'] },
        { id: 'copd', words: ['хобл', 'обструктивн'] },
        { id: 'heart_failure', words: ['сердечная недостаточность', 'хсн'] },
        { id: 'arrhythmia', words: ['аритми', 'фибрилляц', 'мерцательн'] },
        { id: 'hypothyroidism', words: ['гипотиреоз'] },
        { id: 'anemia', words: ['анеми'] },
        { id: 'ckd', words: ['болезнь почек', 'хбп', 'почечная недостаточность'] },
        { id: 'pregnant', words: ['беременн'] }
    ],

    /* Распознаёт диагнозы в свободном тексте старых карточек */
    guessFromText: function (text) {
        var found = [];
        if (!text) return found;
        var low = String(text).toLowerCase();

        for (var i = 0; i < Norms.KEYWORDS.length; i++) {
            var k = Norms.KEYWORDS[i];
            for (var j = 0; j < k.words.length; j++) {
                if (low.indexOf(k.words[j]) !== -1) {
                    if (found.indexOf(k.id) === -1) found.push(k.id);
                    break;
                }
            }
        }
        return Norms.dropGroupDuplicates(found);
    },

    /* ----------------------------------------------------------------------
     * До версии 3.2 гипертония и диабет были единым пунктом без степени.
     * Карточки, заполненные раньше, переводим на новые идентификаторы.
     * -------------------------------------------------------------------- */
    LEGACY_IDS: {
        hypertension: 'hypertension1',
        diabetes: 'diabetes2'
    },

    normalizeIds: function (ids) {
        if (!ids) return [];
        var out = [];
        for (var i = 0; i < ids.length; i++) {
            var id = Norms.LEGACY_IDS[ids[i]] || ids[i];
            if (Norms.byId(id) && out.indexOf(id) === -1) out.push(id);
        }
        return Norms.dropGroupDuplicates(out);
    },

    /* В каждой группе оставляем только первый найденный диагноз */
    dropGroupDuplicates: function (ids) {
        var seen = {};
        var out = [];
        for (var i = 0; i < ids.length; i++) {
            var a = Norms.byId(ids[i]);
            var g = a && a.group;
            if (g) {
                if (seen[g]) continue;
                seen[g] = true;
            }
            out.push(ids[i]);
        }
        return out;
    },

    /* Идентификаторы диагнозов, несовместимых с указанным */
    conflictsWith: function (id) {
        var a = Norms.byId(id);
        var out = [];
        if (!a || !a.group) return out;
        for (var i = 0; i < Norms.DIAGNOSIS_ARTICLES.length; i++) {
            var b = Norms.DIAGNOSIS_ARTICLES[i];
            if (b.id !== id && b.group === a.group) out.push(b.id);
        }
        return out;
    },

    /* ======================================================================
     * ВЫБОР НОРМЫ ПОД ПРОФИЛЬ
     *
     * Диагнозов может быть отмечено несколько, и тогда встаёт вопрос, чью
     * строку таблицы брать. Приложение не выбирает одну, а объединяет
     * границы по каждому показателю отдельно: нижняя граница — самая низкая
     * из отмеченных статей, верхняя — самая высокая. Так у человека с ХОБЛ
     * и гипертонией сатурация проверяется по ХОБЛ, а давление — по
     * гипертонии, и диагнозы не «спорят» друг с другом.
     * ==================================================================== */
    articleFor: function (profile) {
        if (!profile) return null;

        var age = UI.calculateAge(profile.birthDate);
        if (age === null) return null;   // без даты рождения норму не подобрать

        var sources = Norms.sourcesFor(profile, age);
        if (sources.length === 0) return Norms.ageArticle(age);
        if (sources.length === 1) return sources[0];
        return Norms.merge(sources);
    },

    /* Статьи диагнозов, подходящие профилю по возрасту, с заполненным ИМТ */
    sourcesFor: function (profile, age) {
        var diagnoses = Norms.normalizeIds((profile && profile.diagnoses) || []);
        var out = [];

        for (var i = 0; i < Norms.DIAGNOSIS_ARTICLES.length; i++) {
            var a = Norms.DIAGNOSIS_ARTICLES[i];
            if (diagnoses.indexOf(a.id) === -1) continue;
            if (a.minAge !== undefined && age < a.minAge) continue;
            if (a.maxAge !== undefined && age > a.maxAge) continue;
            out.push(Norms.withBmiFallback(a, age));
        }
        return out;
    },

    /* Объединение границ нескольких статей */
    merge: function (sources) {
        var merged = {
            id: 'merged',
            title: '',
            sources: [],
            notes: []
        };

        var titles = [];
        for (var i = 0; i < sources.length; i++) {
            titles.push(sources[i].short || sources[i].title);
            merged.sources.push(sources[i].id);
            if (sources[i].note) merged.notes.push(sources[i].note);
        }
        merged.title = titles.join(' + ');

        for (var f = 0; f < Norms.FIELDS.length; f++) {
            var field = Norms.FIELDS[f];
            var min = null, max = null;

            for (var s = 0; s < sources.length; s++) {
                var range = sources[s][field];
                if (!range) continue;
                if (min === null || range[0] < min) min = range[0];
                if (max === null || range[1] > max) max = range[1];
            }
            merged[field] = (min === null) ? null : [min, max];
        }
        return merged;
    },

    ageArticle: function (age) {
        for (var i = 0; i < Norms.AGE_ARTICLES.length; i++) {
            var a = Norms.AGE_ARTICLES[i];
            if (age >= a.minAge && age <= a.maxAge) return a;
        }
        // Младше трёх лет отдельной статьи нет
        return null;
    },

    byId: function (id) {
        var all = Norms.AGE_ARTICLES.concat(Norms.DIAGNOSIS_ARTICLES);
        for (var i = 0; i < all.length; i++) {
            if (all[i].id === id) return all[i];
        }
        return null;
    },

    /* Для беременности и анемии ИМТ в таблице не задан — берём по возрасту */
    withBmiFallback: function (article, age) {
        if (!article || article.bmi) return article;
        var byAge = Norms.ageArticle(age);
        var copy = {};
        for (var k in article) {
            if (article.hasOwnProperty(k)) copy[k] = article[k];
        }
        copy.bmi = byAge ? byAge.bmi : null;
        return copy;
    },

    /* Примечания статьи (или всех объединённых статей) одной строкой */
    noteFor: function (article) {
        if (!article) return '';
        if (article.notes && article.notes.length) return article.notes.join(' ');
        return article.note || '';
    },

    /* ======================================================================
     * УРОВЕНЬ 1 — ТРЕВОГА ПРИ ВВОДЕ (ТЗ часть 4)
     *
     * Это не «норма» и не диагноз, а значения, при которых стоит что-то
     * предпринять. Пороги одинаковы для всех и НЕ зависят от таблицы норм:
     * они должны срабатывать редко и всегда по делу, поэтому их нельзя
     * привязывать к спорным индивидуальным границам.
     * ==================================================================== */
    ALARMS: [
        {
            field: 'ad_top', label: 'Давление верхнее', above: 180,
            text: 'Очень высокое давление. Отдохните 15 минут и измерьте повторно. ' +
                'Если значение держится — свяжитесь с врачом'
        },
        {
            field: 'ad_top', label: 'Давление верхнее', below: 85,
            text: 'Очень низкое давление. Присядьте или прилягте и измерьте повторно'
        },
        {
            field: 'ad_bottom', label: 'Давление нижнее', above: 120,
            text: 'Очень высокое нижнее давление. Обратитесь к врачу'
        },
        {
            field: 'ad_bottom', label: 'Давление нижнее', below: 55,
            text: 'Очень низкое нижнее давление. Присядьте и измерьте повторно'
        },
        {
            field: 'pulse', label: 'Пульс', above: 120,
            text: 'Очень частый пульс. Отдохните 10 минут и измерьте повторно'
        },
        {
            field: 'pulse', label: 'Пульс', below: 45,
            text: 'Очень редкий пульс. При слабости или головокружении обратитесь к врачу'
        },
        {
            field: 'spo2', label: 'Сатурация', below: 88,
            text: 'Критически низкая сатурация! Требуется помощь — вызовите врача'
        },
        {
            field: 'temperature', label: 'Температура', above: 38.5,
            text: 'Высокая температура. Обильное питьё, при ухудшении — вызов врача'
        },
        {
            field: 'temperature', label: 'Температура', below: 35.5,
            text: 'Пониженная температура. Согрейтесь; при слабости обратитесь к врачу'
        },
        {
            field: 'sugar', label: 'Сахар крови', above: 13.0,
            text: 'Очень высокий сахар. Свяжитесь с врачом'
        },
        {
            field: 'sugar', label: 'Сахар крови', below: 3.5,
            text: 'Низкий сахар. Примите быстрые углеводы — сок, сахар, конфету'
        }
    ],

    /* Тревога по одному значению; null — если порог не сработал.
       Границы включительно: «≥180» и «≤85» из ТЗ. */
    alarmFor: function (field, value) {
        if (value === null || value === undefined || value === '') return null;
        var v = Number(value);
        if (isNaN(v)) return null;

        for (var i = 0; i < Norms.ALARMS.length; i++) {
            var a = Norms.ALARMS[i];
            if (a.field !== field) continue;
            if (a.above !== undefined && v >= a.above) {
                return { field: field, label: a.label, value: v, text: a.text };
            }
            if (a.below !== undefined && v <= a.below) {
                return { field: field, label: a.label, value: v, text: a.text };
            }
        }
        return null;
    },

    /* Все тревоги одного измерения */
    alarmsForRow: function (m) {
        var out = [];
        if (!m) return out;
        var fields = ['ad_top', 'ad_bottom', 'pulse', 'spo2', 'temperature', 'sugar'];
        for (var i = 0; i < fields.length; i++) {
            var a = Norms.alarmFor(fields[i], m[fields[i]]);
            if (a) out.push(a);
        }
        return out;
    },

    /* ======================================================================
     * ОТКЛОНЕНИЕ ОТ НОРМЫ — «шаг тревоги» (ТЗ часть 4, уровень 2)
     *
     * Раньше отклонение считалось в процентах от границы. Для давления,
     * пульса и сахара это работало, а для сатурации и температуры — нет:
     * сатурация 88% при границе 95 давала всего −7,4%, то есть жёлтую
     * отметку, хотя это уже повод для тревоги; красную по проценту нельзя
     * было получить в принципе.
     *
     * Теперь у каждого показателя свой «шаг тревоги» в его собственных
     * единицах. Отклонение в пределах шага — жёлтая отметка, дальше —
     * красная. Тексты тоже стали понятнее: вместо «−12,2%» приложение
     * говорит «на 11 ниже границы 90».
     * ==================================================================== */
    STEP: {
        ad_top: 15,      // мм рт. ст.
        ad_bottom: 10,   // мм рт. ст.
        pulse: 15,       // уд./мин
        spo2: 3,         // %
        sugar: 1.5,      // ммоль/л
        temp: 0.5,       // °C
        bmi: 3.0
    },

    check: function (article, field, value) {
        if (!article || value === null || value === undefined || value === '') return null;
        var range = article[field];
        if (!range) return null;

        var v = Number(value);
        if (isNaN(v)) return null;

        var min = range[0];
        var max = range[1];
        var bound, direction;

        if (v < min) {
            bound = min;
            direction = 'below';
        } else if (v > max) {
            bound = max;
            direction = 'above';
        } else {
            return {
                level: '', direction: 'in', distance: 0,
                bound: null, range: range, step: Norms.STEP[field] || null
            };
        }

        var step = Norms.STEP[field];
        var distance = Math.round(Math.abs(v - bound) * 10) / 10;
        var level = (!step || distance > step) ? 'danger' : 'warn';

        return {
            level: level,
            direction: direction,
            distance: distance,
            bound: bound,
            range: range,
            step: step || null
        };
    },

    /* «на 11 ниже границы 90» — текст отклонения для карточки и документов */
    describe: function (res) {
        if (!res || !res.level) return '';
        return 'на ' + Norms.num(res.distance) +
            (res.direction === 'above' ? ' выше' : ' ниже') +
            ' границы ' + Norms.num(res.bound);
    },

    /* Печатает 5 вместо 5.0, но 36.5 оставляет как есть */
    num: function (v) {
        var n = Number(v);
        if (isNaN(n)) return String(v);
        return (Math.round(n) === n) ? String(Math.round(n)) : String(n);
    },

    /* ======================================================================
     * ИНДЕКС МАССЫ ТЕЛА
     * ==================================================================== */
    bmi: function (weightKg, heightCm) {
        var w = Number(weightKg);
        var h = Number(heightCm);
        if (!w || !h) return null;
        var m = h / 100;
        return Math.round(w / (m * m) * 10) / 10;
    },

    /* ИМТ активного профиля для конкретного веса */
    bmiFor: function (weightKg) {
        var p = Storage.getActiveProfile();
        if (!p || !p.height) return null;
        return Norms.bmi(weightKg, p.height);
    }
};
