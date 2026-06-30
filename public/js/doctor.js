var Doctor = {
    HISTORY_KEY: 'mdd_chat_history',
    isLoading: false,

    init: function () {
        var sendBtn = document.getElementById('btn-send-message');
        var input = document.getElementById('chat-input');
        var clearBtn = document.getElementById('btn-clear-chat');

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

        var question = 'Расшифруйте, пожалуйста, результаты анализа «' + analysis.name + '»';
        if (analysis.date) question += ' от ' + analysis.date;
        question += '.';
        if (analysis.result) {
            question += '\n\nРезультаты:\n' + analysis.result;
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

        var body = JSON.stringify({
            message: text,
            history: apiHistory,
            profileContext: Doctor.getProfileContext(),
            analysesContext: Doctor.getAnalysesContext()
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

        container.appendChild(bubble);
        container.scrollTop = container.scrollHeight;
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
