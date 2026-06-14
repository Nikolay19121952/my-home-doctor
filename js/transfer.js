var Transfer = {
    init: function () {
        document.getElementById('btn-export-data').addEventListener('click', function () {
            Transfer.exportData();
        });
        document.getElementById('btn-import-data').addEventListener('click', function () {
            document.getElementById('import-file-input').click();
        });
        document.getElementById('import-file-input').addEventListener('change', function (e) {
            Transfer.importData(e);
        });
    },

    exportData: function () {
        var progressEl = document.getElementById('import-progress');
        progressEl.style.display = 'block';
        progressEl.textContent = 'Подготовка данных...';

        var data = {
            version: 1,
            exportedAt: new Date().toISOString(),
            profiles: Storage.getProfiles(),
            diary: JSON.parse(localStorage.getItem('mdd_diary') || '[]'),
            analyses: JSON.parse(localStorage.getItem('mdd_analyses') || '[]'),
            reminders: JSON.parse(localStorage.getItem('mdd_reminders') || '[]'),
            images: []
        };

        var allImageIds = [];
        for (var i = 0; i < data.analyses.length; i++) {
            var a = data.analyses[i];
            if (a.imageIds) {
                for (var j = 0; j < a.imageIds.length; j++) {
                    allImageIds.push(a.imageIds[j]);
                }
            }
        }

        if (allImageIds.length === 0) {
            Transfer._downloadJson(data);
            progressEl.style.display = 'none';
            return;
        }

        progressEl.textContent = 'Экспорт файлов (0/' + allImageIds.length + ')...';
        var completed = 0;
        var total = allImageIds.length;

        for (var k = 0; k < allImageIds.length; k++) {
            (function (imgId) {
                DB.getImage(imgId, function (record) {
                    if (record && record.blob) {
                        var reader = new FileReader();
                        reader.onload = function () {
                            data.images.push({
                                id: record.id,
                                mimeType: record.mimeType || 'image/jpeg',
                                fileName: record.fileName || 'file',
                                size: record.size,
                                createdAt: record.createdAt,
                                dataUrl: reader.result
                            });
                            completed++;
                            progressEl.textContent = 'Экспорт файлов (' + completed + '/' + total + ')...';
                            if (completed === total) {
                                Transfer._downloadJson(data);
                                progressEl.style.display = 'none';
                            }
                        };
                        reader.readAsDataURL(record.blob);
                    } else {
                        completed++;
                        progressEl.textContent = 'Экспорт файлов (' + completed + '/' + total + ')...';
                        if (completed === total) {
                            Transfer._downloadJson(data);
                            progressEl.style.display = 'none';
                        }
                    }
                });
            })(allImageIds[k]);
        }
    },

    _downloadJson: function (data) {
        var json = JSON.stringify(data);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        var date = new Date();
        var dd = date.getDate().toString();
        if (dd.length < 2) dd = '0' + dd;
        var mm = (date.getMonth() + 1).toString();
        if (mm.length < 2) mm = '0' + mm;
        var filename = 'mdd-backup-' + date.getFullYear() + '-' + mm + '-' + dd + '.json';
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        UI.showToast('Данные экспортированы');
    },

    importData: function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        e.target.value = '';

        var progressEl = document.getElementById('import-progress');
        progressEl.style.display = 'block';
        progressEl.textContent = 'Чтение файла...';

        var reader = new FileReader();
        reader.onload = function () {
            var data;
            try {
                data = JSON.parse(reader.result);
            } catch (err) {
                progressEl.style.display = 'none';
                UI.showToast('Ошибка: неверный формат файла');
                return;
            }

            if (!data.version || !data.profiles) {
                progressEl.style.display = 'none';
                UI.showToast('Ошибка: это не файл экспорта');
                return;
            }

            UI.showConfirm(
                'Импорт данных',
                'Текущие данные будут заменены данными из файла. Продолжить?',
                'Импортировать',
                function () {
                    Transfer._applyImport(data, progressEl);
                }
            );
            progressEl.style.display = 'none';
        };
        reader.readAsText(file);
    },

    _applyImport: function (data, progressEl) {
        progressEl.style.display = 'block';
        progressEl.textContent = 'Импорт данных...';

        localStorage.setItem('mdd_profiles', JSON.stringify(data.profiles || []));
        localStorage.setItem('mdd_diary', JSON.stringify(data.diary || []));
        localStorage.setItem('mdd_analyses', JSON.stringify(data.analyses || []));
        localStorage.setItem('mdd_reminders', JSON.stringify(data.reminders || []));

        if (!data.images || data.images.length === 0) {
            progressEl.style.display = 'none';
            UI.showToast('Данные импортированы');
            App.navigateTo('home');
            return;
        }

        progressEl.textContent = 'Импорт файлов (0/' + data.images.length + ')...';
        var saved = 0;
        var total = data.images.length;

        for (var i = 0; i < data.images.length; i++) {
            (function (img) {
                Transfer._dataUrlToBlob(img.dataUrl, function (blob) {
                    if (!blob) {
                        saved++;
                        if (saved === total) Transfer._finishImport(progressEl);
                        return;
                    }
                    var record = {
                        id: img.id,
                        blob: blob,
                        mimeType: img.mimeType || blob.type || 'image/jpeg',
                        fileName: img.fileName || 'file',
                        size: blob.size,
                        createdAt: img.createdAt || new Date().toISOString()
                    };
                    var tx = DB._db.transaction('images', 'readwrite');
                    var store = tx.objectStore('images');
                    store.put(record);
                    tx.oncomplete = function () {
                        saved++;
                        progressEl.textContent = 'Импорт файлов (' + saved + '/' + total + ')...';
                        if (saved === total) Transfer._finishImport(progressEl);
                    };
                    tx.onerror = function () {
                        saved++;
                        if (saved === total) Transfer._finishImport(progressEl);
                    };
                });
            })(data.images[i]);
        }
    },

    _finishImport: function (progressEl) {
        progressEl.style.display = 'none';
        UI.showToast('Данные импортированы');
        App.navigateTo('home');
    },

    _dataUrlToBlob: function (dataUrl, callback) {
        try {
            var parts = dataUrl.split(',');
            var mime = parts[0].match(/:(.*?);/)[1];
            var raw = atob(parts[1]);
            var arr = new Uint8Array(raw.length);
            for (var i = 0; i < raw.length; i++) {
                arr[i] = raw.charCodeAt(i);
            }
            callback(new Blob([arr], { type: mime }));
        } catch (e) {
            callback(null);
        }
    }
};
