var Storage = {
    PROFILES_KEY: 'mdd_profiles',
    ACTIVE_KEY: 'mdd_active_profile',

    /* ======================================================================
     * АКТИВНЫЙ ПРОФИЛЬ (ТЗ v3.1 часть 1, пункт 3)
     *
     * У каждого члена семьи свои дневник, консультации и графики. Данные
     * разделяются суффиксом в ключе хранилища: mdd_diary_records__<id>.
     * Пока профилей нет, используется общий ключ 'default', чтобы
     * приложение работало и до создания первой карточки.
     * ==================================================================== */
    getActiveId: function () {
        var profiles = Storage.getProfiles();
        var id = localStorage.getItem(Storage.ACTIVE_KEY);

        if (id) {
            for (var i = 0; i < profiles.length; i++) {
                if (profiles[i].id === id) return id;
            }
        }
        // Профиль удалён или не выбран — берём первый в списке
        if (profiles.length > 0) {
            localStorage.setItem(Storage.ACTIVE_KEY, profiles[0].id);
            return profiles[0].id;
        }
        return 'default';
    },

    getActiveProfile: function () {
        var id = Storage.getActiveId();
        return id === 'default' ? null : Storage.getProfileById(id);
    },

    /* Имя активного профиля для заголовков разделов */
    activeName: function () {
        var p = Storage.getActiveProfile();
        return p ? p.name : '';
    },

    setActiveId: function (id) {
        localStorage.setItem(Storage.ACTIVE_KEY, id);
    },

    /* Ключ хранилища с привязкой к активному профилю */
    pkey: function (base) {
        return base + '__' + Storage.getActiveId();
    },

    /* ----------------------------------------------------------------------
     * Перенос данных, накопленных до разделения по профилям.
     * Всё, что лежит в общих ключах, отходит первому профилю в списке.
     * -------------------------------------------------------------------- */
    LEGACY_KEYS: [
        'mdd_diary_records',
        'mdd_diary_current',
        'mdd_diary_chat',
        'mdd_diary_settings',
        'mdd_chat_history',
        'mdd_graphs'
    ],

    /* Удаляет дневник, консультации и графики конкретного профиля */
    dropProfileData: function (id) {
        for (var i = 0; i < Storage.LEGACY_KEYS.length; i++) {
            localStorage.removeItem(Storage.LEGACY_KEYS[i] + '__' + id);
        }
    },

    /* Данные одного профиля одним объектом — для резервной копии */
    collectProfileData: function (id) {
        var out = {};
        for (var i = 0; i < Storage.LEGACY_KEYS.length; i++) {
            var base = Storage.LEGACY_KEYS[i];
            var raw = localStorage.getItem(base + '__' + id);
            if (raw !== null) out[base] = raw;
        }
        return out;
    },

    /* Восстановление данных профиля из резервной копии */
    restoreProfileData: function (id, data) {
        if (!data) return;
        for (var base in data) {
            if (data.hasOwnProperty(base) && Storage.LEGACY_KEYS.indexOf(base) !== -1) {
                localStorage.setItem(base + '__' + id, data[base]);
            }
        }
    },

    migrateToProfiles: function () {
        var id = Storage.getActiveId();
        if (id === 'default') return;   // профилей ещё нет — переносить некуда

        for (var i = 0; i < Storage.LEGACY_KEYS.length; i++) {
            var base = Storage.LEGACY_KEYS[i];
            var target = base + '__' + id;

            // Данные версий до 3.1 лежали в общем ключе без суффикса,
            // а записанные до создания первой карточки — под суффиксом default
            var sources = [base, base + '__default'];
            for (var s = 0; s < sources.length; s++) {
                if (sources[s] === target) continue;
                var value = localStorage.getItem(sources[s]);
                if (value === null) continue;

                if (localStorage.getItem(target) === null) {
                    localStorage.setItem(target, value);
                }
                localStorage.removeItem(sources[s]);
            }
        }
    },

    getProfiles: function () {
        var data = localStorage.getItem(Storage.PROFILES_KEY);
        if (!data) return [];
        try {
            return JSON.parse(data);
        } catch (e) {
            return [];
        }
    },

    saveProfiles: function (profiles) {
        localStorage.setItem(Storage.PROFILES_KEY, JSON.stringify(profiles));
    },

    getProfileById: function (id) {
        var profiles = Storage.getProfiles();
        for (var i = 0; i < profiles.length; i++) {
            if (profiles[i].id === id) return profiles[i];
        }
        return null;
    },

    addProfile: function (profile) {
        var profiles = Storage.getProfiles();
        profile.id = Storage.generateId();
        profile.createdAt = new Date().toISOString();
        profile.updatedAt = new Date().toISOString();
        profiles.push(profile);
        Storage.saveProfiles(profiles);
        return profile;
    },

    updateProfile: function (id, data) {
        var profiles = Storage.getProfiles();
        for (var i = 0; i < profiles.length; i++) {
            if (profiles[i].id === id) {
                for (var key in data) {
                    if (data.hasOwnProperty(key)) {
                        profiles[i][key] = data[key];
                    }
                }
                profiles[i].updatedAt = new Date().toISOString();
                Storage.saveProfiles(profiles);
                return profiles[i];
            }
        }
        return null;
    },

    deleteProfile: function (id) {
        var profiles = Storage.getProfiles();
        var filtered = [];
        for (var i = 0; i < profiles.length; i++) {
            if (profiles[i].id !== id) {
                filtered.push(profiles[i]);
            }
        }
        Storage.saveProfiles(filtered);
    },

    generateId: function () {
        return Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    }
};
