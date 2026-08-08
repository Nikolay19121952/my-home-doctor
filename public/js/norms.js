/* ============================================================================
 * ИНДИВИДУАЛЬНЫЕ НОРМЫ ИЗМЕРЕНИЙ — версия 3.1 часть 2
 * Реализация по ТЗ «Доработки v3.1 — часть 2: индивидуальные нормы и ИМТ».
 *
 * Норма подбирается под конкретного человека: по возрасту из даты рождения
 * и по диагнозам из карточки профиля. Отклонение считается от ближайшей
 * границы диапазона — как в примере ТЗ: 125 при норме 140–170 даёт −10.7%.
 *
 * ВАЖНО. Таблица составлена Доктором под конкретных пациентов, а не как
 * общая медицинская норма. Для гипертонии нормой считается 140–160, потому
 * что это целевой диапазон лечения; у пожилых с атеросклерозом брахиоцефальных
 * артерий чрезмерное снижение давления так же нежелательно, как повышение.
 * Менять границы можно только по согласованию с врачом.
 * ========================================================================== */

var Norms = {

    /* --- Возрастные статьи (раздел 8 ТЗ) ---------------------------------- */
    AGE_ARTICLES: [
        {
            id: 'child_3_5', title: 'Дети 3–5 лет', minAge: 3, maxAge: 5,
            ad_top: [95, 110], ad_bottom: [55, 70], pulse: [80, 130],
            spo2: [97, 100], sugar: [3.3, 5.5], temp: [36.3, 37.2], bmi: [14.0, 18.5]
        },
        {
            id: 'child_6_11', title: 'Дети 6–11 лет', minAge: 6, maxAge: 11,
            ad_top: [100, 120], ad_bottom: [60, 75], pulse: [70, 110],
            spo2: [97, 100], sugar: [3.5, 5.5], temp: [36.2, 37.0], bmi: [14.5, 21.0]
        },
        {
            id: 'teen_12_17', title: 'Подростки 12–17 лет', minAge: 12, maxAge: 17,
            ad_top: [110, 135], ad_bottom: [65, 85], pulse: [60, 100],
            spo2: [97, 100], sugar: [3.3, 5.5], temp: [36.2, 37.0], bmi: [16.0, 23.0]
        },
        {
            id: 'young_18_40', title: 'Молодые взрослые 18–40 лет', minAge: 18, maxAge: 40,
            ad_top: [100, 130], ad_bottom: [60, 85], pulse: [60, 100],
            spo2: [96, 100], sugar: [3.3, 5.5], temp: [36.2, 36.9], bmi: [18.5, 24.9]
        },
        {
            id: 'adult_41_64', title: 'Взрослые 41–64 года', minAge: 41, maxAge: 64,
            ad_top: [110, 135], ad_bottom: [65, 85], pulse: [60, 100],
            spo2: [95, 100], sugar: [3.3, 5.5], temp: [36.2, 36.9], bmi: [18.5, 24.9]
        },
        {
            id: 'senior_65', title: 'Пожилые 65 лет и старше', minAge: 65, maxAge: 200,
            ad_top: [120, 140], ad_bottom: [75, 90], pulse: [55, 85],
            spo2: [94, 98], sugar: [4.0, 6.5], temp: [36.0, 36.7], bmi: [20.0, 28.0]
        },
        {
            id: 'pregnant', title: 'Беременность', minAge: 0, maxAge: 200,
            ad_top: [100, 140], ad_bottom: [60, 90], pulse: [70, 100],
            spo2: [95, 100], sugar: [3.5, 7.5], temp: [36.3, 37.0], bmi: null
        }
    ],

    /* ----------------------------------------------------------------------
     * Статьи по диагнозам (раздел 8 ТЗ).
     *
     * priority — какой диагноз берётся, если у человека их несколько.
     * Порядок предложен разработчиком и требует подтверждения врача:
     * выше стоят состояния, которые сильнее сужают контроль показателей.
     * -------------------------------------------------------------------- */
    DIAGNOSIS_ARTICLES: [
        {
            id: 'hypertension_bca', title: 'Гипертония с атеросклерозом БЦА',
            short: 'Гипертония + атеросклероз БЦА', priority: 10, minAge: 18,
            ad_top: [140, 170], ad_bottom: [90, 110], pulse: [55, 80],
            spo2: [94, 100], sugar: [4.0, 6.5], temp: [36.0, 36.8], bmi: [20.0, 28.0]
        },
        {
            id: 'copd', title: 'ХОБЛ', short: 'ХОБЛ', priority: 20, minAge: 40,
            ad_top: [120, 140], ad_bottom: [75, 90], pulse: [60, 95],
            spo2: [92, 96], sugar: [3.3, 5.5], temp: [36.2, 36.9], bmi: [18.5, 25.0]
        },
        {
            id: 'heart_failure', title: 'Хроническая сердечная недостаточность',
            short: 'ХСН', priority: 30, minAge: 50,
            ad_top: [100, 130], ad_bottom: [60, 80], pulse: [50, 80],
            spo2: [95, 100], sugar: [3.3, 5.5], temp: [36.2, 36.9], bmi: [18.5, 25.0]
        },
        {
            id: 'ckd', title: 'Хроническая болезнь почек (3–4 стадия)',
            short: 'ХБП 3–4', priority: 40, minAge: 50,
            ad_top: [130, 140], ad_bottom: [80, 90], pulse: [60, 90],
            spo2: [95, 100], sugar: [4.0, 6.5], temp: [36.2, 36.9], bmi: [18.5, 25.0]
        },
        {
            id: 'diabetes1', title: 'Сахарный диабет 1 типа',
            short: 'Диабет 1 типа', priority: 50, minAge: 0, maxAge: 17,
            ad_top: [110, 130], ad_bottom: [65, 85], pulse: [60, 100],
            spo2: [97, 100], sugar: [4.5, 7.5], temp: [36.2, 37.0], bmi: [18.5, 23.0]
        },
        {
            id: 'diabetes2', title: 'Сахарный диабет 2 типа',
            short: 'Диабет 2 типа', priority: 55, minAge: 40,
            ad_top: [130, 140], ad_bottom: [80, 90], pulse: [60, 90],
            spo2: [95, 100], sugar: [5.5, 7.0], temp: [36.2, 36.9], bmi: [18.5, 25.0]
        },
        {
            id: 'hypertension', title: 'Гипертония', short: 'Гипертония',
            priority: 60, minAge: 18,
            ad_top: [140, 160], ad_bottom: [90, 100], pulse: [55, 85],
            spo2: [95, 100], sugar: [3.3, 5.5], temp: [36.2, 36.9], bmi: [18.5, 27.0]
        },
        {
            id: 'arrhythmia', title: 'Аритмия', short: 'Аритмия',
            priority: 70, minAge: 18,
            ad_top: [100, 140], ad_bottom: [60, 90], pulse: [50, 110],
            spo2: [95, 100], sugar: [3.3, 5.5], temp: [36.2, 36.9], bmi: [18.5, 25.0]
        },
        {
            id: 'hypothyroidism', title: 'Гипотиреоз', short: 'Гипотиреоз',
            priority: 80, minAge: 18,
            ad_top: [110, 135], ad_bottom: [65, 85], pulse: [50, 75],
            spo2: [95, 100], sugar: [3.3, 5.5], temp: [35.8, 36.4], bmi: [20.0, 28.0]
        },
        {
            id: 'anemia', title: 'Анемия', short: 'Анемия', priority: 90, minAge: 0,
            ad_top: [100, 130], ad_bottom: [60, 85], pulse: [70, 100],
            spo2: [94, 100], sugar: [3.3, 5.5], temp: [36.2, 36.9], bmi: null
        }
    ],

    /* Диагнозы для выбора в карточке профиля */
    DIAGNOSIS_LIST: function () {
        var out = [{ id: 'none', title: 'Хронических заболеваний нет' }];
        for (var i = 0; i < Norms.DIAGNOSIS_ARTICLES.length; i++) {
            var a = Norms.DIAGNOSIS_ARTICLES[i];
            out.push({ id: a.id, title: a.title });
        }
        out.push({ id: 'pregnant', title: 'Беременность' });
        return out;
    },

    /* Ключевые слова для переноса диагнозов, записанных текстом */
    KEYWORDS: [
        { id: 'hypertension_bca', words: ['атеросклероз'] },
        { id: 'hypertension', words: ['гипертони', 'гипертензи'] },
        { id: 'diabetes1', words: ['диабет 1', 'диабет i тип', 'диабета 1'] },
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
        // «Гипертония + атеросклероз» — только когда есть и то, и другое
        if (found.indexOf('hypertension_bca') !== -1 && found.indexOf('hypertension') === -1) {
            found.splice(found.indexOf('hypertension_bca'), 1);
        }
        return found;
    },

    /* ======================================================================
     * ВЫБОР СТАТЬИ ПОД ПРОФИЛЬ (раздел 2 ТЗ)
     * ==================================================================== */
    articleFor: function (profile) {
        if (!profile) return null;

        var age = UI.calculateAge(profile.birthDate);
        if (age === null) return null;   // без даты рождения норму не подобрать

        var diagnoses = profile.diagnoses || [];

        // Беременность важнее прочих статей
        if (diagnoses.indexOf('pregnant') !== -1) {
            return Norms.withBmiFallback(Norms.byId('pregnant'), age);
        }

        // Из диагнозов берём тот, что стоит выше в порядке приоритета
        var best = null;
        for (var i = 0; i < Norms.DIAGNOSIS_ARTICLES.length; i++) {
            var a = Norms.DIAGNOSIS_ARTICLES[i];
            if (diagnoses.indexOf(a.id) === -1) continue;

            // Статья применяется, только если подходит по возрасту
            if (a.minAge !== undefined && age < a.minAge) continue;
            if (a.maxAge !== undefined && age > a.maxAge) continue;

            if (!best || a.priority < best.priority) best = a;
        }
        if (best) return Norms.withBmiFallback(best, age);

        return Norms.ageArticle(age);
    },

    ageArticle: function (age) {
        for (var i = 0; i < Norms.AGE_ARTICLES.length; i++) {
            var a = Norms.AGE_ARTICLES[i];
            if (a.id === 'pregnant') continue;
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

    /* ======================================================================
     * ОТКЛОНЕНИЕ ОТ НОРМЫ (раздел 4 ТЗ)
     *
     * Норма задана диапазоном, поэтому отклонение считается от ближайшей
     * границы: значение внутри диапазона отклонением не считается.
     * Проверка на примере ТЗ: 125 при диапазоне 140–170 → (125−140)/140,
     * то есть −10.7% и жёлтая отметка.
     * ==================================================================== */
    WARN_PERCENT: 5,
    DANGER_PERCENT: 15,

    check: function (article, field, value) {
        if (!article || value === null || value === undefined || value === '') return null;
        var range = article[field];
        if (!range) return null;

        var v = Number(value);
        if (isNaN(v)) return null;

        var min = range[0];
        var max = range[1];
        var bound;

        if (v < min) {
            bound = min;
        } else if (v > max) {
            bound = max;
        } else {
            return { level: '', percent: 0, bound: null, range: range };
        }

        var percent = (v - bound) / bound * 100;
        var abs = Math.abs(percent);
        var level = abs > Norms.DANGER_PERCENT ? 'danger'
            : (abs >= Norms.WARN_PERCENT ? 'warn' : '');

        return {
            level: level,
            percent: Math.round(percent * 10) / 10,
            bound: bound,
            range: range
        };
    },

    /* ======================================================================
     * ИНДЕКС МАССЫ ТЕЛА (раздел 3 ТЗ)
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
