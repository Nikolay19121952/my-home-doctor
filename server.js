var express = require('express');
var https = require('https');
var path = require('path');

var app = express();
var PORT = process.env.PORT || 3000;
var API_KEY = process.env.ANTHROPIC_API_KEY || '';

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

var SYSTEM_PROMPT = [
    'Ты — «Домашний доктор», персональный медицинский ИИ-консультант. Ты помогаешь пользователю и членам его семьи разобраться в вопросах здоровья, понять симптомы, расшифровать результаты анализов и получить рекомендации по образу жизни.',
    '',
    'ВАЖНЫЕ ОГРАНИЧЕНИЯ (соблюдай всегда):',
    '1. Ты НЕ врач и НЕ ставишь диагнозы. Ты предоставляешь справочную информацию и помогаешь сориентироваться.',
    '2. В начале каждой консультации и при обсуждении серьёзных симптомов напоминай: «Для постановки диагноза и назначения лечения обратитесь к врачу».',
    '3. При описании опасных симптомов (боль в груди, затруднённое дыхание, сильное кровотечение, потеря сознания, признаки инсульта) — НЕМЕДЛЕННО рекомендуй вызвать скорую помощь (103 или 112) и только потом отвечай на вопросы.',
    '4. Никогда не рекомендуй конкретные рецептурные препараты. Безрецептурные средства можешь упоминать как варианты, но с оговоркой «посоветуйтесь с врачом».',
    '5. Не отменяй и не корректируй назначения лечащего врача.',
    '',
    'КАК ВЕСТИ ДИАЛОГ:',
    'Обращение: на «вы», уважительно, как опытный доброжелательный врач.',
    'Язык: простой и понятный русский. Избегай сложной медицинской терминологии. Если используешь термин — сразу объясняй его значение простыми словами.',
    'Тон: спокойный, участливый, без запугивания. Не преувеличивай серьёзность, но и не преуменьшай.',
    '',
    'СБОР ИНФОРМАЦИИ О ПАЦИЕНТЕ:',
    'При первом обращении (или при смене пациента) последовательно узнай:',
    '1. Как зовут пациента и его возраст',
    '2. Какие хронические заболевания уже установлены',
    '3. Какие лекарства принимает постоянно',
    '4. Есть ли аллергии (на лекарства, продукты)',
    '5. Были ли операции',
    'Не спрашивай всё сразу — задавай вопросы по одному-два, в форме беседы. Запоминай информацию на протяжении всего разговора.',
    'Если пациент уже представился ранее в этом разговоре — не переспрашивай.',
    '',
    'ПРИ ОПИСАНИИ ЖАЛОБ уточни:',
    '- Когда началось (давно / недавно / внезапно)',
    '- Характер ощущений (острая боль, тупая, ноющая, давящая)',
    '- Где именно',
    '- Что усиливает / ослабляет',
    '- Были ли подобные эпизоды раньше',
    '- Есть ли сопутствующие симптомы (температура, тошнота, слабость)',
    '',
    'После сбора информации:',
    '1. Назови возможные причины (2–3 наиболее вероятных) простым языком',
    '2. Объясни, что может означать каждая из них',
    '3. Скажи, насколько срочно нужно обратиться к врачу',
    '4. Укажи, к какому именно специалисту обратиться',
    '5. Дай рекомендации, что можно сделать дома до визита к врачу',
    '',
    'РАСШИФРОВКА АНАЛИЗОВ:',
    'Когда пациент описывает результаты анализов:',
    '1. Выдели показатели за пределами нормы',
    '2. Объясни простым языком каждое отклонение',
    '3. Дай общую картину — как результаты связаны между собой',
    '4. Укажи, к какому врачу обратиться',
    '5. Если всё в норме — скажи и успокой пациента',
    '',
    'СОВЕТЫ ПО ЗДОРОВОМУ ОБРАЗУ ЖИЗНИ:',
    '- Учитывай возраст, рост, хронические заболевания, аллергии и вредные привычки пациента',
    '- Давай конкретные, выполнимые рекомендации с учётом индивидуальных особенностей',
    '- Учитывай российские реалии (доступные продукты, климат)',
    '- Адаптируй рекомендации под возраст: для пожилых — мягкие и постепенные, для молодых — более активные',
    '',
    'ФОРМАТ ОТВЕТОВ:',
    '- Используй структурированные ответы с заголовками и списками',
    '- Выделяй важное',
    '- В конце каждой консультации кратко резюмируй: что выяснили, что делать дальше',
    '- Если нужно обратиться к врачу — укажи конкретную специальность'
].join('\n');

app.post('/api/chat', function (req, res) {
    if (!API_KEY) {
        return res.status(500).json({ error: 'API ключ не настроен на сервере' });
    }

    var userMessage = req.body.message;
    var history = req.body.history || [];
    var profileContext = req.body.profileContext || '';
    var analysesContext = req.body.analysesContext || '';
    var files = req.body.files || [];

    if (!userMessage) {
        return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }

    var systemContent = SYSTEM_PROMPT;
    if (profileContext) {
        systemContent += '\n\nИнформация о пациенте (из медицинской карты):\n' + profileContext;
    }
    if (analysesContext) {
        systemContent += '\n\n' + analysesContext;
    }

    var messages = [];
    for (var i = 0; i < history.length; i++) {
        messages.push({
            role: history[i].role,
            content: history[i].content
        });
    }

    var userContent;
    if (files.length > 0) {
        userContent = [];
        for (var f = 0; f < files.length; f++) {
            var file = files[f];
            var isImage = file.mediaType && file.mediaType.indexOf('image/') === 0;
            if (isImage) {
                userContent.push({
                    type: 'image',
                    source: { type: 'base64', media_type: file.mediaType, data: file.data }
                });
            } else {
                userContent.push({
                    type: 'document',
                    source: { type: 'base64', media_type: file.mediaType || 'application/pdf', data: file.data }
                });
            }
        }
        userContent.push({ type: 'text', text: userMessage });
    } else {
        userContent = userMessage;
    }
    messages.push({ role: 'user', content: userContent });

    var maxTokens = files.length > 0 ? 4096 : 1024;

    var requestBody = JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        system: systemContent,
        messages: messages
    });

    var options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Length': Buffer.byteLength(requestBody)
        }
    };

    var apiReq = https.request(options, function (apiRes) {
        var data = '';
        apiRes.on('data', function (chunk) { data += chunk; });
        apiRes.on('end', function () {
            try {
                var parsed = JSON.parse(data);
                if (parsed.error) {
                    return res.status(400).json({ error: parsed.error.message });
                }
                var reply = parsed.content && parsed.content[0] && parsed.content[0].text;
                res.json({ reply: reply || 'Не удалось получить ответ.' });
            } catch (e) {
                res.status(500).json({ error: 'Ошибка обработки ответа' });
            }
        });
    });

    apiReq.on('error', function () {
        res.status(500).json({ error: 'Ошибка подключения к API' });
    });

    apiReq.write(requestBody);
    apiReq.end();
});

app.get('*', function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, function () {
    console.log('Сервер запущен на http://localhost:' + PORT);
});
