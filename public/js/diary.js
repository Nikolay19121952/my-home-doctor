var Diary = {
    DIARY_KEY: 'mdd_diary',
    currentProfile: null,

    init: function () {
        var addBtn = document.getElementById('btn-add-entry');
        var saveBtn = document.getElementById('btn-save-entry');
        var cancelBtn = document.getElementById('btn-cancel-entry');
        var profileSelect = document.getElementById('diary-profile');

        if (addBtn) {
            addBtn.addEventListener('click', function () {
                Diary.showForm();
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', function () {
                Diary.saveEntry();
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', function () {
                Diary.hideForm();
            });
        }

        if (profileSelect) {
            profileSelect.addEventListener('change', function () {
                Diary.currentProfile = this.value;
                Diary.renderEntries();
            });
        }
    },

    getEntries: function () {
        var data = localStorage.getItem(Diary.DIARY_KEY);
        if (!data) return [];
        try {
            return JSON.parse(data);
        } catch (e) {
            return [];
        }
    },

    saveEntries: function (entries) {
        localStorage.setItem(Diary.DIARY_KEY, JSON.stringify(entries));
    },

    showForm: function () {
        document.getElementById('diary-form').style.display = 'block';
        document.getElementById('btn-add-entry').style.display = 'none';
        var now = new Date();
        var dateStr = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0');
        var timeStr = String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0');
        document.getElementById('entry-date').value = dateStr;
        document.getElementById('entry-time').value = timeStr;
    },

    hideForm: function () {
        document.getElementById('diary-form').style.display = 'none';
        document.getElementById('btn-add-entry').style.display = '';
        document.getElementById('entry-systolic').value = '';
        document.getElementById('entry-diastolic').value = '';
        document.getElementById('entry-pulse').value = '';
        document.getElementById('entry-sugar').value = '';
        document.getElementById('entry-temp').value = '';
        document.getElementById('entry-weight').value = '';
        document.getElementById('entry-notes').value = '';
    },

    saveEntry: function () {
        var systolic = document.getElementById('entry-systolic').value.trim();
        var diastolic = document.getElementById('entry-diastolic').value.trim();
        var pulse = document.getElementById('entry-pulse').value.trim();
        var sugar = document.getElementById('entry-sugar').value.trim();
        var temp = document.getElementById('entry-temp').value.trim();
        var weight = document.getElementById('entry-weight').value.trim();
        var notes = document.getElementById('entry-notes').value.trim();
        var date = document.getElementById('entry-date').value;
        var time = document.getElementById('entry-time').value;

        if (!systolic && !diastolic && !pulse && !sugar && !temp && !weight) {
            UI.showToast('Заполните хотя бы одно поле');
            return;
        }

        var entry = {
            id: Storage.generateId(),
            profileId: Diary.currentProfile || '',
            date: date,
            time: time,
            systolic: systolic ? Number(systolic) : null,
            diastolic: diastolic ? Number(diastolic) : null,
            pulse: pulse ? Number(pulse) : null,
            sugar: sugar ? Number(sugar) : null,
            temperature: temp ? Number(temp) : null,
            weight: weight ? Number(weight) : null,
            notes: notes,
            createdAt: new Date().toISOString()
        };

        var entries = Diary.getEntries();
        entries.unshift(entry);
        if (entries.length > 200) {
            entries = entries.slice(0, 200);
        }
        Diary.saveEntries(entries);

        Diary.hideForm();
        Diary.renderEntries();
        UI.showToast('Запись добавлена');
    },

    updateProfileSelect: function () {
        var select = document.getElementById('diary-profile');
        if (!select) return;

        var profiles = Storage.getProfiles();
        select.innerHTML = '<option value="">Все члены семьи</option>';
        for (var i = 0; i < profiles.length; i++) {
            var opt = document.createElement('option');
            opt.value = profiles[i].id;
            opt.textContent = profiles[i].name;
            select.appendChild(opt);
        }

        if (Diary.currentProfile) {
            select.value = Diary.currentProfile;
        }
    },

    renderEntries: function () {
        var container = document.getElementById('diary-entries');
        if (!container) return;

        Diary.updateProfileSelect();

        var entries = Diary.getEntries();
        if (Diary.currentProfile) {
            entries = entries.filter(function (e) {
                return e.profileId === Diary.currentProfile;
            });
        }

        if (entries.length === 0) {
            container.innerHTML =
                '<div class="empty-state">' +
                '<div class="empty-icon">📋</div>' +
                '<h3>Нет записей</h3>' +
                '<p>Добавьте первое измерение, нажав кнопку «Добавить запись».</p>' +
                '</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            var profile = e.profileId ? Storage.getProfileById(e.profileId) : null;
            var profileName = profile ? profile.name : '';

            html += '<div class="diary-entry">';
            html += '<div class="diary-entry-header">';
            html += '<span class="diary-entry-date">' + UI.escapeHtml(Diary.formatDate(e.date)) + ' ' + UI.escapeHtml(e.time || '') + '</span>';
            if (profileName) {
                html += '<span class="diary-entry-profile">' + UI.escapeHtml(profileName) + '</span>';
            }
            html += '<button class="diary-delete-btn" data-id="' + e.id + '" title="Удалить">✕</button>';
            html += '</div>';
            html += '<div class="diary-entry-values">';

            if (e.systolic && e.diastolic) {
                var bpClass = Diary.bpClass(e.systolic, e.diastolic);
                html += '<div class="diary-value ' + bpClass + '"><span class="diary-value-label">АД</span><span class="diary-value-num">' + e.systolic + '/' + e.diastolic + '</span></div>';
            }
            if (e.pulse) {
                html += '<div class="diary-value"><span class="diary-value-label">Пульс</span><span class="diary-value-num">' + e.pulse + '</span></div>';
            }
            if (e.sugar) {
                html += '<div class="diary-value"><span class="diary-value-label">Сахар</span><span class="diary-value-num">' + e.sugar + '</span></div>';
            }
            if (e.temperature) {
                var tempClass = e.temperature >= 37.1 ? 'diary-value-warn' : '';
                html += '<div class="diary-value ' + tempClass + '"><span class="diary-value-label">t°</span><span class="diary-value-num">' + e.temperature + '</span></div>';
            }
            if (e.weight) {
                html += '<div class="diary-value"><span class="diary-value-label">Вес</span><span class="diary-value-num">' + e.weight + ' кг</span></div>';
            }

            html += '</div>';
            if (e.notes) {
                html += '<div class="diary-entry-notes">' + UI.escapeHtml(e.notes) + '</div>';
            }
            html += '</div>';
        }

        container.innerHTML = html;

        var delBtns = container.querySelectorAll('.diary-delete-btn');
        for (var j = 0; j < delBtns.length; j++) {
            delBtns[j].addEventListener('click', function () {
                var id = this.getAttribute('data-id');
                UI.showConfirm('Удалить запись?', 'Это действие нельзя отменить.', 'Удалить', function () {
                    var all = Diary.getEntries();
                    var filtered = all.filter(function (e) { return e.id !== id; });
                    Diary.saveEntries(filtered);
                    Diary.renderEntries();
                    UI.showToast('Запись удалена');
                });
            });
        }
    },

    bpClass: function (sys, dia) {
        if (sys >= 180 || dia >= 110) return 'diary-value-danger';
        if (sys >= 140 || dia >= 90) return 'diary-value-warn';
        return '';
    },

    formatDate: function (dateStr) {
        if (!dateStr) return '';
        var parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        return parts[2] + '.' + parts[1] + '.' + parts[0];
    }
};
