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
        if (!a || !a.files || a.files.length === 0) {
            UI.showToast('Нет прикреплённых файлов');
            return Promise.resolve();
        }

        var saved = 0;
        function saveNext() {
            if (saved >= a.files.length) {
                UI.showToast('Сохранено ' + a.files.length + ' файлов');
                return Promise.resolve();
            }
            var f = a.files[saved];
            var link = document.createElement('a');
            link.href = f.data;
            link.download = f.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            saved++;
            return new Promise(function (resolve) {
                setTimeout(function () { saveNext().then(resolve); }, 500);
            });
        }
        return saveNext();
    },

    // ===== НАСТРОЙКИ (экспорт/импорт) =====

    renderSettings: function (container) {
        var html = '<div class="section-header">' +
            '<button class="btn btn-outline btn-back" onclick="More.showMenu()">← Назад</button>' +
            '<h2>Настройки</h2>' +
            '</div>';

        html += '<div class="settings-list">' +
            '<div class="settings-section"><h3>Экспорт данных</h3>' +
            '<p class="settings-desc">Сохраните в файл всё сразу: профили семьи, дневник, ' +
            'историю консультаций, анализы и напоминания. Файл подойдёт и для резервной копии, ' +
            'и для переноса на другое устройство.</p>' +
            '<button class="btn btn-primary btn-full" onclick="More.exportData()">📥 Экспортировать данные</button></div>' +
            '<div class="settings-section"><h3>Импорт данных</h3>' +
            '<p class="settings-desc">Загрузите ранее сохранённый файл. Перед восстановлением ' +
            'приложение покажет, что именно в нём лежит.</p>' +
            '<input type="file" id="import-file" accept=".json" style="display:none;" onchange="More.importData()">' +
            '<button class="btn btn-outline btn-full" onclick="document.getElementById(\'import-file\').click()">📤 Импортировать данные</button></div>' +
            '<div class="settings-section"><h3>Очистка</h3>' +
            '<p class="settings-desc">Удалить все данные приложения. Это действие нельзя отменить.</p>' +
            '<button class="btn btn-danger btn-full" onclick="More.clearAllData()">🗑 Удалить все данные</button></div>' +
            '</div>';

        container.innerHTML = html;
    },

    /* ------------------------------------------------------------------
     * ЭКСПОРТ ДАННЫХ
     * Единственное место в приложении, где сохраняется резервная копия.
     * Выгружается вся конфигурация: профили семьи, дневник (включая
     * незавершённый черновик), обе истории чата, анализы и напоминания.
     * ---------------------------------------------------------------- */
    exportData: function () {
        var profiles = Storage.getProfiles();

        // С версии 3.1 у каждого члена семьи свой дневник и своя переписка —
        // в копию попадают данные всех профилей, а не только активного
        var byProfile = {};
        for (var i = 0; i < profiles.length; i++) {
            byProfile[profiles[i].id] = Storage.collectProfileData(profiles[i].id);
        }
        byProfile['default'] = Storage.collectProfileData('default');

        var data = {
            version: '3.1',
            exportDate: new Date().toISOString(),
            device: navigator.userAgent,
            profiles: profiles,
            activeProfile: Storage.getActiveId(),
            profileData: byProfile,
            reminders: More.getReminders(),
            analyses: More.getAnalyses(),
            // Данные активного профиля дублируются в прежнем виде,
            // чтобы копию можно было открыть и старой версией приложения
            diaryRecords: Diary.getRecords(),
            diaryCurrent: Diary.getCurrent(),
            diaryChat: Diary.getChat(),
            diarySettings: Diary.getSettings(),
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
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

        // Запоминаем дату копии — по ней дневник напомнит, когда пора снова
        localStorage.setItem(More.BACKUP_KEY, new Date().toISOString());
        sessionStorage.removeItem('mdd_backup_hidden');

        UI.showToast('Экспорт готов! Файл загружается...', 3000);
    },

    BACKUP_KEY: 'mdd_last_backup',
    BACKUP_DAYS: 14,   // через сколько дней напоминать

    /* ------------------------------------------------------------------
     * НАПОМИНАНИЕ О РЕЗЕРВНОЙ КОПИИ
     * Все данные приложения живут только в браузере. Если его почистить
     * или сменить устройство — дневник и консультации пропадут. Поэтому
     * дневник показывает полоску, когда копия давно не делалась.
     * ---------------------------------------------------------------- */

    /* Сколько дней прошло с последней копии; null — если копий не было */
    daysSinceBackup: function () {
        var iso = localStorage.getItem(More.BACKUP_KEY);
        if (!iso) return null;
        var then = new Date(iso).getTime();
        if (isNaN(then)) return null;
        return Math.floor((Date.now() - then) / 86400000);
    },

    /* Нужно ли показывать напоминание прямо сейчас */
    backupDue: function () {
        // Не тревожим, пока данных почти нет
        var days = Object.keys(Diary.getRecords()).length;
        if (days < 3) return false;
        if (sessionStorage.getItem('mdd_backup_hidden')) return false;

        var since = More.daysSinceBackup();
        return since === null || since >= More.BACKUP_DAYS;
    },

    /* Текст полоски */
    backupText: function () {
        var since = More.daysSinceBackup();
        if (since === null) return 'Резервная копия данных ещё ни разу не сохранялась.';
        return 'Последняя резервная копия сделана ' + since +
            Diary.plural(since, ' день', ' дня', ' дней') + ' назад.';
    },

    /* Кнопка «Сохранить копию» прямо из дневника */
    backupNow: function () {
        More.exportData();
        if (App.currentPage === 'diary') Diary.renderList();
    },

    /* Кнопка «Позже» — прячем до следующего открытия приложения */
    backupLater: function () {
        sessionStorage.setItem('mdd_backup_hidden', '1');
        if (App.currentPage === 'diary') Diary.renderList();
    },

    /* Приводит файл любого из прежних форматов к единому виду.
       Понимает: текущий формат, формат кнопки «Экспорт» из дневника
       (family_profile_*.json) и самый первый плоский дневник v1. */
    normalizeBackup: function (data) {
        if (!data || typeof data !== 'object') return null;

        var out = {
            profiles: data.profiles || data.profile || null,
            diaryRecords: data.diaryRecords || data.diary || null,
            diaryCurrent: data.diaryCurrent !== undefined ? data.diaryCurrent : data.diary_current,
            diaryChat: data.diaryChat || data.chat || null,
            diarySettings: data.diarySettings || data.settings || null,
            reminders: data.reminders || null,
            analyses: data.analyses || null,
            chatHistory: data.chatHistory || data.doctor_chat || null,
            legacyDiary: null,
            // Данные по каждому члену семьи (появились в версии 3.1)
            profileData: data.profileData || null,
            activeProfile: data.activeProfile || null
        };

        // В самом первом формате дневник был плоским массивом измерений
        if (out.diaryRecords && Object.prototype.toString.call(out.diaryRecords) === '[object Array]') {
            out.legacyDiary = out.diaryRecords;
            out.diaryRecords = null;
        }

        var hasSomething = out.profiles || out.diaryRecords || out.legacyDiary ||
            out.diaryChat || out.chatHistory || out.reminders || out.analyses ||
            out.profileData;
        return hasSomething ? out : null;
    },

    /* ------------------------------------------------------------------
     * ИМПОРТ ДАННЫХ
     * ---------------------------------------------------------------- */
    importData: function () {
        var fileInput = document.getElementById('import-file');
        var file = fileInput.files[0];
        if (!file) return;

        var reader = new FileReader();

        reader.onload = function (e) {
            var raw;
            try {
                raw = JSON.parse(e.target.result);
            } catch (err) {
                UI.showToast('Неверный формат файла — это не резервная копия', 4000);
                fileInput.value = '';
                return;
            }

            var data = More.normalizeBackup(raw);
            if (!data) {
                UI.showToast('В файле нет данных приложения', 4000);
                fileInput.value = '';
                return;
            }

            // Показываем, что именно лежит в файле, до перезаписи
            var parts = [];
            if (data.profiles) {
                parts.push(data.profiles.length +
                    Diary.plural(data.profiles.length, ' профиль', ' профиля', ' профилей'));
            }
            // Считаем записи по всем членам семьи, а не только по активному
            var days = 0;
            var consults = 0;
            if (data.profileData) {
                for (var pid in data.profileData) {
                    if (!data.profileData.hasOwnProperty(pid)) continue;
                    var bucket = data.profileData[pid];
                    try {
                        if (bucket.mdd_diary_records) {
                            days += Object.keys(JSON.parse(bucket.mdd_diary_records)).length;
                        }
                        if (bucket.mdd_diary_chat) {
                            consults += JSON.parse(bucket.mdd_diary_chat).length;
                        }
                    } catch (e) { /* повреждённый кусок пропускаем */ }
                }
            } else {
                days = data.diaryRecords ? Object.keys(data.diaryRecords).length
                    : (data.legacyDiary ? data.legacyDiary.length : 0);
                consults = (data.diaryChat && data.diaryChat.length) || 0;
            }

            if (days) {
                parts.push(days + Diary.plural(days, ' запись', ' записи', ' записей') + ' дневника');
            }
            if (consults) {
                parts.push(consults +
                    Diary.plural(consults, ' консультация', ' консультации', ' консультаций'));
            }
            if (data.analyses && data.analyses.length) {
                parts.push(data.analyses.length +
                    Diary.plural(data.analyses.length, ' анализ', ' анализа', ' анализов'));
            }
            if (data.reminders && data.reminders.length) {
                parts.push(data.reminders.length +
                    Diary.plural(data.reminders.length, ' напоминание', ' напоминания', ' напоминаний'));
            }

            UI.showConfirm(
                'Это перезапишет текущие данные!',
                'В файле: ' + (parts.length ? parts.join(', ') : 'данные приложения') +
                '. Продолжить восстановление?',
                'Восстановить',
                function () {
                    if (data.profiles) Storage.saveProfiles(data.profiles);
                    if (data.activeProfile) Storage.setActiveId(data.activeProfile);

                    if (data.profileData) {
                        // Копия версии 3.1: у каждого члена семьи свои данные
                        for (var pid in data.profileData) {
                            if (data.profileData.hasOwnProperty(pid)) {
                                Storage.restoreProfileData(pid, data.profileData[pid]);
                            }
                        }
                    } else {
                        // Копия прежних версий: всё принадлежит активному профилю
                        if (data.diaryRecords) Diary.saveRecords(data.diaryRecords);
                        if (data.diaryChat) Diary.saveChat(data.diaryChat);
                        if (data.diarySettings) Diary.saveSettings(data.diarySettings);
                        Diary.saveCurrent(data.diaryCurrent || null);
                        if (data.chatHistory) Doctor.saveHistory(data.chatHistory);

                        // Плоский дневник первой версии переносим в формат по дням
                        if (data.legacyDiary) {
                            localStorage.setItem(Diary.LEGACY_KEY, JSON.stringify(data.legacyDiary));
                            Diary.migrateLegacy();
                        }
                    }

                    if (data.reminders) More.saveReminders(data.reminders);
                    if (data.analyses) More.saveAnalyses(data.analyses);

                    UI.showToast('Данные восстановлены! Перезагружаю...', 2000);
                    setTimeout(function () { location.reload(); }, 1200);
                }
            );
            fileInput.value = '';
        };

        reader.onerror = function () {
            UI.showToast('Не удалось прочитать файл', 3500);
            fileInput.value = '';
        };

        reader.readAsText(file);
    },

    clearAllData: function () {
        UI.showConfirm(
            'Удалить ВСЕ данные?',
            'Профили, дневник, напоминания, анализы и история чата будут удалены безвозвратно.',
            'Удалить всё',
            function () {
                // Данные разделены по членам семьи, поэтому убираем
                // все ключи приложения, включая ключи с суффиксом профиля
                var keys = [];
                for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i);
                    if (k && k.indexOf('mdd_') === 0) keys.push(k);
                }
                for (var j = 0; j < keys.length; j++) {
                    localStorage.removeItem(keys[j]);
                }
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
            '<p class="about-version">Версия 3.1 · август 2026</p>' +
            '</div>';

        // ТЕКУЩАЯ ВЕРСИЯ
        html += '<div class="about-card">' +
            '<h3>📌 Текущая версия</h3>' +
            '<ul class="about-facts">' +
            '<li><strong>Версия:</strong> 3.1</li>' +
            '<li><strong>Дата выпуска:</strong> август 2026</li>' +
            '<li><strong>Статус:</strong> работает в production</li>' +
            '<li><strong>Показатели дневника:</strong> 7 — давление верхнее и нижнее, ' +
            'пульс, сатурация (SpO2), сахар, температура, вес</li>' +
            '<li><strong>Проверок при вводе:</strong> 17</li>' +
            '<li><strong>Измерений в одном дне:</strong> до 36</li>' +
            '<li><strong>Графики:</strong> по любому из показателей за выбранные дни</li>' +
            '<li><strong>Документы для врача:</strong> дневник за период одним файлом PDF</li>' +
            '<li><strong>Несколько членов семьи:</strong> у каждого свои дневник, ' +
            'консультации и графики</li>' +
            '<li><strong>Поддерживаемые браузеры:</strong> Chrome, Яндекс, Firefox, ' +
            'Edge, Safari, Opera, Maxthon</li>' +
            '</ul></div>';

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
            '<div><strong>Главная</strong> — кнопка «Записать измерение» открывает сегодняшнюю ' +
            'запись: дата и время подставляются сами, курсор стоит в нужной строке — ' +
            'остаётся ввести показатели. После сохранения приложение возвращается сюда же, ' +
            'чтобы можно было сразу записать следующее измерение.</div></div>' +
            '<div class="about-step"><span class="about-step-icon">👨‍👩‍👧‍👦</span>' +
            '<div><strong>Семья</strong> — если карточек несколько, вверху появляется выбор ' +
            'активного профиля: приложение показывает дневник, консультации и графики ' +
            'выбранного человека, у каждого они свои. ' +
            'Создайте профили членов семьи с указанием возраста, роста, ' +
            'хронических заболеваний, аллергий, принимаемых лекарств, операций и вредных привычек. ' +
            'Доктор учтёт эту информацию при консультации. Заполняйте только те графы, которые считаете важными.</div></div>' +
            '<div class="about-step"><span class="about-step-icon">📔</span>' +
            '<div><strong>Дневник</strong> — одна запись хранит все измерения за один день, до 36 штук. ' +
            'Нажмите «Запись измерений», выберите дату и заполняйте таблицу: время, давление верхнее и нижнее, ' +
            'пульс, сатурация (SpO2), сахар, температура, вес. Вносить измерения можно в течение всего дня — ' +
            'черновик сохраняется сам. Кнопка «Сохранить и выйти» откладывает запись, «Завершить запись» ' +
            'закрывает день и предлагает распечатать или сохранить его в PDF. ' +
            'В списке отметьте галочками нужные дни и нажмите «🩺 Отправить доктору» — ответ появится ' +
            'в «Истории чата». Кнопка «Создать график» построит график по отмеченным дням: ' +
            'выберите показатель — и увидите его динамику, статистику и таблицу значений. ' +
            'График можно отправить доктору или сохранить в PDF. ' +
            'Кнопка «Печать периода» соберёт все отмеченные дни в один файл PDF ' +
            'со сводной таблицей и статистикой — удобно взять с собой к врачу. ' +
            'Для переноса данных на другое устройство используйте ' +
            '«Ещё → Настройки → Экспортировать данные».</div></div>' +
            '<div class="about-step"><span class="about-step-icon">🩺</span>' +
            '<div><strong>Доктор</strong> — чат с ИИ-доктором. Опишите симптомы, прикрепите файлы анализов ' +
            '(PDF, фото) через кнопку 📎 или перетащите их в чат. Доктор расшифрует результаты и даст рекомендации. ' +
            'Под каждым ответом доктора есть кнопка «🖨️ Печать / 💾 Файл»: браузер предложит выбрать принтер ' +
            'или «Сохранить как PDF» — файл попадёт в папку Downloads (Загрузки).</div></div>' +
            '<div class="about-step"><span class="about-step-icon">📄</span>' +
            '<div><strong>Анализы</strong> — храните результаты обследований с прикреплёнными PDF-файлами. ' +
            'Кнопка «Спросить доктора» отправит файлы на расшифровку. Кнопка «💾 Сохранить в файл» скачает каждый прикреплённый файл отдельно в папку Downloads (Загрузки).</div></div>' +
            '<div class="about-step"><span class="about-step-icon">🔔</span>' +
            '<div><strong>Напоминания</strong> — создавайте напоминания о приёме лекарств и визитах к врачу. ' +
            'Кнопка 📅 добавит событие в Google Календарь.</div></div>' +
            '<div class="about-step"><span class="about-step-icon">⚙️</span>' +
            '<div><strong>Настройки</strong> — экспорт и импорт данных. «Экспортировать данные» сохранит ' +
            'в один файл JSON всю конфигурацию: профили семьи, дневник, обе истории переписки с доктором, ' +
            'анализы и напоминания. «Импортировать данные» восстановит всё это на другом устройстве ' +
            'или после очистки браузера.</div></div>' +
            '</div></div>';

        html += '<div class="about-card">' +
            '<h3>⚠️ Важно</h3>' +
            '<p>Приложение предоставляет справочную информацию и <strong>не заменяет визит к врачу</strong>. ' +
            'Для постановки диагноза и назначения лечения обязательно обратитесь к квалифицированному специалисту.</p>' +
            '</div>';

        // ИСТОРИЯ РАЗВИТИЯ (ТЗ v2.2, доработка №3)
        html += '<div class="about-card">' +
            '<h3>📜 История развития</h3>' +
            '<div class="about-timeline">' +

            '<div class="about-release">' +
            '<div class="about-release-head"><span class="about-release-ver">v1.0</span>' +
            '<span class="about-release-date">май 2026</span>' +
            '<span class="about-release-status about-done">завершено</span></div>' +
            '<ul><li>Полное медицинское заключение</li>' +
            '<li>Профили членов семьи</li>' +
            '<li>Чат с ИИ-доктором</li>' +
            '<li>Развёртывание на Render.com</li></ul></div>' +

            '<div class="about-release">' +
            '<div class="about-release-head"><span class="about-release-ver">v2.0</span>' +
            '<span class="about-release-date">июнь 2026</span>' +
            '<span class="about-release-status about-plan">спроектировано</span></div>' +
            '<ul><li>Дневник здоровья в настольной версии</li>' +
            '<li>Одна запись = один день, до 36 измерений</li>' +
            '<li>Подробное техническое задание</li>' +
            '<li>Реализация отменена в пользу веб-версии</li></ul></div>' +

            '<div class="about-release">' +
            '<div class="about-release-head"><span class="about-release-ver">v2.1</span>' +
            '<span class="about-release-date">июль 2026</span>' +
            '<span class="about-release-status about-done">запущено</span></div>' +
            '<ul><li>Дневник здоровья в веб-версии</li>' +
            '<li>Хранение данных в браузере (localStorage)</li>' +
            '<li>Браузерный календарь для выбора даты</li>' +
            '<li>Экспорт и импорт JSON — синхронизация между устройствами</li>' +
            '<li>Консультации на Claude Haiku 4.5</li>' +
            '<li>Печать и сохранение PDF средствами браузера</li>' +
            '<li>Дневник работает без интернета</li>' +
            '<li>Проверено на смартфоне в Chrome и Яндекс — ошибок не найдено</li></ul></div>' +

            '<div class="about-release">' +
            '<div class="about-release-head"><span class="about-release-ver">v2.2</span>' +
            '<span class="about-release-date">июль 2026</span>' +
            '<span class="about-release-status about-done">запущено</span></div>' +
            '<ul><li>Новый показатель — сатурация кислорода (SpO2)</li>' +
            '<li>Кнопки печати и сохранения объединены в одну</li>' +
            '<li>Эта страница с историей разработки</li>' +
            '<li>Резервное копирование собрано в одном месте — в «Настройках»</li></ul></div>' +

            '<div class="about-release">' +
            '<div class="about-release-head"><span class="about-release-ver">v3.0</span>' +
            '<span class="about-release-date">июль 2026</span>' +
            '<span class="about-release-status about-done">запущено</span></div>' +
            '<ul><li>Графики измерений за выбранные дни</li>' +
            '<li>Выбор показателя: давление, пульс, SpO2, сахар, температура, вес</li>' +
            '<li>Для давления — две линии на одном графике</li>' +
            '<li>Статистика: количество, минимум, максимум, среднее</li>' +
            '<li>Отправка графика доктору на анализ</li>' +
            '<li>Сохранение графика в PDF вместе с таблицей значений</li>' +
            '<li>Графики строятся без интернета</li></ul></div>' +

            '<div class="about-release">' +
            '<div class="about-release-head"><span class="about-release-ver">v3.1</span>' +
            '<span class="about-release-date">август 2026</span>' +
            '<span class="about-release-status about-done">текущая</span></div>' +
            '<ul><li>Кнопка быстрой записи на главном экране: дата и время ' +
            'подставляются сами</li>' +
            '<li>Печать дневника за период — один файл вместо отдельного на каждый день</li>' +
            '<li>В документе для врача давление в одной колонке и статистика ' +
            'с подсчётом выходов за границы</li>' +
            '<li>Подсветка дней, где показатели выходили за обычные границы</li>' +
            '<li>Напоминание о резервной копии данных</li></ul></div>' +

            '</div></div>';

        // КОМАНДА
        html += '<div class="about-card">' +
            '<h3>👥 Команда разработки</h3>' +
            '<div class="about-member">' +
            '<strong>Николай Дмитриевич Ларионов</strong>' +
            '<p>Автор идеи, архитектор и тестировщик. Придумывает функции, ' +
            'формулирует требования и проверяет каждую версию на реальных устройствах.</p></div>' +
            '<div class="about-member">' +
            '<strong>«Домашний доктор» — ИИ-консультант</strong>' +
            '<p>Превращает замыслы в технические задания: требования, диапазоны значений, ' +
            'сценарии проверки. Ведёт медицинские консультации в приложении.</p></div>' +
            '<div class="about-member">' +
            '<strong>Claude — ИИ-разработчик</strong>' +
            '<p>Пишет и проверяет код приложения: интерфейс, хранилище данных, ' +
            'интеграцию с API, тестирование.</p></div>' +
            '<p class="about-scheme">Схема работы: <strong>идея → техническое задание → код → тестирование</strong></p>' +
            '</div>';

        // ПЛАН РАЗВИТИЯ
        html += '<div class="about-card">' +
            '<h3>🗺️ План развития</h3>' +
            '<ul class="about-facts">' +
            '<li><strong>v3.1</strong> — август 2026, текущая версия</li>' +
            '<li><strong>v4.0</strong> — облачная синхронизация без ручного переноса файлов, ' +
            'интерактивные графики и сравнение нескольких показателей</li>' +
            '<li><strong>v4.1</strong> — мобильное приложение или расширение возможностей</li>' +
            '</ul>' +
            '<p class="about-note">Планы могут меняться по результатам тестирования ' +
            'и пожеланиям пользователей.</p></div>';

        html += '<div class="about-card">' +
            '<h3>💬 Обратная связь</h3>' +
            '<p>Ваши отзывы, замечания и предложения помогут сделать приложение лучше!</p>' +
            '<p>Свяжитесь с разработчиком:</p>' +
            '<p style="margin-top:8px;">Написать в мессенджер ВКонтакте по адресу: ' +
            '<a href="https://m.vk.com/Nick_l2591" target="_blank" style="color:#2563eb;font-weight:bold;">@Nick_l2591</a></p>' +
            '<p>или по E-mail: <a href="mailto:vonoiral2591@gmail.com" style="color:#2563eb;font-weight:bold;">vonoiral2591@gmail.com</a></p>' +
            '</div>';

        html += '<div class="about-card">' +
            '<h3>🙏 Благодарности</h3>' +
            '<ul class="about-facts">' +
            '<li>Anthropic — за Claude</li>' +
            '<li>Render.com — за надёжный хостинг</li>' +
            '<li>Всем, кто тестировал приложение и присылал замечания</li>' +
            '<li>Пользователям приложения</li>' +
            '</ul></div>';

        html += '<div class="about-footer">' +
            '<p>Разработано в рамках курса «Оператор Claude»</p>' +
            '<p>© 2026 Николай Дмитриевич</p>' +
            '</div>';

        container.innerHTML = html;
    }
};
