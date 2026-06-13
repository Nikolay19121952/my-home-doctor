var Storage = {
    PROFILES_KEY: 'mdd_profiles',
    DIARY_KEY: 'mdd_diary',
    ANALYSES_KEY: 'mdd_analyses',
    REMINDERS_KEY: 'mdd_reminders',

    // ===== Общие методы =====

    _get: function (key) {
        var data = localStorage.getItem(key);
        if (!data) return [];
        try {
            return JSON.parse(data);
        } catch (e) {
            return [];
        }
    },

    _save: function (key, items) {
        localStorage.setItem(key, JSON.stringify(items));
    },

    generateId: function () {
        return Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    },

    // ===== Профили =====

    getProfiles: function () {
        return Storage._get(Storage.PROFILES_KEY);
    },

    saveProfiles: function (profiles) {
        Storage._save(Storage.PROFILES_KEY, profiles);
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
        Storage.deleteDiaryByProfile(id);
        Storage.deleteAnalysesByProfile(id);
        Storage.deleteRemindersByProfile(id);
    },

    // ===== Дневник здоровья =====

    getDiaryEntries: function () {
        return Storage._get(Storage.DIARY_KEY);
    },

    getDiaryByProfile: function (profileId) {
        var entries = Storage.getDiaryEntries();
        var result = [];
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].profileId === profileId) {
                result.push(entries[i]);
            }
        }
        result.sort(function (a, b) {
            var da = a.date + 'T' + (a.time || '00:00');
            var db = b.date + 'T' + (b.time || '00:00');
            return db.localeCompare(da);
        });
        return result;
    },

    getDiaryEntryById: function (id) {
        var entries = Storage.getDiaryEntries();
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].id === id) return entries[i];
        }
        return null;
    },

    addDiaryEntry: function (entry) {
        var entries = Storage.getDiaryEntries();
        entry.id = Storage.generateId();
        entry.createdAt = new Date().toISOString();
        entry.updatedAt = new Date().toISOString();
        entries.push(entry);
        Storage._save(Storage.DIARY_KEY, entries);
        return entry;
    },

    updateDiaryEntry: function (id, data) {
        var entries = Storage.getDiaryEntries();
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].id === id) {
                for (var key in data) {
                    if (data.hasOwnProperty(key)) {
                        entries[i][key] = data[key];
                    }
                }
                entries[i].updatedAt = new Date().toISOString();
                Storage._save(Storage.DIARY_KEY, entries);
                return entries[i];
            }
        }
        return null;
    },

    deleteDiaryEntry: function (id) {
        var entries = Storage.getDiaryEntries();
        var filtered = [];
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].id !== id) filtered.push(entries[i]);
        }
        Storage._save(Storage.DIARY_KEY, filtered);
    },

    deleteDiaryByProfile: function (profileId) {
        var entries = Storage.getDiaryEntries();
        var filtered = [];
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].profileId !== profileId) filtered.push(entries[i]);
        }
        Storage._save(Storage.DIARY_KEY, filtered);
    },

    getDiaryByDateRange: function (profileId, startDate, endDate) {
        var entries = Storage.getDiaryByProfile(profileId);
        var result = [];
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].date >= startDate && entries[i].date <= endDate) {
                result.push(entries[i]);
            }
        }
        result.sort(function (a, b) {
            return (a.date + 'T' + (a.time || '00:00')).localeCompare(b.date + 'T' + (b.time || '00:00'));
        });
        return result;
    },

    // ===== Анализы =====

    getAnalyses: function () {
        return Storage._get(Storage.ANALYSES_KEY);
    },

    getAnalysesByProfile: function (profileId) {
        var items = Storage.getAnalyses();
        var result = [];
        for (var i = 0; i < items.length; i++) {
            if (items[i].profileId === profileId) result.push(items[i]);
        }
        result.sort(function (a, b) { return b.date.localeCompare(a.date); });
        return result;
    },

    getAnalysisById: function (id) {
        var items = Storage.getAnalyses();
        for (var i = 0; i < items.length; i++) {
            if (items[i].id === id) return items[i];
        }
        return null;
    },

    addAnalysis: function (analysis) {
        var items = Storage.getAnalyses();
        analysis.id = Storage.generateId();
        analysis.createdAt = new Date().toISOString();
        analysis.updatedAt = new Date().toISOString();
        items.push(analysis);
        Storage._save(Storage.ANALYSES_KEY, items);
        return analysis;
    },

    updateAnalysis: function (id, data) {
        var items = Storage.getAnalyses();
        for (var i = 0; i < items.length; i++) {
            if (items[i].id === id) {
                for (var key in data) {
                    if (data.hasOwnProperty(key)) {
                        items[i][key] = data[key];
                    }
                }
                items[i].updatedAt = new Date().toISOString();
                Storage._save(Storage.ANALYSES_KEY, items);
                return items[i];
            }
        }
        return null;
    },

    deleteAnalysis: function (id) {
        var items = Storage.getAnalyses();
        var toDelete = null;
        var filtered = [];
        for (var i = 0; i < items.length; i++) {
            if (items[i].id === id) {
                toDelete = items[i];
            } else {
                filtered.push(items[i]);
            }
        }
        Storage._save(Storage.ANALYSES_KEY, filtered);
        if (toDelete && toDelete.imageIds && toDelete.imageIds.length > 0) {
            DB.deleteImages(toDelete.imageIds);
        }
    },

    deleteAnalysesByProfile: function (profileId) {
        var items = Storage.getAnalyses();
        var filtered = [];
        for (var i = 0; i < items.length; i++) {
            if (items[i].profileId === profileId) {
                if (items[i].imageIds && items[i].imageIds.length > 0) {
                    DB.deleteImages(items[i].imageIds);
                }
            } else {
                filtered.push(items[i]);
            }
        }
        Storage._save(Storage.ANALYSES_KEY, filtered);
    },

    // ===== Напоминания =====

    getReminders: function () {
        return Storage._get(Storage.REMINDERS_KEY);
    },

    getRemindersByProfile: function (profileId) {
        var items = Storage.getReminders();
        var result = [];
        for (var i = 0; i < items.length; i++) {
            if (items[i].profileId === profileId) result.push(items[i]);
        }
        return result;
    },

    getReminderById: function (id) {
        var items = Storage.getReminders();
        for (var i = 0; i < items.length; i++) {
            if (items[i].id === id) return items[i];
        }
        return null;
    },

    getActiveReminders: function () {
        var items = Storage.getReminders();
        var result = [];
        for (var i = 0; i < items.length; i++) {
            if (!items[i].completed) result.push(items[i]);
        }
        result.sort(function (a, b) {
            var da = a.date + 'T' + (a.time || '00:00');
            var db = b.date + 'T' + (b.time || '00:00');
            return da.localeCompare(db);
        });
        return result;
    },

    addReminder: function (reminder) {
        var items = Storage.getReminders();
        reminder.id = Storage.generateId();
        reminder.completed = false;
        reminder.completedAt = null;
        reminder.createdAt = new Date().toISOString();
        reminder.updatedAt = new Date().toISOString();
        items.push(reminder);
        Storage._save(Storage.REMINDERS_KEY, items);
        return reminder;
    },

    updateReminder: function (id, data) {
        var items = Storage.getReminders();
        for (var i = 0; i < items.length; i++) {
            if (items[i].id === id) {
                for (var key in data) {
                    if (data.hasOwnProperty(key)) {
                        items[i][key] = data[key];
                    }
                }
                items[i].updatedAt = new Date().toISOString();
                Storage._save(Storage.REMINDERS_KEY, items);
                return items[i];
            }
        }
        return null;
    },

    deleteReminder: function (id) {
        var items = Storage.getReminders();
        var filtered = [];
        for (var i = 0; i < items.length; i++) {
            if (items[i].id !== id) filtered.push(items[i]);
        }
        Storage._save(Storage.REMINDERS_KEY, filtered);
    },

    deleteRemindersByProfile: function (profileId) {
        var items = Storage.getReminders();
        var filtered = [];
        for (var i = 0; i < items.length; i++) {
            if (items[i].profileId !== profileId) filtered.push(items[i]);
        }
        Storage._save(Storage.REMINDERS_KEY, filtered);
    }
};
