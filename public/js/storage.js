var Storage = {
    PROFILES_KEY: 'mdd_profiles',

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
