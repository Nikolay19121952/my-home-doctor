var Profiles = {
    editingId: null,

    init: function () {
        document.getElementById('btn-add-profile').addEventListener('click', function () {
            Profiles.openForm(null);
        });
        document.getElementById('btn-add-profile-empty').addEventListener('click', function () {
            Profiles.openForm(null);
        });
        document.getElementById('btn-back-profiles').addEventListener('click', function () {
            App.navigateTo('profiles');
        });
        document.getElementById('btn-cancel-profile').addEventListener('click', function () {
            App.navigateTo('profiles');
        });
        document.getElementById('btn-back-from-view').addEventListener('click', function () {
            App.navigateTo('profiles');
        });
        document.getElementById('btn-edit-profile').addEventListener('click', function () {
            if (Profiles._viewingId) {
                Profiles.openForm(Profiles._viewingId);
            }
        });
        document.getElementById('btn-delete-profile').addEventListener('click', function () {
            Profiles.confirmDelete();
        });
        document.getElementById('form-profile').addEventListener('submit', function (e) {
            e.preventDefault();
            Profiles.saveForm();
        });

        document.getElementById('gender-male').addEventListener('click', function () {
            Profiles.setGender('male');
        });
        document.getElementById('gender-female').addEventListener('click', function () {
            Profiles.setGender('female');
        });
    },

    /* ----------------------------------------------------------------------
     * ВЫБОР АКТИВНОГО ПРОФИЛЯ (ТЗ v3.1 часть 1, пункт 3.1)
     *
     * Дневник, консультации и графики принадлежат конкретному члену семьи.
     * Здесь выбирается, чьи данные показывает приложение.
     * -------------------------------------------------------------------- */
    switchProfile: function (id) {
        if (!id || id === Storage.getActiveId()) return;

        var name = '';
        var profiles = Storage.getProfiles();
        for (var i = 0; i < profiles.length; i++) {
            if (profiles[i].id === id) name = profiles[i].name;
        }

        Storage.setActiveId(id);

        // Сбрасываем то, что относилось к прежнему профилю
        Diary._current = null;
        Diary._editingDay = null;
        Diary._selectedDays = [];
        Diary._dirty = false;
        Diary.view = 'list';
        if (typeof Graphs !== 'undefined' && Graphs._chart) {
            Graphs._chart.destroy();
            Graphs._chart = null;
            Graphs._meta = null;
        }

        Profiles.renderList();
        Doctor.renderHistory();
        Doctor.updateTitle();
        UI.showToast('Активный профиль: ' + name, 3000);
    },

    activeSelector: function (profiles) {
        var activeId = Storage.getActiveId();
        var html = '<div class="profile-active">' +
            '<label for="active-profile">Активный профиль</label>' +
            '<select id="active-profile" onchange="Profiles.switchProfile(this.value)">';

        for (var i = 0; i < profiles.length; i++) {
            var p = profiles[i];
            html += '<option value="' + UI.escapeHtml(p.id) + '"' +
                (p.id === activeId ? ' selected' : '') + '>' +
                UI.escapeHtml(p.name) + '</option>';
        }

        html += '</select>' +
            '<p class="profile-active-hint">Дневник, консультации и графики показываются ' +
            'для выбранного члена семьи.</p></div>';
        return html;
    },

    renderList: function () {
        var profiles = Storage.getProfiles();
        var listEl = document.getElementById('profiles-list');
        var emptyEl = document.getElementById('profiles-empty');

        if (profiles.length === 0) {
            listEl.innerHTML = '';
            emptyEl.style.display = 'block';
            return;
        }

        emptyEl.style.display = 'none';

        // Переключатель показываем, только когда есть из кого выбирать
        var html = profiles.length > 1 ? Profiles.activeSelector(profiles) : '';
        var activeId = Storage.getActiveId();
        for (var i = 0; i < profiles.length; i++) {
            var p = profiles[i];
            var age = UI.calculateAge(p.birthDate);
            var ageText = age !== null ? ', ' + UI.pluralAge(age) : '';
            var avatar = p.gender === 'female' ? '👩' : '👨';
            var info = p.chronicConditions ? UI.escapeHtml(p.chronicConditions) : '';
            if (info.length > 60) info = info.substring(0, 60) + '...';

            var isActive = p.id === activeId;
            html += '<div class="profile-card' + (isActive ? ' profile-card-active' : '') +
                '" data-id="' + UI.escapeHtml(p.id) + '" tabindex="0" role="button">';
            html += '  <div class="profile-card-header">';
            html += '    <div class="profile-avatar">' + avatar + '</div>';
            html += '    <div>';
            html += '      <div class="profile-card-name">' + UI.escapeHtml(p.name) +
                (isActive && profiles.length > 1 ? ' <span class="profile-badge">активный</span>' : '') + '</div>';
            html += '      <div class="profile-card-age">' + (age !== null ? UI.pluralAge(age) : '') + '</div>';
            html += '    </div>';
            html += '  </div>';
            if (info) {
                html += '  <div class="profile-card-info">' + info + '</div>';
            }
            html += '</div>';
        }
        listEl.innerHTML = html;

        var cards = listEl.querySelectorAll('.profile-card');
        for (var j = 0; j < cards.length; j++) {
            cards[j].addEventListener('click', function () {
                Profiles.openView(this.getAttribute('data-id'));
            });
            cards[j].addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    Profiles.openView(this.getAttribute('data-id'));
                }
            });
        }
    },

    openView: function (id) {
        var profile = Storage.getProfileById(id);
        if (!profile) return;

        Profiles._viewingId = id;
        document.getElementById('profile-view-title').textContent = profile.name;

        var content = document.getElementById('profile-view-content');
        var fields = [
            { label: 'ФИО', value: profile.name },
            { label: 'Дата рождения', value: profile.birthDate ? UI.formatDate(profile.birthDate) + ' (' + UI.pluralAge(UI.calculateAge(profile.birthDate)) + ')' : '' },
            { label: 'Пол', value: profile.gender === 'male' ? 'Мужской' : (profile.gender === 'female' ? 'Женский' : '') },
            { label: 'Группа крови', value: profile.bloodType || '' },
            { label: 'Рост', value: profile.height ? profile.height + ' см' : '' },
            { label: 'Хронические заболевания', value: profile.chronicConditions || '' },
            { label: 'Аллергии', value: profile.allergies || '' },
            { label: 'Принимаемые лекарства', value: profile.medications || '' },
            { label: 'Перенесённые операции', value: profile.surgeries || '' },
            { label: 'Последний визит к врачу', value: profile.lastVisit ? UI.formatDate(profile.lastVisit) : '' },
            { label: 'Курение / алкоголь', value: Profiles.smokingLabel(profile.smoking) },
            { label: 'Заметки', value: profile.notes || '' }
        ];

        var html = '';
        for (var i = 0; i < fields.length; i++) {
            var f = fields[i];
            var valueClass = f.value ? '' : ' empty';
            var valueText = f.value ? UI.escapeHtml(f.value) : 'Не указано';
            html += '<div class="view-field">';
            html += '  <div class="view-label">' + f.label + '</div>';
            html += '  <div class="view-value' + valueClass + '">' + valueText + '</div>';
            html += '</div>';
        }
        content.innerHTML = html;

        App.navigateTo('profile-view');
    },

    openForm: function (id) {
        Profiles.editingId = id;
        var form = document.getElementById('form-profile');
        form.reset();
        Profiles.setGender(null);

        if (id) {
            var profile = Storage.getProfileById(id);
            if (!profile) return;
            document.getElementById('profile-form-title').textContent = 'Редактирование';
            document.getElementById('profile-name').value = profile.name || '';
            document.getElementById('profile-birthdate').value = profile.birthDate || '';
            document.getElementById('profile-blood').value = profile.bloodType || '';
            document.getElementById('profile-height').value = profile.height || '';
            document.getElementById('profile-chronic').value = profile.chronicConditions || '';
            document.getElementById('profile-allergies').value = profile.allergies || '';
            document.getElementById('profile-medications').value = profile.medications || '';
            document.getElementById('profile-surgeries').value = profile.surgeries || '';
            document.getElementById('profile-last-visit').value = profile.lastVisit || '';
            document.getElementById('profile-smoking').value = profile.smoking || '';
            document.getElementById('profile-notes').value = profile.notes || '';
            if (profile.gender) Profiles.setGender(profile.gender);
            document.getElementById('delete-profile-section').style.display = 'block';
        } else {
            document.getElementById('profile-form-title').textContent = 'Новый профиль';
            document.getElementById('delete-profile-section').style.display = 'none';
        }

        App.navigateTo('profile-form');
    },

    setGender: function (value) {
        Profiles._selectedGender = value;
        var maleBtn = document.getElementById('gender-male');
        var femaleBtn = document.getElementById('gender-female');
        maleBtn.classList.remove('active');
        femaleBtn.classList.remove('active');
        if (value === 'male') maleBtn.classList.add('active');
        if (value === 'female') femaleBtn.classList.add('active');
    },

    saveForm: function () {
        var name = document.getElementById('profile-name').value.trim();
        if (!name) {
            document.getElementById('profile-name').focus();
            return;
        }

        var data = {
            name: name,
            birthDate: document.getElementById('profile-birthdate').value || '',
            gender: Profiles._selectedGender || '',
            bloodType: document.getElementById('profile-blood').value || '',
            height: document.getElementById('profile-height').value || '',
            chronicConditions: document.getElementById('profile-chronic').value.trim(),
            allergies: document.getElementById('profile-allergies').value.trim(),
            medications: document.getElementById('profile-medications').value.trim(),
            surgeries: document.getElementById('profile-surgeries').value.trim(),
            lastVisit: document.getElementById('profile-last-visit').value || '',
            smoking: document.getElementById('profile-smoking').value || '',
            notes: document.getElementById('profile-notes').value.trim()
        };

        if (Profiles.editingId) {
            Storage.updateProfile(Profiles.editingId, data);
            UI.showToast('Профиль обновлён');
        } else {
            var wasEmpty = Storage.getProfiles().length === 0;
            Storage.addProfile(data);
            // Первому созданному профилю отходят данные, записанные
            // до того, как в приложении появились карточки семьи
            if (wasEmpty) Storage.migrateToProfiles();
            UI.showToast('Профиль добавлен');
        }

        Profiles.editingId = null;
        Profiles.renderList();
        Doctor.renderHistory();
        Doctor.updateTitle();
        App.navigateTo('profiles');
    },

    confirmDelete: function () {
        if (!Profiles.editingId) return;
        var profile = Storage.getProfileById(Profiles.editingId);
        if (!profile) return;

        UI.showConfirm(
            'Удалить профиль?',
            'Профиль «' + profile.name + '» будет удалён. Это действие нельзя отменить.',
            'Удалить',
            function () {
                var id = Profiles.editingId;
                Storage.deleteProfile(id);
                Storage.dropProfileData(id);   // вместе с профилем удаляем его дневник и чат

                // Если удалили активного — активным станет первый оставшийся
                if (localStorage.getItem(Storage.ACTIVE_KEY) === id) {
                    localStorage.removeItem(Storage.ACTIVE_KEY);
                }

                Profiles.editingId = null;
                Profiles.renderList();
                Doctor.renderHistory();
                Doctor.updateTitle();
                App.navigateTo('profiles');
                UI.showToast('Профиль удалён');
            }
        );
    },

    smokingLabel: function (value) {
        var labels = {
            'none': 'Не курю, не пью',
            'smoking': 'Курю',
            'alcohol': 'Употребляю алкоголь',
            'both': 'Курю и пью',
            'former': 'Бросил(а)'
        };
        return labels[value] || '';
    },

    _viewingId: null,
    _selectedGender: null
};
