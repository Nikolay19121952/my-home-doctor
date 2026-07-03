var Doctor = {
    HISTORY_KEY: 'mdd_chat_history',
    isLoading: false,
    _pendingFiles: null,

    _droppedFiles: [],

    init: function () {
        var sendBtn = document.getElementById('btn-send-message');
        var input = document.getElementById('chat-input');
        var clearBtn = document.getElementById('btn-clear-chat');
        var chatArea = document.getElementById('chat-messages');
        var fileInput = document.getElementById('chat-file-input');

        sendBtn.addEventListener('click', function () {
            Doctor.sendMessage();
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                Doctor.sendMessage();
            }
        });

        clearBtn.addEventListener('click', function () {
            UI.showConfirm(
                'Очистить историю?',
                'Вся история переписки будет удалена. Это действие нельзя отменить.',
                'Очистить',
                function () {
                    Doctor.clearHistory();
                    UI.showToast('История очищена');
                }
            );
        });

        chatArea.addEventListener('dragover', function (e) {
            e.preventDefault();
            chatArea.classList.add('chat-dragover');
        });
        chatArea.addEventListener('dragleave', function () {
            chatArea.classList.remove('chat-dragover');
        });
        chatArea.addEventListener('drop', function (e) {
            e.preventDefault();
            chatArea.classList.remove('chat-dragover');
            if (e.dataTransfer && e.dataTransfer.files.length > 0) {
                Doctor.addFiles(e.dataTransfer.files);
            }
        });

        fileInput.addEventListener('change', function () {
            if (fileInput.files.length > 0) {
                Doctor.addFiles(fileInput.files);
                fileInput.value = '';
            }
        });

        Doctor.renderHistory();
    },

    getHistory: function () {
        var data = localStorage.getItem(Doctor.HISTORY_KEY);
        if (!data) return [];
        try {
            return JSON.parse(data);
        } catch (e) {
            return [];
        }
    },

    saveHistory: function (history) {
        localStorage.setItem(Doctor.HISTORY_KEY, JSON.stringify(history));
    },

    clearHistory: function () {
        localStorage.removeItem(Doctor.HISTORY_KEY);
        Doctor.renderHistory();
    },

    addFiles: function (fileList) {
        var allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'];
        var added = 0;
        for (var i = 0; i < fileList.length; i++) {
            var file = fileList[i];
            if (allowed.indexOf(file.type) === -1) continue;
            (function (f) {
                var reader = new FileReader();
                reader.onload = function (e) {
                    var dataUrl = e.target.result;
                    var commaIdx = dataUrl.indexOf(',');
                    var header = dataUrl.substring(0, commaIdx);
                    var base64 = dataUrl.substring(commaIdx + 1);
                    var mediaType = 'application/pdf';
                    var mtMatch = header.match(/data:([^;]+)/);
                    if (mtMatch) mediaType = mtMatch[1];
                    Doctor._droppedFiles.push({ name: f.name, mediaType: mediaType, data: base64 });
                    Doctor.renderDropFiles();
                };
                reader.readAsDataURL(f);
            })(file);
            added++;
        }
        if (added === 0) {
            UI.showToast('Поддерживаются файлы: PDF, PNG, JPG, GIF, WebP');
        }
    },

    removeDropFile: function (index) {
        Doctor._droppedFiles.splice(index, 1);
        Doctor.renderDropFiles();
    },

    renderDropFiles: function () {
        var container = document.getElementById('chat-drop-files');
        if (!container) return;
        if (Doctor._droppedFiles.length === 0) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }
        container.style.display = 'flex';
        var html = '';
        for (var i = 0; i < Doctor._droppedFiles.length; i++) {
            var f = Doctor._droppedFiles[i];
            var icon = f.mediaType.indexOf('image/') === 0 ? '🖼️' : '📄';
            html += '<div class="chat-drop-file">' + icon + ' <span>' + UI.escapeHtml(f.name) + '</span>' +
                '<button onclick="Doctor.removeDropFile(' + i + ')" title="Удалить">✕</button></div>';
        }
        container.innerHTML = html;
    },

    getAnalysesContext: function () {
        var analyses = More.getAnalyses();
        if (analyses.length === 0) return '';

        var lines = ['Результаты анализов и обследований пациента:'];
        for (var i = 0; i < analyses.length; i++) {
            var a = analyses[i];
            var profile = a.profileId ? Storage.getProfileById(a.profileId) : null;
            var parts = ['— ' + a.name];
            if (a.date) parts.push('дата: ' + a.date);
            if (profile) parts.push('пациент: ' + profile.name);
            lines.push(parts.join(', '));
            if (a.result) {
                lines.push('  Результат: ' + a.result);
            }
            if (a.files && a.files.length > 0) {
                var fileNames = [];
                for (var j = 0; j < a.files.length; j++) {
                    fileNames.push(a.files[j].name);
                }
                lines.push('  Файлы: ' + fileNames.join(', '));
            }
        }
        return lines.join('\n');
    },

    askAboutAnalysis: function (id) {
        var analyses = More.getAnalyses();
        var analysis = null;
        for (var i = 0; i < analyses.length; i++) {
            if (analyses[i].id === id) { analysis = analyses[i]; break; }
        }
        if (!analysis) return;

        App.navigateTo('doctor');

        var pdfFiles = [];
        if (analysis.files && analysis.files.length > 0) {
            for (var j = 0; j < analysis.files.length; j++) {
                var f = analysis.files[j];
                if (f.data && f.data.indexOf('data:') === 0) {
                    var commaIdx = f.data.indexOf(',');
                    if (commaIdx > -1) {
                        var header = f.data.substring(0, commaIdx);
                        var base64 = f.data.substring(commaIdx + 1);
                        var mediaType = 'application/pdf';
                        var mtMatch = header.match(/data:([^;]+)/);
                        if (mtMatch) mediaType = mtMatch[1];
                        pdfFiles.push({ name: f.name, mediaType: mediaType, data: base64 });
                    }
                }
            }
        }
        Doctor._pendingFiles = pdfFiles.length > 0 ? pdfFiles : null;

        var question = 'Расшифруйте, пожалуйста, результаты анализа «' + analysis.name + '»';
        if (analysis.date) question += ' от ' + analysis.date;
        question += '.';
        if (analysis.result) {
            question += '\n\nРезультаты:\n' + analysis.result;
        }
        if (pdfFiles.length > 0) {
            question += '\n\nК сообщению прикреплено ' + pdfFiles.length + ' файл(ов) с результатами анализов. Расшифруйте каждый из них.';
        }

        var input = document.getElementById('chat-input');
        if (input) {
            input.value = question;
            input.focus();
        }
    },

    getProfileContext: function () {
        var profiles = Storage.getProfiles();
        if (profiles.length === 0) return '';

        var lines = ['Профили пациентов в семье:'];
        for (var i = 0; i < profiles.length; i++) {
            var p = profiles[i];
            var parts = ['— ' + p.name];
            if (p.birthDate) {
                var age = UI.calculateAge(p.birthDate);
                if (age !== null) parts.push(UI.pluralAge(age));
            }
            if (p.gender) parts.push(p.gender === 'male' ? 'мужчина' : 'женщина');
            if (p.chronicConditions) parts.push('хронические: ' + p.chronicConditions);
            if (p.medications) parts.push('лекарства: ' + p.medications);
            lines.push(parts.join(', '));
        }
        return lines.join('\n');
    },

    sendMessage: function () {
        if (Doctor.isLoading) return;

        var input = document.getElementById('chat-input');
        var text = input.value.trim();
        if (!text) return;

        input.value = '';
        Doctor.isLoading = true;

        var history = Doctor.getHistory();
        Doctor.addBubble('user', text);
        Doctor.showTyping();

        var apiHistory = [];
        for (var i = 0; i < history.length; i++) {
            apiHistory.push({ role: history[i].role, content: history[i].content });
        }

        var files = Doctor._pendingFiles || [];
        Doctor._pendingFiles = null;
        for (var d = 0; d < Doctor._droppedFiles.length; d++) {
            files.push(Doctor._droppedFiles[d]);
        }
        Doctor._droppedFiles = [];
        Doctor.renderDropFiles();

        var body = JSON.stringify({
            message: text,
            history: apiHistory,
            profileContext: Doctor.getProfileContext(),
            analysesContext: Doctor.getAnalysesContext(),
            files: files
        });

        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/chat', true);
        xhr.setRequestHeader('Content-Type', 'application/json');

        xhr.onload = function () {
            Doctor.hideTyping();
            Doctor.isLoading = false;

            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    var reply = data.reply || 'Не удалось получить ответ.';
                    Doctor.addBubble('assistant', reply);

                    history.push({ role: 'user', content: text });
                    history.push({ role: 'assistant', content: reply });
                    if (history.length > 40) {
                        history = history.slice(history.length - 40);
                    }
                    Doctor.saveHistory(history);
                } catch (e) {
                    Doctor.addBubble('assistant', 'Произошла ошибка при обработке ответа.');
                }
            } else {
                try {
                    var errData = JSON.parse(xhr.responseText);
                    Doctor.addBubble('assistant', 'Ошибка: ' + (errData.error || 'Неизвестная ошибка'));
                } catch (e) {
                    Doctor.addBubble('assistant', 'Ошибка подключения к серверу.');
                }
            }
        };

        xhr.onerror = function () {
            Doctor.hideTyping();
            Doctor.isLoading = false;
            Doctor.addBubble('assistant', 'Не удалось подключиться к серверу. Проверьте интернет-соединение.');
        };

        xhr.send(body);
    },

    addBubble: function (role, text) {
        var container = document.getElementById('chat-messages');
        var bubble = document.createElement('div');
        bubble.className = role === 'user' ? 'chat-bubble chat-bubble-user' : 'chat-bubble chat-bubble-bot';

        var formatted = UI.escapeHtml(text)
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        bubble.innerHTML = '<p>' + formatted + '</p>';

        if (role === 'assistant') {
            var btnWrap = document.createElement('div');
            btnWrap.className = 'chat-bubble-actions';
            var printBtn = document.createElement('button');
            printBtn.className = 'btn btn-outline btn-print';
            printBtn.innerHTML = '🖨️ Печать';
            printBtn.onclick = function () { Doctor.printReport(text); };
            var fileBtn = document.createElement('button');
            fileBtn.className = 'btn btn-outline btn-print';
            fileBtn.innerHTML = '💾 Файл';
            fileBtn.onclick = function () { Doctor.saveReportToFile(text); };
            btnWrap.appendChild(printBtn);
            btnWrap.appendChild(fileBtn);
            bubble.appendChild(btnWrap);
        }

        container.appendChild(bubble);
        container.scrollTop = container.scrollHeight;
    },

    printReport: function (text) {
        var profileCtx = Doctor.getProfileContext();
        var date = new Date().toLocaleDateString('ru-RU');

        var lines = text.split('\n');
        var htmlBody = '';
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.match(/^#{1,3}\s/)) {
                var level = line.match(/^(#{1,3})\s/)[1].length;
                var hText = UI.escapeHtml(line.replace(/^#{1,3}\s/, ''));
                htmlBody += '<h' + (level + 1) + '>' + hText + '</h' + (level + 1) + '>';
            } else if (line.indexOf('|') === 0 && line.lastIndexOf('|') > 0) {
                var cells = line.split('|').filter(function (c) { return c.trim() !== ''; });
                if (cells.length > 0 && cells[0].trim().match(/^[-:]+$/)) {
                    continue;
                }
                if (!htmlBody.match(/<table[^>]*>(?:(?!<\/table>)[\s\S])*$/)) {
                    htmlBody += '<table><tr>';
                } else {
                    htmlBody += '<tr>';
                }
                for (var c = 0; c < cells.length; c++) {
                    htmlBody += '<td>' + UI.escapeHtml(cells[c].trim()).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') + '</td>';
                }
                htmlBody += '</tr>';
                var nextLine = i + 1 < lines.length ? lines[i + 1] : '';
                if (nextLine.indexOf('|') !== 0) {
                    htmlBody += '</table>';
                }
            } else if (line.trim() === '---') {
                htmlBody += '<hr>';
            } else if (line.trim() === '') {
                htmlBody += '<br>';
            } else {
                var escaped = UI.escapeHtml(line)
                    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
                htmlBody += '<p>' + escaped + '</p>';
            }
        }

        var html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
            '<title>Отчёт — Мой домашний доктор</title>' +
            '<style>' +
            'body{font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:30px;color:#222;font-size:14px;line-height:1.6}' +
            '.header{text-align:center;border-bottom:2px solid #2563eb;padding-bottom:16px;margin-bottom:24px}' +
            '.header h1{color:#2563eb;margin:0;font-size:22px}' +
            '.header p{margin:4px 0;color:#666;font-size:13px}' +
            '.patient-info{background:#f0f7ff;padding:12px 16px;border-radius:8px;margin-bottom:20px;font-size:13px}' +
            'h2{color:#2563eb;font-size:17px;margin-top:20px}' +
            'h3{color:#1e40af;font-size:15px;margin-top:16px}' +
            'h4{color:#1e3a8a;font-size:14px;margin-top:12px}' +
            'table{width:100%;border-collapse:collapse;margin:12px 0}' +
            'td{border:1px solid #ccc;padding:6px 10px;font-size:13px}' +
            'tr:first-child td{background:#e8f0fe;font-weight:bold}' +
            'hr{border:none;border-top:1px solid #ddd;margin:16px 0}' +
            'p{margin:4px 0}' +
            '.footer{text-align:center;margin-top:30px;padding-top:16px;border-top:1px solid #ddd;color:#999;font-size:11px}' +
            '@media print{body{padding:15px}.header{padding-bottom:10px;margin-bottom:16px}}' +
            '</style></head><body>' +
            '<div class="header"><h1>🩺 Мой домашний доктор</h1><p>Отчёт от ' + date + '</p></div>' +
            (profileCtx ? '<div class="patient-info">' + UI.escapeHtml(profileCtx).replace(/\n/g, '<br>') + '</div>' : '') +
            htmlBody +
            '<div class="footer">Данный отчёт носит справочный характер и не является медицинским заключением.<br>Для постановки диагноза обратитесь к врачу.</div>' +
            '</body></html>';

        var w = window.open('', '_blank');
        w.document.write(html);
        w.document.close();
        w.print();
    },

    saveReportToFile: function (text) {
        var profileCtx = Doctor.getProfileContext();
        var date = new Date().toLocaleDateString('ru-RU');
        var dateFile = new Date().toISOString().slice(0, 10);

        var lines = text.split('\n');
        var htmlBody = '';
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.match(/^#{1,3}\s/)) {
                var level = line.match(/^(#{1,3})\s/)[1].length;
                var hText = UI.escapeHtml(line.replace(/^#{1,3}\s/, ''));
                htmlBody += '<h' + (level + 1) + '>' + hText + '</h' + (level + 1) + '>';
            } else if (line.indexOf('|') === 0 && line.lastIndexOf('|') > 0) {
                var cells = line.split('|').filter(function (c) { return c.trim() !== ''; });
                if (cells.length > 0 && cells[0].trim().match(/^[-:]+$/)) continue;
                if (!htmlBody.match(/<table[^>]*>(?:(?!<\/table>)[\s\S])*$/)) {
                    htmlBody += '<table><tr>';
                } else {
                    htmlBody += '<tr>';
                }
                for (var c = 0; c < cells.length; c++) {
                    htmlBody += '<td>' + UI.escapeHtml(cells[c].trim()).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') + '</td>';
                }
                htmlBody += '</tr>';
                var nextLine = i + 1 < lines.length ? lines[i + 1] : '';
                if (nextLine.indexOf('|') !== 0) htmlBody += '</table>';
            } else if (line.trim() === '---') {
                htmlBody += '<hr>';
            } else if (line.trim() === '') {
                htmlBody += '<br>';
            } else {
                htmlBody += '<p>' + UI.escapeHtml(line).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') + '</p>';
            }
        }

        var html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
            '<title>Отчёт — Мой домашний доктор</title>' +
            '<style>' +
            'body{font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:30px;color:#222;font-size:14px;line-height:1.6}' +
            '.header{text-align:center;border-bottom:2px solid #2563eb;padding-bottom:16px;margin-bottom:24px}' +
            '.header h1{color:#2563eb;margin:0;font-size:22px}' +
            '.header p{margin:4px 0;color:#666;font-size:13px}' +
            '.patient-info{background:#f0f7ff;padding:12px 16px;border-radius:8px;margin-bottom:20px;font-size:13px}' +
            'h2{color:#2563eb;font-size:17px;margin-top:20px}h3{color:#1e40af;font-size:15px}' +
            'table{width:100%;border-collapse:collapse;margin:12px 0}' +
            'td{border:1px solid #ccc;padding:6px 10px;font-size:13px}' +
            'tr:first-child td{background:#e8f0fe;font-weight:bold}' +
            'p{margin:4px 0}' +
            '.footer{text-align:center;margin-top:30px;padding-top:16px;border-top:1px solid #ddd;color:#999;font-size:11px}' +
            '</style></head><body>' +
            '<div class="header"><h1>🩺 Мой домашний доктор</h1><p>Отчёт от ' + date + '</p></div>' +
            (profileCtx ? '<div class="patient-info">' + UI.escapeHtml(profileCtx).replace(/\n/g, '<br>') + '</div>' : '') +
            htmlBody +
            '<div class="footer">Данный отчёт носит справочный характер и не является медицинским заключением.</div>' +
            '</body></html>';

        return UI.savePDF(html, 'doctor_report_' + dateFile + '.pdf');
    },

    showTyping: function () {
        var container = document.getElementById('chat-messages');
        var typing = document.createElement('div');
        typing.className = 'chat-bubble chat-bubble-bot chat-typing';
        typing.id = 'typing-indicator';
        typing.innerHTML = '<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>';
        container.appendChild(typing);
        container.scrollTop = container.scrollHeight;
    },

    hideTyping: function () {
        var el = document.getElementById('typing-indicator');
        if (el) el.remove();
    },

    renderHistory: function () {
        var container = document.getElementById('chat-messages');
        if (!container) return;

        container.innerHTML = '';

        var history = Doctor.getHistory();
        if (history.length === 0) {
            var welcome = document.createElement('div');
            welcome.className = 'chat-welcome';
            welcome.innerHTML =
                '<div class="chat-welcome-icon">🩺</div>' +
                '<h3>Здравствуйте!</h3>' +
                '<p>Я — ваш Домашний доктор, персональный медицинский консультант. ' +
                'Помогу разобраться в симптомах, расшифровать анализы, ' +
                'подскажу, к какому врачу обратиться, и дам рекомендации по здоровому образу жизни.</p>' +
                '<p class="chat-welcome-hint">Опишите, что вас беспокоит, или просто поздоровайтесь.</p>';
            container.appendChild(welcome);
            return;
        }

        for (var i = 0; i < history.length; i++) {
            Doctor.addBubble(history[i].role, history[i].content);
        }
    }
};
