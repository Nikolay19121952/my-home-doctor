var Diary = {
    editingId: null,

    init: function () {
        document.getElementById('btn-add-diary').addEventListener('click', function () {
            Diary.openForm(null);
        });
        document.getElementById('btn-add-diary-empty').addEventListener('click', function () {
            Diary.openForm(null);
        });
        document.getElementById('btn-back-diary-form').addEventListener('click', function () {
            App.navigateTo('diary');
        });
        document.getElementById('btn-cancel-diary').addEventListener('click', function () {
            App.navigateTo('diary');
        });
        document.getElementById('btn-delete-diary-entry').addEventListener('click', function () {
            Diary.confirmDelete();
        });
        document.getElementById('form-diary').addEventListener('submit', function (e) {
            e.preventDefault();
            Diary.saveForm();
        });

        var chartBtns = document.querySelectorAll('.chart-metric-btn');
        for (var i = 0; i < chartBtns.length; i++) {
            chartBtns[i].addEventListener('click', function () {
                var btns = document.querySelectorAll('.chart-metric-btn');
                for (var j = 0; j < btns.length; j++) btns[j].classList.remove('active');
                this.classList.add('active');
                Diary._selectedMetric = this.getAttribute('data-metric');
                Diary.renderChart();
            });
        }

        var periodBtns = document.querySelectorAll('.chart-period-btn');
        for (var k = 0; k < periodBtns.length; k++) {
            periodBtns[k].addEventListener('click', function () {
                var btns = document.querySelectorAll('.chart-period-btn');
                for (var j = 0; j < btns.length; j++) btns[j].classList.remove('active');
                this.classList.add('active');
                Diary._selectedPeriod = parseInt(this.getAttribute('data-days'));
                Diary.renderChart();
            });
        }
    },

    onNavigate: function () {
        var profileId = UI.renderProfileSelector('diary-profile-selector', function (id) {
            Diary.renderList(id);
            Diary.renderChart();
        });
        if (profileId) {
            Diary.renderList(profileId);
            Diary.renderChart();
        }
    },

    renderList: function (profileId) {
        profileId = profileId || UI.getSelectedProfileId();
        if (!profileId) return;

        var entries = Storage.getDiaryByProfile(profileId);
        var listEl = document.getElementById('diary-list');
        var emptyEl = document.getElementById('diary-empty');
        var chartContainer = document.getElementById('diary-chart-container');

        if (entries.length === 0) {
            listEl.innerHTML = '';
            emptyEl.style.display = 'block';
            chartContainer.style.display = 'none';
            return;
        }

        emptyEl.style.display = 'none';
        chartContainer.style.display = 'block';

        var html = '';
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            html += '<div class="diary-entry-card" data-id="' + UI.escapeHtml(e.id) + '" tabindex="0">';
            html += '<div class="diary-entry-date">' + UI.formatDate(e.date);
            if (e.time) html += ' в ' + UI.formatTime(e.time);
            html += '</div>';
            html += '<div class="diary-entry-values">';

            if (e.systolic || e.diastolic) {
                var sysColor = UI.getValueColor('systolic', e.systolic);
                var diaColor = UI.getValueColor('diastolic', e.diastolic);
                html += '<div class="diary-value">';
                html += '<span class="diary-value-label">Давление</span>';
                html += '<span class="diary-value-num ' + sysColor + '">' + (e.systolic || '—') + '/' + (e.diastolic || '—') + '</span>';
                html += '<span class="diary-value-unit">мм рт.ст.</span>';
                html += '</div>';
            }
            if (e.pulse) {
                html += '<div class="diary-value">';
                html += '<span class="diary-value-label">Пульс</span>';
                html += '<span class="diary-value-num ' + UI.getValueColor('pulse', e.pulse) + '">' + e.pulse + '</span>';
                html += '<span class="diary-value-unit">уд/мин</span>';
                html += '</div>';
            }
            if (e.sugar) {
                html += '<div class="diary-value">';
                html += '<span class="diary-value-label">Сахар</span>';
                html += '<span class="diary-value-num ' + UI.getValueColor('sugar', e.sugar) + '">' + e.sugar + '</span>';
                html += '<span class="diary-value-unit">ммоль/л</span>';
                html += '</div>';
            }
            if (e.temperature) {
                html += '<div class="diary-value">';
                html += '<span class="diary-value-label">Темп.</span>';
                html += '<span class="diary-value-num ' + UI.getValueColor('temperature', e.temperature) + '">' + e.temperature + '</span>';
                html += '<span class="diary-value-unit">°C</span>';
                html += '</div>';
            }
            if (e.weight) {
                html += '<div class="diary-value">';
                html += '<span class="diary-value-label">Вес</span>';
                html += '<span class="diary-value-num">' + e.weight + '</span>';
                html += '<span class="diary-value-unit">кг</span>';
                html += '</div>';
            }

            html += '</div>';
            if (e.notes) {
                html += '<div class="diary-entry-notes">' + UI.escapeHtml(e.notes) + '</div>';
            }
            html += '</div>';
        }
        listEl.innerHTML = html;

        var cards = listEl.querySelectorAll('.diary-entry-card');
        for (var j = 0; j < cards.length; j++) {
            cards[j].addEventListener('click', function () {
                Diary.openForm(this.getAttribute('data-id'));
            });
        }
    },

    openForm: function (id) {
        Diary.editingId = id;
        var form = document.getElementById('form-diary');
        form.reset();

        var today = UI.getTodayISO();
        var now = UI.getNowTime();
        document.getElementById('diary-date').value = today;
        document.getElementById('diary-time').value = now;

        if (id) {
            var entry = Storage.getDiaryEntryById(id);
            if (!entry) return;
            document.getElementById('diary-form-title').textContent = 'Редактирование';
            document.getElementById('diary-date').value = entry.date || today;
            document.getElementById('diary-time').value = entry.time || '';
            document.getElementById('diary-systolic').value = entry.systolic || '';
            document.getElementById('diary-diastolic').value = entry.diastolic || '';
            document.getElementById('diary-pulse').value = entry.pulse || '';
            document.getElementById('diary-sugar').value = entry.sugar || '';
            document.getElementById('diary-temperature').value = entry.temperature || '';
            document.getElementById('diary-weight').value = entry.weight || '';
            document.getElementById('diary-notes').value = entry.notes || '';
            document.getElementById('delete-diary-section').style.display = 'block';
        } else {
            document.getElementById('diary-form-title').textContent = 'Новая запись';
            document.getElementById('delete-diary-section').style.display = 'none';
        }

        App.navigateTo('diary-form');
    },

    saveForm: function () {
        var profileId = UI.getSelectedProfileId();
        if (!profileId) {
            UI.showToast('Сначала выберите пациента');
            return;
        }

        var data = {
            profileId: profileId,
            date: document.getElementById('diary-date').value || UI.getTodayISO(),
            time: document.getElementById('diary-time').value || '',
            systolic: Diary._getNum('diary-systolic'),
            diastolic: Diary._getNum('diary-diastolic'),
            pulse: Diary._getNum('diary-pulse'),
            sugar: Diary._getFloat('diary-sugar'),
            temperature: Diary._getFloat('diary-temperature'),
            weight: Diary._getFloat('diary-weight'),
            notes: document.getElementById('diary-notes').value.trim()
        };

        var hasValue = data.systolic || data.diastolic || data.pulse ||
                       data.sugar || data.temperature || data.weight;
        if (!hasValue) {
            UI.showToast('Заполните хотя бы одно измерение');
            return;
        }

        if (Diary.editingId) {
            Storage.updateDiaryEntry(Diary.editingId, data);
            UI.showToast('Запись обновлена');
        } else {
            Storage.addDiaryEntry(data);
            UI.showToast('Запись добавлена');
        }

        Diary.editingId = null;
        App.navigateTo('diary');
    },

    confirmDelete: function () {
        if (!Diary.editingId) return;
        UI.showConfirm(
            'Удалить запись?',
            'Эта запись будет удалена. Действие нельзя отменить.',
            'Удалить',
            function () {
                Storage.deleteDiaryEntry(Diary.editingId);
                Diary.editingId = null;
                App.navigateTo('diary');
                UI.showToast('Запись удалена');
            }
        );
    },

    _selectedMetric: 'bp',
    _selectedPeriod: 7,

    renderChart: function () {
        var profileId = UI.getSelectedProfileId();
        var container = document.getElementById('diary-chart-area');
        if (!profileId || !container) return;

        var today = new Date();
        var start = new Date(today);
        start.setDate(start.getDate() - Diary._selectedPeriod);
        var startISO = start.toISOString().split('T')[0];
        var endISO = today.toISOString().split('T')[0];

        var entries = Storage.getDiaryByDateRange(profileId, startISO, endISO);
        if (entries.length === 0) {
            container.innerHTML = '<p class="chart-no-data">Нет данных за выбранный период</p>';
            return;
        }

        var metric = Diary._selectedMetric;
        var points = [];

        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            if (metric === 'bp') {
                if (e.systolic) points.push({ date: e.date, value: e.systolic, value2: e.diastolic || 0 });
            } else if (metric === 'pulse' && e.pulse) {
                points.push({ date: e.date, value: e.pulse });
            } else if (metric === 'sugar' && e.sugar) {
                points.push({ date: e.date, value: e.sugar });
            } else if (metric === 'temperature' && e.temperature) {
                points.push({ date: e.date, value: e.temperature });
            } else if (metric === 'weight' && e.weight) {
                points.push({ date: e.date, value: e.weight });
            }
        }

        if (points.length === 0) {
            container.innerHTML = '<p class="chart-no-data">Нет данных по выбранному показателю</p>';
            return;
        }

        var W = 560, H = 260, PAD_L = 50, PAD_R = 20, PAD_T = 20, PAD_B = 40;
        var chartW = W - PAD_L - PAD_R;
        var chartH = H - PAD_T - PAD_B;

        var allValues = [];
        for (var j = 0; j < points.length; j++) {
            allValues.push(points[j].value);
            if (points[j].value2) allValues.push(points[j].value2);
        }
        var minVal = Math.min.apply(null, allValues);
        var maxVal = Math.max.apply(null, allValues);
        var range = maxVal - minVal;
        if (range < 5) { minVal -= 3; maxVal += 3; range = maxVal - minVal; }
        minVal = Math.floor(minVal - range * 0.1);
        maxVal = Math.ceil(maxVal + range * 0.1);
        range = maxVal - minVal;

        function yPos(val) {
            return PAD_T + chartH - ((val - minVal) / range * chartH);
        }
        function xPos(idx) {
            if (points.length === 1) return PAD_L + chartW / 2;
            return PAD_L + (idx / (points.length - 1)) * chartW;
        }

        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="diary-chart-svg">';

        // Горизонтальные линии сетки
        var gridSteps = 4;
        for (var g = 0; g <= gridSteps; g++) {
            var gVal = minVal + (range * g / gridSteps);
            var gY = yPos(gVal);
            svg += '<line x1="' + PAD_L + '" y1="' + gY + '" x2="' + (W - PAD_R) + '" y2="' + gY + '" stroke="#E0E0E0" stroke-width="1"/>';
            svg += '<text x="' + (PAD_L - 8) + '" y="' + (gY + 4) + '" text-anchor="end" fill="#9E9E9E" font-size="11">' + Math.round(gVal) + '</text>';
        }

        // Линия данных
        var linePoints = '';
        for (var p = 0; p < points.length; p++) {
            linePoints += xPos(p) + ',' + yPos(points[p].value) + ' ';
        }
        svg += '<polyline points="' + linePoints.trim() + '" fill="none" stroke="#1565C0" stroke-width="2.5" stroke-linejoin="round"/>';

        // Вторая линия для давления
        if (metric === 'bp') {
            var line2 = '';
            for (var p2 = 0; p2 < points.length; p2++) {
                if (points[p2].value2) {
                    line2 += xPos(p2) + ',' + yPos(points[p2].value2) + ' ';
                }
            }
            if (line2) {
                svg += '<polyline points="' + line2.trim() + '" fill="none" stroke="#2E7D32" stroke-width="2.5" stroke-linejoin="round"/>';
            }
        }

        // Точки
        for (var d = 0; d < points.length; d++) {
            svg += '<circle cx="' + xPos(d) + '" cy="' + yPos(points[d].value) + '" r="5" fill="#1565C0"/>';
            if (metric === 'bp' && points[d].value2) {
                svg += '<circle cx="' + xPos(d) + '" cy="' + yPos(points[d].value2) + '" r="5" fill="#2E7D32"/>';
            }
        }

        // Даты по оси X
        var maxLabels = 7;
        var step = Math.max(1, Math.ceil(points.length / maxLabels));
        for (var lbl = 0; lbl < points.length; lbl += step) {
            svg += '<text x="' + xPos(lbl) + '" y="' + (H - 8) + '" text-anchor="middle" fill="#9E9E9E" font-size="11">' + UI.formatDateShort(points[lbl].date) + '</text>';
        }

        svg += '</svg>';

        if (metric === 'bp') {
            svg += '<div class="chart-legend">';
            svg += '<span class="chart-legend-item"><span class="chart-dot" style="background:#1565C0"></span> Верхнее</span>';
            svg += '<span class="chart-legend-item"><span class="chart-dot" style="background:#2E7D32"></span> Нижнее</span>';
            svg += '</div>';
        }

        container.innerHTML = svg;
    },

    _getNum: function (id) {
        var val = document.getElementById(id).value.trim();
        if (!val) return null;
        var n = parseInt(val, 10);
        return isNaN(n) ? null : n;
    },

    _getFloat: function (id) {
        var val = document.getElementById(id).value.trim().replace(',', '.');
        if (!val) return null;
        var n = parseFloat(val);
        return isNaN(n) ? null : n;
    }
};
