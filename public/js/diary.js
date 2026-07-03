var Diary = {
    DIARY_KEY: 'mdd_diary',
    currentProfile: null,
    _selectedIds: [],

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
        var wasEditing = !!Diary._editingId;
        if (Diary._editingId) {
            for (var k = 0; k < entries.length; k++) {
                if (entries[k].id === Diary._editingId) {
                    entry.id = Diary._editingId;
                    entry.createdAt = entries[k].createdAt;
                    entries[k] = entry;
                    break;
                }
            }
            Diary._editingId = null;
        } else {
            entries.unshift(entry);
            if (entries.length > 200) {
                entries = entries.slice(0, 200);
            }
        }
        Diary.saveEntries(entries);

        Diary.hideForm();
        Diary.renderEntries();
        UI.showToast(wasEditing ? 'Запись обновлена' : 'Запись добавлена');
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

        var html = '<div class="diary-batch-bar" id="diary-batch-bar" style="display:none;">' +
            '<span id="diary-batch-count">Выбрано: 0</span>' +
            '<div class="diary-batch-buttons">' +
            '<button class="btn btn-primary btn-small" onclick="Diary.askDoctorBatch()">🩺 Отправить доктору</button>' +
            '<button class="btn btn-outline btn-small" onclick="Diary.saveToFileBatch()">💾 Файл</button>' +
            '</div></div>';
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            var profile = e.profileId ? Storage.getProfileById(e.profileId) : null;
            var profileName = profile ? profile.name : '';
            var checked = Diary._selectedIds.indexOf(e.id) !== -1;

            html += '<div class="diary-entry">';
            html += '<div class="diary-entry-header">';
            html += '<label class="diary-checkbox"><input type="checkbox" ' + (checked ? 'checked' : '') +
                ' onchange="Diary.toggleSelect(\'' + e.id + '\', this.checked)"><span class="checkmark"></span></label>';
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
            html += '<div class="diary-entry-actions">' +
                '<button class="btn btn-outline btn-small" onclick="Diary.editEntry(\'' + e.id + '\')">✏️ Редакт.</button>' +
                '</div>';
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
    },

    _editingId: null,

    editEntry: function (id) {
        var entries = Diary.getEntries();
        var entry = null;
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].id === id) { entry = entries[i]; break; }
        }
        if (!entry) return;

        Diary._editingId = id;
        Diary.showForm();
        document.getElementById('entry-date').value = entry.date || '';
        document.getElementById('entry-time').value = entry.time || '';
        document.getElementById('entry-systolic').value = entry.systolic || '';
        document.getElementById('entry-diastolic').value = entry.diastolic || '';
        document.getElementById('entry-pulse').value = entry.pulse || '';
        document.getElementById('entry-sugar').value = entry.sugar || '';
        document.getElementById('entry-temp').value = entry.temperature || '';
        document.getElementById('entry-weight').value = entry.weight || '';
        document.getElementById('entry-notes').value = entry.notes || '';
    },

    _formatEntryText: function (e) {
        var profile = e.profileId ? Storage.getProfileById(e.profileId) : null;
        var lines = [];
        lines.push('Дата: ' + Diary.formatDate(e.date) + ' ' + (e.time || ''));
        if (profile) lines.push('Пациент: ' + profile.name);
        if (e.systolic && e.diastolic) lines.push('Давление: ' + e.systolic + '/' + e.diastolic + ' мм рт.ст.');
        if (e.pulse) lines.push('Пульс: ' + e.pulse + ' уд/мин');
        if (e.sugar) lines.push('Сахар крови: ' + e.sugar + ' ммоль/л');
        if (e.temperature) lines.push('Температура: ' + e.temperature + '°C');
        if (e.weight) lines.push('Вес: ' + e.weight + ' кг');
        if (e.notes) lines.push('Заметки: ' + e.notes);
        return lines.join('\n');
    },

    toggleSelect: function (id, checked) {
        if (checked) {
            if (Diary._selectedIds.indexOf(id) === -1) Diary._selectedIds.push(id);
        } else {
            Diary._selectedIds = Diary._selectedIds.filter(function (x) { return x !== id; });
        }
        var bar = document.getElementById('diary-batch-bar');
        var count = document.getElementById('diary-batch-count');
        if (bar) bar.style.display = Diary._selectedIds.length > 0 ? 'flex' : 'none';
        if (count) count.textContent = 'Выбрано: ' + Diary._selectedIds.length;
    },

    _formatEntryShort: function (e) {
        var parts = [Diary.formatDate(e.date) + ' ' + (e.time || '')];
        if (e.systolic && e.diastolic) parts.push('АД ' + e.systolic + '/' + e.diastolic);
        if (e.pulse) parts.push('пульс ' + e.pulse);
        if (e.sugar) parts.push('сахар ' + e.sugar);
        if (e.temperature) parts.push('t° ' + e.temperature);
        if (e.weight) parts.push('вес ' + e.weight);
        if (e.notes) parts.push('(' + e.notes + ')');
        return parts.join(' | ');
    },

    askDoctorBatch: function () {
        if (Diary._selectedIds.length === 0) return;
        var entries = Diary.getEntries();
        var selected = [];
        for (var i = 0; i < entries.length; i++) {
            if (Diary._selectedIds.indexOf(entries[i].id) !== -1) selected.push(entries[i]);
        }
        selected.sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });

        var profile = selected[0].profileId ? Storage.getProfileById(selected[0].profileId) : null;
        var text = 'Проанализируйте динамику показателей здоровья';
        if (profile) text += ' пациента ' + profile.name;
        text += ' (' + selected.length + ' измерений):\n\n';
        for (var j = 0; j < selected.length; j++) {
            text += Diary._formatEntryShort(selected[j]) + '\n';
        }

        Diary._selectedIds = [];
        App.navigateTo('doctor');
        var input = document.getElementById('chat-input');
        if (input) {
            input.value = text;
            input.focus();
        }
    },

    saveToFileBatch: function () {
        if (Diary._selectedIds.length === 0) return;
        var entries = Diary.getEntries();
        var selected = [];
        for (var i = 0; i < entries.length; i++) {
            if (Diary._selectedIds.indexOf(entries[i].id) !== -1) selected.push(entries[i]);
        }
        selected.sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });

        var profile = selected[0].profileId ? Storage.getProfileById(selected[0].profileId) : null;
        var date = new Date().toLocaleDateString('ru-RU');

        var body = '<h2>Дневник здоровья</h2>';
        if (profile) body += '<p><strong>Пациент:</strong> ' + UI.escapeHtml(profile.name) + '</p>';
        body += '<p><strong>Записей:</strong> ' + selected.length + '</p><hr>';

        for (var j = 0; j < selected.length; j++) {
            var e = selected[j];
            body += '<h3>' + UI.escapeHtml(Diary.formatDate(e.date)) + ' ' + UI.escapeHtml(e.time || '') + '</h3>';
            body += '<table>';
            if (e.systolic && e.diastolic) body += '<tr><td><strong>Артериальное давление</strong></td><td>' + e.systolic + '/' + e.diastolic + ' мм рт.ст.</td></tr>';
            if (e.pulse) body += '<tr><td><strong>Пульс</strong></td><td>' + e.pulse + ' уд/мин</td></tr>';
            if (e.sugar) body += '<tr><td><strong>Сахар крови</strong></td><td>' + e.sugar + ' ммоль/л</td></tr>';
            if (e.temperature) body += '<tr><td><strong>Температура</strong></td><td>' + e.temperature + '°C</td></tr>';
            if (e.weight) body += '<tr><td><strong>Вес</strong></td><td>' + e.weight + ' кг</td></tr>';
            body += '</table>';
            if (e.notes) body += '<p><em>' + UI.escapeHtml(e.notes) + '</em></p>';
            if (j < selected.length - 1) body += '<hr>';
        }

        var html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
            '<title>Дневник здоровья — ' + selected.length + ' записей</title>' +
            '<style>' +
            'body{font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:30px;color:#222;font-size:14px;line-height:1.6}' +
            '.header{text-align:center;border-bottom:2px solid #2563eb;padding-bottom:16px;margin-bottom:24px}' +
            '.header h1{color:#2563eb;margin:0;font-size:22px}' +
            '.header p{margin:4px 0;color:#666;font-size:13px}' +
            'h2{color:#2563eb;font-size:18px}h3{color:#1e40af;font-size:15px;margin-top:20px}' +
            'table{width:100%;border-collapse:collapse;margin:8px 0}' +
            'td{border:1px solid #ccc;padding:8px 12px;font-size:14px}' +
            'tr td:first-child{background:#e8f0fe;width:45%;font-weight:bold}' +
            'hr{border:none;border-top:1px solid #ddd;margin:16px 0}' +
            '.footer{text-align:center;margin-top:30px;padding-top:16px;border-top:1px solid #ddd;color:#999;font-size:11px}' +
            '@media print{body{padding:15px}}' +
            '</style></head><body>' +
            '<div class="header"><h1>🩺 Мой домашний доктор</h1><p>Дневник здоровья · ' + date + '</p></div>' +
            body +
            '<div class="footer">Документ сформирован приложением «Мой домашний доктор»</div>' +
            '</body></html>';

        UI.savePDF(html, 'diary_batch_' + selected.length + '_entries.pdf');
    },

    askDoctor: function (id) {
        var entries = Diary.getEntries();
        var entry = null;
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].id === id) { entry = entries[i]; break; }
        }
        if (!entry) return;

        App.navigateTo('doctor');
        var text = 'Проанализируйте мои показатели здоровья:\n\n' + Diary._formatEntryText(entry);
        var input = document.getElementById('chat-input');
        if (input) {
            input.value = text;
            input.focus();
        }
    },

    saveToFile: function (id) {
        var entries = Diary.getEntries();
        var entry = null;
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].id === id) { entry = entries[i]; break; }
        }
        if (!entry) return;

        var profile = entry.profileId ? Storage.getProfileById(entry.profileId) : null;
        var date = new Date().toLocaleDateString('ru-RU');

        var body = '<h2>Запись дневника здоровья</h2>';
        body += '<p><strong>Дата измерения:</strong> ' + UI.escapeHtml(Diary.formatDate(entry.date)) + ' ' + UI.escapeHtml(entry.time || '') + '</p>';
        if (profile) body += '<p><strong>Пациент:</strong> ' + UI.escapeHtml(profile.name) + '</p>';
        body += '<hr><table>';
        if (entry.systolic && entry.diastolic) body += '<tr><td><strong>Артериальное давление</strong></td><td>' + entry.systolic + '/' + entry.diastolic + ' мм рт.ст.</td></tr>';
        if (entry.pulse) body += '<tr><td><strong>Пульс</strong></td><td>' + entry.pulse + ' уд/мин</td></tr>';
        if (entry.sugar) body += '<tr><td><strong>Сахар крови</strong></td><td>' + entry.sugar + ' ммоль/л</td></tr>';
        if (entry.temperature) body += '<tr><td><strong>Температура</strong></td><td>' + entry.temperature + '°C</td></tr>';
        if (entry.weight) body += '<tr><td><strong>Вес</strong></td><td>' + entry.weight + ' кг</td></tr>';
        body += '</table>';
        if (entry.notes) body += '<hr><h3>Заметки</h3><p>' + UI.escapeHtml(entry.notes).replace(/\n/g, '<br>') + '</p>';

        var html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
            '<title>Дневник здоровья — ' + UI.escapeHtml(Diary.formatDate(entry.date)) + '</title>' +
            '<style>' +
            'body{font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:30px;color:#222;font-size:14px;line-height:1.6}' +
            '.header{text-align:center;border-bottom:2px solid #2563eb;padding-bottom:16px;margin-bottom:24px}' +
            '.header h1{color:#2563eb;margin:0;font-size:22px}' +
            '.header p{margin:4px 0;color:#666;font-size:13px}' +
            'h2{color:#2563eb;font-size:18px}h3{color:#1e40af;font-size:15px}' +
            'table{width:100%;border-collapse:collapse;margin:12px 0}' +
            'td{border:1px solid #ccc;padding:8px 12px;font-size:14px}' +
            'tr td:first-child{background:#e8f0fe;width:45%;font-weight:bold}' +
            'hr{border:none;border-top:1px solid #ddd;margin:16px 0}' +
            '.footer{text-align:center;margin-top:30px;padding-top:16px;border-top:1px solid #ddd;color:#999;font-size:11px}' +
            '@media print{body{padding:15px}}' +
            '</style></head><body>' +
            '<div class="header"><h1>🩺 Мой домашний доктор</h1><p>Дневник здоровья · ' + date + '</p></div>' +
            body +
            '<div class="footer">Документ сформирован приложением «Мой домашний доктор»</div>' +
            '</body></html>';

        UI.savePDF(html, 'diary_' + (entry.date || 'entry') + '.pdf');
    }
};
