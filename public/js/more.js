var More = {
    REMINDERS_KEY: 'mdd_reminders',
    ANALYSES_KEY: 'mdd_analyses',
    currentView: 'menu',

    init: function () {},

    showSection: function (section) {
        More.currentView = section;
        var container = document.querySelector('#more .container');
        if (!container) return;

        if (section === 'reminders') {
            More.renderReminders(container);
        } else if (section === 'analyses') {
            More.renderAnalyses(container);
        } else if (section === 'settings') {
            More.renderSettings(container);
        } else if (section === 'about') {
            More.renderAbout(container);
        }
    },

    showMenu: function () {
        More.currentView = 'menu';
        var container = document.querySelector('#more .container');
        if (!container) return;
        container.innerHTML =
            '<h2 style="margin-bottom: 16px;">Ещё</h2>' +
            '<div class="more-list">' +
            '<button class="more-item" onclick="More.showSection(\'analyses\')">' +
            '<span class="more-icon">📄</span>' +
            '<div class="more-text"><span class="more-label">Анализы и обследования</span><span class="more-desc">Результаты и заключения</span></div>' +
            '</button>' +
            '<button class="more-item" onclick="More.showSection(\'reminders\')">' +
            '<span class="more-icon">🔔</span>' +
            '<div class="more-text"><span class="more-label">Напоминания</span><span class="more-desc">Приём лекарств и визиты</span></div>' +
            '</button>' +
            '<button class="more-item" onclick="More.showSection(\'settings\')">' +
            '<span class="more-icon">⚙️</span>' +
            '<div class="more-text"><span class="more-label">Настройки</span><span class="more-desc">Экспорт и импорт данных</span></div>' +
            '</button>' +
            '<button class="more-item" onclick="More.showSection(\'about\')">' +
            '<span class="more-icon">ℹ️</span>' +
            '<div class="more-text"><span class="more-label">О приложении</span><span class="more-desc">Описание, инструкция, обратная связь</span></div>' +
            '</button>' +
            '</div>';
    },

    // ===== НАПОМИНАНИЯ =====

    getReminders: function () {
        var data = localStorage.getItem(More.REMINDERS_KEY);
        if (!data) return [];
        try { return JSON.parse(data); } catch (e) { return []; }
    },

    saveReminders: function (reminders) {
        localStorage.setItem(More.REMINDERS_KEY, JSON.stringify(reminders));
    },

    renderReminders: function (container) {
        var reminders = More.getReminders();
        var html = '<div class="section-header">' +
            '<button class="btn btn-outline btn-back" onclick="More.showMenu()">← Назад</button>' +
            '<h2>Напоминания</h2>' +
            '</div>';

        html += '<div id="reminder-form" style="display:none;" class="card-form">' +
            '<div class="form-group"><label for="reminder-text">Напоминание</label>' +
            '<input type="text" id="reminder-text" placeholder="Принять лекарство, визит к врачу..."></div>' +
            '<div class="form-row"><div class="form-group form-group-half"><label for="reminder-date">Дата</label>' +
            '<input type="date" id="reminder-date"></div>' +
            '<div class="form-group form-group-half"><label for="reminder-time">Время</label>' +
            '<input type="time" id="reminder-time"></div></div>' +
            '<div class="form-group"><label for="reminder-repeat">Повтор</label>' +
            '<select id="reminder-repeat"><option value="daily">Ежедневно</option><option value="once">Однократно</option>' +
            '<option value="weekly">Еженедельно</option></select></div>' +
            '<div class="form-actions" style="flex-direction:row;"><button class="btn btn-primary" onclick="More.addReminder()">Сохранить</button>' +
            '<button class="btn btn-outline" onclick="More.hideReminderForm()">Отмена</button></div></div>';

        html += '<button class="btn btn-primary" id="btn-add-reminder" onclick="More.showReminderForm()" style="margin-bottom:16px;">' +
            '<span class="btn-icon">+</span> Добавить</button>';

        if (reminders.length === 0) {
            html += '<div class="empty-state"><div class="empty-icon">🔔</div><h3>Нет напоминаний</h3>' +
                '<p>Добавьте напоминание о приёме лекарств или визите к врачу.</p></div>';
        } else {
            html += '<div class="reminders-list">';
            for (var i = 0; i < reminders.length; i++) {
                var r = reminders[i];
                var repeatText = r.repeat === 'daily' ? 'Ежедневно' : r.repeat === 'weekly' ? 'Еженедельно' : 'Однократно';
                var datePart = r.date ? r.date + ' ' : '';
                html += '<div class="reminder-card">' +
                    '<div class="reminder-info">' +
                    '<span class="reminder-text">' + UI.escapeHtml(r.text) + '</span>' +
                    '<span class="reminder-meta">' + UI.escapeHtml(datePart + (r.time || '')) + ' · ' + repeatText + '</span>' +
                    '</div>' +
                    '<div class="reminder-actions">' +
                    '<button class="btn btn-outline btn-small btn-gcal" onclick="More.addToGoogleCalendar(\'' + r.id + '\')" title="Добавить в Google Календарь">📅</button>' +
                    '<button class="diary-delete-btn" onclick="More.deleteReminder(\'' + r.id + '\')" title="Удалить">✕</button>' +
                    '</div></div>';
            }
            html += '</div>';
        }

        container.innerHTML = html;
    },

    showReminderForm: function () {
        document.getElementById('reminder-form').style.display = 'block';
        document.getElementById('btn-add-reminder').style.display = 'none';
    },

    hideReminderForm: function () {
        document.getElementById('reminder-form').style.display = 'none';
        document.getElementById('btn-add-reminder').style.display = '';
    },

    addReminder: function () {
        var text = document.getElementById('reminder-text').value.trim();
        var date = document.getElementById('reminder-date').value;
        var time = document.getElementById('reminder-time').value;
        var repeat = document.getElementById('reminder-repeat').value;

        if (!text) {
            UI.showToast('Введите текст напоминания');
            return;
        }

        var reminders = More.getReminders();
        reminders.push({
            id: Storage.generateId(),
            text: text,
            date: date,
            time: time,
            repeat: repeat,
            createdAt: new Date().toISOString()
        });
        More.saveReminders(reminders);
        More.renderReminders(document.querySelector('#more .container'));
        UI.showToast('Напоминание добавлено');
    },

    addToGoogleCalendar: function (id) {
        var reminders = More.getReminders();
        var r = null;
        for (var i = 0; i < reminders.length; i++) {
            if (reminders[i].id === id) { r = reminders[i]; break; }
        }
        if (!r) return;

        var title = encodeURIComponent(r.text);
        var details = encodeURIComponent('Напоминание из приложения «Мой домашний доктор»');

        var dateStr = r.date || new Date().toISOString().split('T')[0];
        var timeStr = r.time || '09:00';
        var startDt = dateStr.replace(/-/g, '') + 'T' + timeStr.replace(/:/g, '') + '00';

        var timeParts = timeStr.split(':');
        var endH = parseInt(timeParts[0], 10) + 1;
        if (endH > 23) endH = 23;
        var endTime = (endH < 10 ? '0' : '') + endH + ':' + timeParts[1];
        var endDt = dateStr.replace(/-/g, '') + 'T' + endTime.replace(/:/g, '') + '00';

        var recur = '';
        if (r.repeat === 'daily') recur = '&recur=RRULE:FREQ=DAILY';
        if (r.repeat === 'weekly') recur = '&recur=RRULE:FREQ=WEEKLY';

        var url = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
            '&text=' + title +
            '&dates=' + startDt + '/' + endDt +
            '&details=' + details +
            recur;

        window.open(url, '_blank');
    },

    deleteReminder: function (id) {
        UI.showConfirm('Удалить напоминание?', 'Это действие нельзя отменить.', 'Удалить', function () {
            var reminders = More.getReminders();
            var filtered = reminders.filter(function (r) { return r.id !== id; });
            More.saveReminders(filtered);
            More.renderReminders(document.querySelector('#more .container'));
            UI.showToast('Напоминание удалено');
        });
    },

    // ===== АНАЛИЗЫ =====

    getAnalyses: function () {
        var data = localStorage.getItem(More.ANALYSES_KEY);
        if (!data) return [];
        try { return JSON.parse(data); } catch (e) { return []; }
    },

    saveAnalyses: function (analyses) {
        localStorage.setItem(More.ANALYSES_KEY, JSON.stringify(analyses));
    },

    renderAnalyses: function (container) {
        var analyses = More.getAnalyses();
        var html = '<div class="section-header">' +
            '<button class="btn btn-outline btn-back" onclick="More.showMenu()">← Назад</button>' +
            '<h2>Анализы</h2>' +
            '</div>';

        html += '<div id="analysis-form" style="display:none;" class="card-form">' +
            '<h3 id="analysis-form-title" style="margin-bottom:12px;">Новый анализ</h3>' +
            '<div class="form-group"><label for="analysis-name">Название</label>' +
            '<input type="text" id="analysis-name" placeholder="Общий анализ крови, УЗИ..."></div>' +
            '<div class="form-row"><div class="form-group form-group-half"><label for="analysis-date">Дата</label>' +
            '<input type="date" id="analysis-date"></div>' +
            '<div class="form-group form-group-half"><label for="analysis-profile">Пациент</label>' +
            '<select id="analysis-profile"><option value="">Не указан</option></select></div></div>' +
            '<div class="form-group"><label for="analysis-result">Результаты / заключение</label>' +
            '<textarea id="analysis-result" rows="4" placeholder="Опишите результаты или заключение врача"></textarea></div>' +
            '<div class="form-group"><label>Файлы</label>' +
            '<div class="file-buttons">' +
            '<button type="button" class="btn btn-outline file-btn" onclick="More.capturePhoto()">📷 Снимок</button>' +
            '<button type="button" class="btn btn-outline file-btn" onclick="document.getElementById(\'analysis-file\').click()">📁 Файл / PDF</button>' +
            '</div>' +
            '<input type="file" id="analysis-camera" accept="image/*" capture="environment" style="display:none;" onchange="More.handleFile(this)">' +
            '<input type="file" id="analysis-file" accept="image/*,.pdf" multiple style="display:none;" onchange="More.handleFile(this)">' +
            '<div id="analysis-files-preview"></div></div>' +
            '<div class="form-actions" style="flex-direction:row;"><button id="analysis-save-btn" class="btn btn-primary" onclick="More.addAnalysis()">Сохранить</button>' +
            '<button class="btn btn-outline" onclick="More.hideAnalysisForm()">Отмена</button></div></div>';

        html += '<button class="btn btn-primary" id="btn-add-analysis" onclick="More.showAnalysisForm()" style="margin-bottom:16px;">' +
            '<span class="btn-icon">+</span> Добавить</button>';

        if (analyses.length === 0) {
            html += '<div class="empty-state"><div class="empty-icon">📄</div><h3>Нет записей</h3>' +
                '<p>Добавьте результаты анализов или обследований.</p></div>';
        } else {
            for (var i = 0; i < analyses.length; i++) {
                var a = analyses[i];
                var profile = a.profileId ? Storage.getProfileById(a.profileId) : null;
                html += '<div class="analysis-card">' +
                    '<div class="analysis-header">' +
                    '<span class="analysis-name">' + UI.escapeHtml(a.name) + '</span>' +
                    '<button class="diary-delete-btn" onclick="More.deleteAnalysis(\'' + a.id + '\')" title="Удалить">✕</button>' +
                    '</div>' +
                    '<div class="analysis-meta">' +
                    (a.date ? UI.escapeHtml(Diary.formatDate(a.date)) : '') +
                    (profile ? ' · ' + UI.escapeHtml(profile.name) : '') +
                    '</div>' +
                    (a.result ? '<div class="analysis-result">' + UI.escapeHtml(a.result).replace(/\n/g, '<br>') + '</div>' : '') +
                    More.renderAnalysisFiles(a.files) +
                    '<button class="btn btn-outline btn-full" style="margin-top:12px;" onclick="More.editAnalysis(\'' + a.id + '\')">✏️ Редактировать</button>' +
                    '<button class="btn btn-outline btn-full" style="margin-top:8px;" onclick="Doctor.askAboutAnalysis(\'' + a.id + '\')">🩺 Спросить доктора</button>' +
                    '<button class="btn btn-outline btn-full" style="margin-top:8px;" onclick="More.saveAnalysisToFile(\'' + a.id + '\')">💾 Сохранить в файл</button>' +
                    '</div>';
            }
        }

        container.innerHTML = html;

        var profileSelect = document.getElementById('analysis-profile');
        if (profileSelect) {
            var profiles = Storage.getProfiles();
            for (var j = 0; j < profiles.length; j++) {
                var opt = document.createElement('option');
                opt.value = profiles[j].id;
                opt.textContent = profiles[j].name;
                profileSelect.appendChild(opt);
            }
        }
    },

    showAnalysisForm: function () {
        More._editingId = null;
        More._pendingFiles = [];
        document.getElementById('analysis-form').style.display = 'block';
        document.getElementById('btn-add-analysis').style.display = 'none';
        document.getElementById('analysis-name').value = '';
        document.getElementById('analysis-result').value = '';
        document.getElementById('analysis-profile').value = '';
        document.getElementById('analysis-form-title').textContent = 'Новый анализ';
        document.getElementById('analysis-save-btn').textContent = 'Сохранить';
        More.renderFilesPreview();
        var now = new Date();
        document.getElementById('analysis-date').value = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0');
    },

    editAnalysis: function (id) {
        var analyses = More.getAnalyses();
        var analysis = null;
        for (var i = 0; i < analyses.length; i++) {
            if (analyses[i].id === id) { analysis = analyses[i]; break; }
        }
        if (!analysis) return;

        More._editingId = id;
        More._pendingFiles = analysis.files ? analysis.files.slice() : [];

        More.renderAnalyses(document.querySelector('#more .container'));

        document.getElementById('analysis-form').style.display = 'block';
        document.getElementById('btn-add-analysis').style.display = 'none';
        document.getElementById('analysis-name').value = analysis.name || '';
        document.getElementById('analysis-date').value = analysis.date || '';
        document.getElementById('analysis-result').value = analysis.result || '';
        document.getElementById('analysis-profile').value = analysis.profileId || '';
        document.getElementById('analysis-form-title').textContent = 'Редактировать анализ';
        document.getElementById('analysis-save-btn').textContent = 'Сохранить изменения';
        More.renderFilesPreview();
    },

    hideAnalysisForm: function () {
        document.getElementById('analysis-form').style.display = 'none';
        document.getElementById('btn-add-analysis').style.display = '';
        More._pendingFiles = [];
        More._editingId = null;
    },

    _pendingFiles: [],
    _editingId: null,

    capturePhoto: function () {
        document.getElementById('analysis-camera').click();
    },

    handleFile: function (input) {
        var files = input.files;
        if (!files || !files.length) return;

        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            if (file.size > 5 * 1024 * 1024) {
                UI.showToast('Файл слишком большой (макс. 5 МБ)');
                continue;
            }
            (function (f) {
                var reader = new FileReader();
                reader.onload = function (e) {
                    More._pendingFiles.push({
                        name: f.name,
                        type: f.type,
                        size: f.size,
                        data: e.target.result
                    });
                    More.renderFilesPreview();
                };
                reader.readAsDataURL(f);
            })(file);
        }
        input.value = '';
    },

    renderFilesPreview: function () {
        var container = document.getElementById('analysis-files-preview');
        if (!container) return;
        if (!More._pendingFiles.length) {
            container.innerHTML = '';
            return;
        }
        var html = '';
        for (var i = 0; i < More._pendingFiles.length; i++) {
            var f = More._pendingFiles[i];
            var isImage = f.type && f.type.indexOf('image') === 0;
            html += '<div class="file-preview-item">';
            if (isImage) {
                html += '<img src="' + f.data + '" class="file-preview-thumb">';
            } else {
                html += '<span class="file-preview-icon">📄</span>';
            }
            html += '<span class="file-preview-name">' + UI.escapeHtml(f.name) + '</span>';
            html += '<button type="button" class="file-preview-remove" onclick="More.removeFile(' + i + ')">✕</button>';
            html += '</div>';
        }
        container.innerHTML = html;
    },

    removeFile: function (index) {
        More._pendingFiles.splice(index, 1);
        More.renderFilesPreview();
    },

    addAnalysis: function () {
        var name = document.getElementById('analysis-name').value.trim();
        var date = document.getElementById('analysis-date').value;
        var profileId = document.getElementById('analysis-profile').value;
        var result = document.getElementById('analysis-result').value.trim();

        if (!name) {
            UI.showToast('Введите название анализа');
            return;
        }

        var files = More._pendingFiles.slice();
        var totalSize = 0;
        for (var i = 0; i < files.length; i++) {
            totalSize += files[i].data.length;
        }
        if (totalSize > 10 * 1024 * 1024) {
            UI.showToast('Общий размер файлов слишком большой');
            return;
        }

        var analyses = More.getAnalyses();

        if (More._editingId) {
            for (var j = 0; j < analyses.length; j++) {
                if (analyses[j].id === More._editingId) {
                    analyses[j].name = name;
                    analyses[j].date = date;
                    analyses[j].profileId = profileId;
                    analyses[j].result = result;
                    analyses[j].files = files;
                    analyses[j].updatedAt = new Date().toISOString();
                    break;
                }
            }
            More._editingId = null;
            More._pendingFiles = [];
            More.saveAnalyses(analyses);
            More.renderAnalyses(document.querySelector('#more .container'));
            UI.showToast('Анализ обновлён');
        } else {
            analyses.unshift({
                id: Storage.generateId(),
                name: name,
                date: date,
                profileId: profileId,
                result: result,
                files: files,
                createdAt: new Date().toISOString()
            });
            More._pendingFiles = [];
            More.saveAnalyses(analyses);
            More.renderAnalyses(document.querySelector('#more .container'));
            UI.showToast('Анализ добавлен');
        }
    },

    renderAnalysisFiles: function (files) {
        if (!files || !files.length) return '';
        var html = '<div class="analysis-files">';
        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            var isImage = f.type && f.type.indexOf('image') === 0;
            if (isImage) {
                html += '<a href="' + f.data + '" target="_blank" class="analysis-file-link">' +
                    '<img src="' + f.data + '" class="analysis-file-thumb"></a>';
            } else {
                html += '<a href="' + f.data + '" download="' + UI.escapeHtml(f.name) + '" class="analysis-file-link">' +
                    '<span class="analysis-file-icon">📄</span> ' + UI.escapeHtml(f.name) + '</a>';
            }
        }
        html += '</div>';
        return html;
    },

    deleteAnalysis: function (id) {
        UI.showConfirm('Удалить запись?', 'Это действие нельзя отменить.', 'Удалить', function () {
            var analyses = More.getAnalyses();
            var filtered = analyses.filter(function (a) { return a.id !== id; });
            More.saveAnalyses(filtered);
            More.renderAnalyses(document.querySelector('#more .container'));
            UI.showToast('Запись удалена');
        });
    },

    saveAnalysisToFile: function (id) {
        var analyses = More.getAnalyses();
        var a = null;
        for (var i = 0; i < analyses.length; i++) {
            if (analyses[i].id === id) { a = analyses[i]; break; }
        }
        if (!a) return;

        var profile = a.profileId ? Storage.getProfileById(a.profileId) : null;
        var date = new Date().toLocaleDateString('ru-RU');

        var body = '';
        body += '<h2>' + UI.escapeHtml(a.name) + '</h2>';
        if (a.date) body += '<p><strong>Дата:</strong> ' + UI.escapeHtml(Diary.formatDate(a.date)) + '</p>';
        if (profile) body += '<p><strong>Пациент:</strong> ' + UI.escapeHtml(profile.name) + '</p>';
        if (a.result) {
            body += '<hr><h3>Результаты / заключение</h3>';
            body += '<p>' + UI.escapeHtml(a.result).replace(/\n/g, '<br>') + '</p>';
        }
        if (a.files && a.files.length > 0) {
            body += '<hr><h3>Прикреплённые файлы</h3><ul>';
            for (var j = 0; j < a.files.length; j++) {
                body += '<li>' + UI.escapeHtml(a.files[j].name) + '</li>';
            }
            body += '</ul>';
        }

        var html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
            '<title>Анализ — ' + UI.escapeHtml(a.name) + '</title>' +
            '<style>' +
            'body{font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:30px;color:#222;font-size:14px;line-height:1.6}' +
            '.header{text-align:center;border-bottom:2px solid #2563eb;padding-bottom:16px;margin-bottom:24px}' +
            '.header h1{color:#2563eb;margin:0;font-size:22px}' +
            '.header p{margin:4px 0;color:#666;font-size:13px}' +
            'h2{color:#2563eb;font-size:18px}' +
            'h3{color:#1e40af;font-size:15px;margin-top:16px}' +
            'hr{border:none;border-top:1px solid #ddd;margin:16px 0}' +
            'p{margin:6px 0}' +
            'ul{margin:8px 0;padding-left:24px}' +
            'li{margin:4px 0}' +
            '.footer{text-align:center;margin-top:30px;padding-top:16px;border-top:1px solid #ddd;color:#999;font-size:11px}' +
            '@media print{body{padding:15px}}' +
            '</style></head><body>' +
            '<div class="header"><h1>🩺 Мой домашний доктор</h1><p>Анализы и обследования · ' + date + '</p></div>' +
            body +
            '<div class="footer">Документ сформирован приложением «Мой домашний доктор»</div>' +
            '</body></html>';

        var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'analysis_' + (a.date || 'report') + '.html';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        UI.showToast('Файл сохранён');
    },

    // ===== НАСТРОЙКИ (экспорт/импорт) =====

    renderSettings: function (container) {
        var html = '<div class="section-header">' +
            '<button class="btn btn-outline btn-back" onclick="More.showMenu()">← Назад</button>' +
            '<h2>Настройки</h2>' +
            '</div>';

        html += '<div class="settings-list">' +
            '<div class="settings-section"><h3>Экспорт данных</h3>' +
            '<p class="settings-desc">Сохраните все данные в файл для резервной копии или переноса на другое устройство.</p>' +
            '<button class="btn btn-primary btn-full" onclick="More.exportData()">📥 Экспортировать данные</button></div>' +
            '<div class="settings-section"><h3>Импорт данных</h3>' +
            '<p class="settings-desc">Загрузите ранее сохранённый файл с данными.</p>' +
            '<input type="file" id="import-file" accept=".json" style="display:none;" onchange="More.importData()">' +
            '<button class="btn btn-outline btn-full" onclick="document.getElementById(\'import-file\').click()">📤 Импортировать данные</button></div>' +
            '<div class="settings-section"><h3>Очистка</h3>' +
            '<p class="settings-desc">Удалить все данные приложения. Это действие нельзя отменить.</p>' +
            '<button class="btn btn-danger btn-full" onclick="More.clearAllData()">🗑 Удалить все данные</button></div>' +
            '</div>';

        container.innerHTML = html;
    },

    exportData: function () {
        var data = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            profiles: Storage.getProfiles(),
            diary: Diary.getEntries(),
            reminders: More.getReminders(),
            analyses: More.getAnalyses(),
            chatHistory: Doctor.getHistory()
        };

        var json = JSON.stringify(data, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'mdd_backup_' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        UI.showToast('Данные экспортированы');
    },

    importData: function () {
        var fileInput = document.getElementById('import-file');
        var file = fileInput.files[0];
        if (!file) return;

        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var data = JSON.parse(e.target.result);
                UI.showConfirm(
                    'Импортировать данные?',
                    'Текущие данные будут заменены данными из файла. Это действие нельзя отменить.',
                    'Импортировать',
                    function () {
                        if (data.profiles) Storage.saveProfiles(data.profiles);
                        if (data.diary) Diary.saveEntries(data.diary);
                        if (data.reminders) More.saveReminders(data.reminders);
                        if (data.analyses) More.saveAnalyses(data.analyses);
                        if (data.chatHistory) Doctor.saveHistory(data.chatHistory);
                        UI.showToast('Данные импортированы');
                        More.renderSettings(document.querySelector('#more .container'));
                    }
                );
            } catch (err) {
                UI.showToast('Ошибка: неверный формат файла');
            }
        };
        reader.readAsText(file);
        fileInput.value = '';
    },

    clearAllData: function () {
        UI.showConfirm(
            'Удалить ВСЕ данные?',
            'Профили, дневник, напоминания, анализы и история чата будут удалены безвозвратно.',
            'Удалить всё',
            function () {
                localStorage.removeItem('mdd_profiles');
                localStorage.removeItem('mdd_diary');
                localStorage.removeItem('mdd_reminders');
                localStorage.removeItem('mdd_analyses');
                localStorage.removeItem('mdd_chat_history');
                UI.showToast('Все данные удалены');
                More.renderSettings(document.querySelector('#more .container'));
            }
        );
    },

    // ===== О ПРИЛОЖЕНИИ =====

    renderAbout: function (container) {
        var html = '<div class="section-header">' +
            '<button class="btn btn-outline btn-back" onclick="More.showMenu()">← Назад</button>' +
            '<h2>О приложении</h2>' +
            '</div>';

        html += '<div class="about-section">' +
            '<div class="about-logo">🩺</div>' +
            '<h3>Мой домашний доктор</h3>' +
            '<p class="about-version">Версия 1.0</p>' +
            '</div>';

        html += '<div class="about-card">' +
            '<h3>📋 Что это за приложение?</h3>' +
            '<p>«Мой домашний доктор» — это персональный медицинский помощник для вас и вашей семьи. ' +
            'Приложение помогает следить за здоровьем, хранить результаты анализов и получать ' +
            'консультации от ИИ-доктора на основе технологии Claude от Anthropic.</p>' +
            '</div>';

        html += '<div class="about-card">' +
            '<h3>📖 Как пользоваться</h3>' +
            '<div class="about-instructions">' +
            '<div class="about-step"><span class="about-step-icon">🏠</span>' +
            '<div><strong>Главная</strong> — общая информация и быстрый доступ к основным функциям.</div></div>' +
            '<div class="about-step"><span class="about-step-icon">👨‍👩‍👧‍👦</span>' +
            '<div><strong>Семья</strong> — создайте профили членов семьи с указанием возраста, ' +
            'хронических заболеваний и принимаемых лекарств. Доктор учтёт эту информацию при консультации.</div></div>' +
            '<div class="about-step"><span class="about-step-icon">📋</span>' +
            '<div><strong>Дневник</strong> — ведите ежедневные записи о самочувствии: давление, пульс, сахар, ' +
            'температура, вес. Отметьте галочками нужные записи — появится панель с кнопками ' +
            '«🩺 Отправить доктору» (отправка пакета измерений на анализ) и «💾 Файл» (скачать выбранные записи). ' +
            'Кнопка «💾 Файл» у каждой записи сохраняет одно измерение. Все файлы загружаются в папку Downloads.</div></div>' +
            '<div class="about-step"><span class="about-step-icon">🩺</span>' +
            '<div><strong>Доктор</strong> — чат с ИИ-доктором. Опишите симптомы, прикрепите файлы анализов ' +
            '(PDF, фото) через кнопку 📎 или перетащите их в чат. Доктор расшифрует результаты и даст рекомендации. ' +
            'Каждый ответ доктора имеет кнопки: 🖨️ Печать и 💾 Файл (скачать в папку Downloads).</div></div>' +
            '<div class="about-step"><span class="about-step-icon">📄</span>' +
            '<div><strong>Анализы</strong> — храните результаты обследований с прикреплёнными PDF-файлами. ' +
            'Кнопка «Спросить доктора» отправит файлы на расшифровку. Кнопка «💾 Сохранить в файл» скачает результат в папку Downloads.</div></div>' +
            '<div class="about-step"><span class="about-step-icon">🔔</span>' +
            '<div><strong>Напоминания</strong> — создавайте напоминания о приёме лекарств и визитах к врачу. ' +
            'Кнопка 📅 добавит событие в Google Календарь.</div></div>' +
            '</div></div>';

        html += '<div class="about-card">' +
            '<h3>⚠️ Важно</h3>' +
            '<p>Приложение предоставляет справочную информацию и <strong>не заменяет визит к врачу</strong>. ' +
            'Для постановки диагноза и назначения лечения обязательно обратитесь к квалифицированному специалисту.</p>' +
            '</div>';

        html += '<div class="about-card">' +
            '<h3>💬 Обратная связь</h3>' +
            '<p>Ваши отзывы, замечания и предложения помогут сделать приложение лучше!</p>' +
            '<p>Свяжитесь с разработчиком:</p>' +
            '<p style="margin-top:8px;">Написать в мессенджер ВКонтакте по адресу: ' +
            '<a href="https://m.vk.com/Nick_l2591" target="_blank" style="color:#2563eb;font-weight:bold;">@Nick_l2591</a></p>' +
            '<p>или по E-mail: <a href="mailto:vonoiral2591@gmail.com" style="color:#2563eb;font-weight:bold;">vonoiral2591@gmail.com</a></p>' +
            '</div>';

        html += '<div class="about-footer">' +
            '<p>Разработано в рамках курса «Оператор Claude»</p>' +
            '<p>© 2026 Николай Дмитриевич</p>' +
            '</div>';

        container.innerHTML = html;
    }
};
