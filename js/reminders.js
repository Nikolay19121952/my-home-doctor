var Reminders = {
    editingId: null,
    _showCompleted: false,
    _notifiedIds: {},
    _checkerInterval: null,

    init: function () {
        document.getElementById('btn-add-reminder').addEventListener('click', function () {
            Reminders.openForm(null);
        });
        document.getElementById('btn-add-reminder-empty').addEventListener('click', function () {
            Reminders.openForm(null);
        });
        document.getElementById('btn-back-reminder-form').addEventListener('click', function () {
            App.navigateTo('reminders');
        });
        document.getElementById('btn-cancel-reminder').addEventListener('click', function () {
            App.navigateTo('reminders');
        });
        document.getElementById('btn-delete-reminder').addEventListener('click', function () {
            Reminders.confirmDelete();
        });
        document.getElementById('form-reminder').addEventListener('submit', function (e) {
            e.preventDefault();
            Reminders.saveForm();
        });

        document.getElementById('tab-active-reminders').addEventListener('click', function () {
            Reminders._showCompleted = false;
            Reminders._updateTabs();
            Reminders.renderList();
        });
        document.getElementById('tab-completed-reminders').addEventListener('click', function () {
            Reminders._showCompleted = true;
            Reminders._updateTabs();
            Reminders.renderList();
        });

        var typeBtns = document.querySelectorAll('.reminder-type-btn');
        for (var i = 0; i < typeBtns.length; i++) {
            typeBtns[i].addEventListener('click', function () {
                var btns = document.querySelectorAll('.reminder-type-btn');
                for (var j = 0; j < btns.length; j++) btns[j].classList.remove('active');
                this.classList.add('active');
                Reminders._selectedType = this.getAttribute('data-type');
            });
        }
    },

    onNavigate: function () {
        var profileId = UI.renderProfileSelector('reminders-profile-selector', function (id) {
            Reminders.renderList(id);
        });
        if (profileId) Reminders.renderList(profileId);
    },

    _updateTabs: function () {
        var tabActive = document.getElementById('tab-active-reminders');
        var tabCompleted = document.getElementById('tab-completed-reminders');
        tabActive.classList.toggle('active', !Reminders._showCompleted);
        tabCompleted.classList.toggle('active', Reminders._showCompleted);
    },

    renderList: function (profileId) {
        profileId = profileId || UI.getSelectedProfileId();
        if (!profileId) return;

        var allItems = Storage.getRemindersByProfile(profileId);
        var items = [];
        for (var i = 0; i < allItems.length; i++) {
            if (Reminders._showCompleted) {
                if (allItems[i].completed) items.push(allItems[i]);
            } else {
                if (!allItems[i].completed) items.push(allItems[i]);
            }
        }

        items.sort(function (a, b) {
            var da = a.date + 'T' + (a.time || '00:00');
            var db = b.date + 'T' + (b.time || '00:00');
            if (Reminders._showCompleted) return db.localeCompare(da);
            return da.localeCompare(db);
        });

        var listEl = document.getElementById('reminders-list');
        var emptyEl = document.getElementById('reminders-empty');

        if (items.length === 0) {
            listEl.innerHTML = '';
            emptyEl.style.display = 'block';
            return;
        }

        emptyEl.style.display = 'none';
        var typeIcons = { medication: '💊', appointment: '👨‍⚕️', test: '🔬' };
        var typeLabels = { medication: 'Лекарство', appointment: 'Визит к врачу', test: 'Анализ' };
        var repeatLabels = { once: 'Однократно', daily: 'Ежедневно', weekly: 'Еженедельно' };

        var html = '';
        for (var j = 0; j < items.length; j++) {
            var r = items[j];
            var icon = typeIcons[r.type] || '🔔';
            var cardClass = r.completed ? 'reminder-card reminder-card-completed' : 'reminder-card';
            html += '<div class="' + cardClass + '" data-id="' + UI.escapeHtml(r.id) + '">';
            html += '<div class="reminder-card-left">';
            html += '<span class="reminder-type-icon">' + icon + '</span>';
            html += '<div class="reminder-card-info">';
            html += '<div class="reminder-card-title">' + UI.escapeHtml(r.title) + '</div>';
            html += '<div class="reminder-card-meta">';
            html += UI.formatDate(r.date);
            if (r.time) html += ' в ' + r.time;
            html += ' · ' + (repeatLabels[r.repeat] || r.repeat);
            html += '</div>';
            if (r.notes) {
                html += '<div class="reminder-card-notes">' + UI.escapeHtml(r.notes) + '</div>';
            }
            html += '</div></div>';

            if (!r.completed) {
                html += '<button class="reminder-complete-btn" data-id="' + UI.escapeHtml(r.id) + '" title="Выполнено">✓</button>';
            }
            html += '</div>';
        }
        listEl.innerHTML = html;

        var cards = listEl.querySelectorAll('.reminder-card');
        for (var k = 0; k < cards.length; k++) {
            cards[k].addEventListener('click', function (e) {
                if (e.target.classList.contains('reminder-complete-btn')) return;
                Reminders.openForm(this.getAttribute('data-id'));
            });
        }

        var completeBtns = listEl.querySelectorAll('.reminder-complete-btn');
        for (var m = 0; m < completeBtns.length; m++) {
            completeBtns[m].addEventListener('click', function (e) {
                e.stopPropagation();
                Reminders.toggleComplete(this.getAttribute('data-id'));
            });
        }
    },

    openForm: function (id) {
        Reminders.editingId = id;
        var form = document.getElementById('form-reminder');
        form.reset();
        Reminders._selectedType = 'medication';

        var typeBtns = document.querySelectorAll('.reminder-type-btn');
        for (var i = 0; i < typeBtns.length; i++) {
            typeBtns[i].classList.remove('active');
            if (typeBtns[i].getAttribute('data-type') === 'medication') typeBtns[i].classList.add('active');
        }

        document.getElementById('reminder-date').value = UI.getTodayISO();
        document.getElementById('reminder-time').value = '08:00';

        if (id) {
            var r = Storage.getReminderById(id);
            if (!r) return;
            document.getElementById('reminder-form-title').textContent = 'Редактирование';
            document.getElementById('reminder-title').value = r.title || '';
            document.getElementById('reminder-date').value = r.date || '';
            document.getElementById('reminder-time').value = r.time || '';
            document.getElementById('reminder-repeat').value = r.repeat || 'once';
            document.getElementById('reminder-notes-field').value = r.notes || '';
            document.getElementById('delete-reminder-section').style.display = 'block';

            Reminders._selectedType = r.type || 'medication';
            for (var j = 0; j < typeBtns.length; j++) {
                typeBtns[j].classList.remove('active');
                if (typeBtns[j].getAttribute('data-type') === Reminders._selectedType) {
                    typeBtns[j].classList.add('active');
                }
            }
        } else {
            document.getElementById('reminder-form-title').textContent = 'Новое напоминание';
            document.getElementById('delete-reminder-section').style.display = 'none';
        }

        App.navigateTo('reminder-form');
    },

    saveForm: function () {
        var profileId = UI.getSelectedProfileId();
        if (!profileId) {
            UI.showToast('Сначала выберите пациента');
            return;
        }

        var title = document.getElementById('reminder-title').value.trim();
        if (!title) {
            document.getElementById('reminder-title').focus();
            UI.showToast('Укажите название');
            return;
        }

        var data = {
            profileId: profileId,
            type: Reminders._selectedType || 'medication',
            title: title,
            date: document.getElementById('reminder-date').value || UI.getTodayISO(),
            time: document.getElementById('reminder-time').value || '08:00',
            repeat: document.getElementById('reminder-repeat').value || 'once',
            notes: document.getElementById('reminder-notes-field').value.trim()
        };

        if (Reminders.editingId) {
            Storage.updateReminder(Reminders.editingId, data);
            UI.showToast('Напоминание обновлено');
        } else {
            Storage.addReminder(data);
            UI.showToast('Напоминание добавлено');
        }

        Reminders.editingId = null;
        App.navigateTo('reminders');
    },

    toggleComplete: function (id) {
        var r = Storage.getReminderById(id);
        if (!r) return;

        Storage.updateReminder(id, {
            completed: true,
            completedAt: new Date().toISOString()
        });

        if (r.repeat === 'daily' || r.repeat === 'weekly') {
            var nextDate = new Date(r.date);
            nextDate.setDate(nextDate.getDate() + (r.repeat === 'daily' ? 1 : 7));
            var mm = (nextDate.getMonth() + 1).toString();
            if (mm.length < 2) mm = '0' + mm;
            var dd = nextDate.getDate().toString();
            if (dd.length < 2) dd = '0' + dd;
            var nextISO = nextDate.getFullYear() + '-' + mm + '-' + dd;

            Storage.addReminder({
                profileId: r.profileId,
                type: r.type,
                title: r.title,
                date: nextISO,
                time: r.time,
                repeat: r.repeat,
                notes: r.notes
            });
        }

        Reminders.renderList();
        UI.showToast('Выполнено');
    },

    confirmDelete: function () {
        if (!Reminders.editingId) return;
        UI.showConfirm(
            'Удалить напоминание?',
            'Напоминание будет удалено.',
            'Удалить',
            function () {
                Storage.deleteReminder(Reminders.editingId);
                Reminders.editingId = null;
                App.navigateTo('reminders');
                UI.showToast('Напоминание удалено');
            }
        );
    },

    startChecker: function () {
        if (Reminders._checkerInterval) return;
        Reminders._checkerInterval = setInterval(function () {
            Reminders.checkAndNotify();
        }, 60000);
        Reminders.checkAndNotify();
    },

    checkAndNotify: function () {
        var now = new Date();
        var todayISO = UI.getTodayISO();
        var nowTime = UI.getNowTime();
        var active = Storage.getActiveReminders();

        for (var i = 0; i < active.length; i++) {
            var r = active[i];
            if (r.date > todayISO) continue;
            if (r.date === todayISO && r.time > nowTime) continue;
            if (Reminders._notifiedIds[r.id]) continue;

            Reminders._notifiedIds[r.id] = true;
            UI.showToast('⏰ ' + r.title, 4000);

            if ('Notification' in window && Notification.permission === 'granted') {
                try {
                    new Notification('Мой домашний доктор', {
                        body: r.title,
                        icon: 'icons/icon-192.png'
                    });
                } catch (e) {}
            }
        }
    },

    requestNotificationPermission: function () {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    },

    _selectedType: 'medication'
};
