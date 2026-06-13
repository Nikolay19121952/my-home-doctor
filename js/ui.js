var UI = {
    showToast: function (message, duration) {
        duration = duration || 2000;
        var toast = document.getElementById('toast');
        toast.textContent = message;
        toast.style.display = 'block';
        clearTimeout(UI._toastTimer);
        UI._toastTimer = setTimeout(function () {
            toast.style.display = 'none';
        }, duration);
    },

    showConfirm: function (title, message, confirmText, onConfirm) {
        var overlay = document.getElementById('modal-overlay');
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-message').textContent = message;
        document.getElementById('modal-confirm').textContent = confirmText;
        overlay.style.display = 'flex';

        var confirmBtn = document.getElementById('modal-confirm');
        var cancelBtn = document.getElementById('modal-cancel');

        function cleanup() {
            overlay.style.display = 'none';
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            overlay.removeEventListener('click', handleOverlay);
        }

        function handleConfirm() {
            cleanup();
            onConfirm();
        }

        function handleCancel() {
            cleanup();
        }

        function handleOverlay(e) {
            if (e.target === overlay) {
                cleanup();
            }
        }

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        overlay.addEventListener('click', handleOverlay);
    },

    formatDate: function (isoString) {
        if (!isoString) return '';
        var months = [
            'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
            'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
        ];
        var parts = isoString.split('-');
        var day = parseInt(parts[2], 10);
        var month = months[parseInt(parts[1], 10) - 1];
        var year = parts[0];
        return day + ' ' + month + ' ' + year;
    },

    formatDateShort: function (isoString) {
        if (!isoString) return '';
        var parts = isoString.split('-');
        return parseInt(parts[2], 10) + '.' + parts[1];
    },

    formatTime: function (timeString) {
        if (!timeString) return '';
        return timeString;
    },

    getTodayISO: function () {
        var d = new Date();
        var mm = (d.getMonth() + 1).toString();
        if (mm.length < 2) mm = '0' + mm;
        var dd = d.getDate().toString();
        if (dd.length < 2) dd = '0' + dd;
        return d.getFullYear() + '-' + mm + '-' + dd;
    },

    getNowTime: function () {
        var d = new Date();
        var hh = d.getHours().toString();
        if (hh.length < 2) hh = '0' + hh;
        var mm = d.getMinutes().toString();
        if (mm.length < 2) mm = '0' + mm;
        return hh + ':' + mm;
    },

    calculateAge: function (birthDateString) {
        if (!birthDateString) return null;
        var birth = new Date(birthDateString);
        var today = new Date();
        var age = today.getFullYear() - birth.getFullYear();
        var monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    },

    escapeHtml: function (str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    pluralAge: function (age) {
        if (age === null || age === undefined) return '';
        var lastTwo = age % 100;
        var lastOne = age % 10;
        var word;
        if (lastTwo >= 11 && lastTwo <= 19) {
            word = 'лет';
        } else if (lastOne === 1) {
            word = 'год';
        } else if (lastOne >= 2 && lastOne <= 4) {
            word = 'года';
        } else {
            word = 'лет';
        }
        return age + ' ' + word;
    },

    renderProfileSelector: function (containerId, onChangeCallback) {
        var container = document.getElementById(containerId);
        if (!container) return null;
        var profiles = Storage.getProfiles();
        if (profiles.length === 0) {
            container.innerHTML = '<div class="profile-selector-empty">Сначала добавьте профиль в разделе «Семья»</div>';
            return null;
        }
        var savedId = sessionStorage.getItem('mdd_selected_profile');
        var found = false;
        for (var i = 0; i < profiles.length; i++) {
            if (profiles[i].id === savedId) { found = true; break; }
        }
        if (!found) savedId = profiles[0].id;
        sessionStorage.setItem('mdd_selected_profile', savedId);

        var html = '<div class="profile-selector">';
        html += '<label class="profile-selector-label">Пациент:</label>';
        html += '<select class="profile-selector-select" id="' + containerId + '-select">';
        for (var j = 0; j < profiles.length; j++) {
            var sel = profiles[j].id === savedId ? ' selected' : '';
            html += '<option value="' + UI.escapeHtml(profiles[j].id) + '"' + sel + '>';
            html += UI.escapeHtml(profiles[j].name);
            html += '</option>';
        }
        html += '</select></div>';
        container.innerHTML = html;

        var select = document.getElementById(containerId + '-select');
        select.addEventListener('change', function () {
            sessionStorage.setItem('mdd_selected_profile', this.value);
            if (onChangeCallback) onChangeCallback(this.value);
        });

        return savedId;
    },

    getSelectedProfileId: function () {
        return sessionStorage.getItem('mdd_selected_profile') || null;
    },

    getValueColor: function (metric, value) {
        if (value === null || value === undefined || value === '') return '';
        var v = parseFloat(value);
        if (isNaN(v)) return '';

        switch (metric) {
            case 'systolic':
                if (v < 120) return 'value-normal';
                if (v < 140) return 'value-elevated';
                return 'value-high';
            case 'diastolic':
                if (v < 80) return 'value-normal';
                if (v < 90) return 'value-elevated';
                return 'value-high';
            case 'pulse':
                if (v >= 60 && v <= 90) return 'value-normal';
                if (v >= 50 && v <= 100) return 'value-elevated';
                return 'value-high';
            case 'sugar':
                if (v >= 3.3 && v <= 5.5) return 'value-normal';
                if (v <= 6.9) return 'value-elevated';
                return 'value-high';
            case 'temperature':
                if (v >= 35.5 && v <= 37.0) return 'value-normal';
                if (v <= 38.0) return 'value-elevated';
                return 'value-high';
            default:
                return '';
        }
    },

    _toastTimer: null
};
