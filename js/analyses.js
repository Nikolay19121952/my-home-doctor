var Analyses = {
    editingId: null,
    _pendingImages: [],
    _objectUrls: [],

    init: function () {
        document.getElementById('btn-add-analysis').addEventListener('click', function () {
            Analyses.openForm(null);
        });
        document.getElementById('btn-add-analysis-empty').addEventListener('click', function () {
            Analyses.openForm(null);
        });
        document.getElementById('btn-back-analysis-form').addEventListener('click', function () {
            Analyses._cleanup();
            App.navigateTo('analyses');
        });
        document.getElementById('btn-cancel-analysis').addEventListener('click', function () {
            Analyses._cleanup();
            App.navigateTo('analyses');
        });
        document.getElementById('btn-back-analysis-view').addEventListener('click', function () {
            Analyses._cleanup();
            App.navigateTo('analyses');
        });
        document.getElementById('btn-edit-analysis').addEventListener('click', function () {
            if (Analyses._viewingId) Analyses.openForm(Analyses._viewingId);
        });
        document.getElementById('btn-delete-analysis').addEventListener('click', function () {
            Analyses.confirmDelete();
        });
        document.getElementById('form-analysis').addEventListener('submit', function (e) {
            e.preventDefault();
            Analyses.saveForm();
        });

        document.getElementById('analysis-photo-btn').addEventListener('click', function () {
            document.getElementById('analysis-camera-input').click();
        });
        document.getElementById('analysis-file-btn').addEventListener('click', function () {
            document.getElementById('analysis-file-input').click();
        });
        document.getElementById('analysis-camera-input').addEventListener('change', function (e) {
            Analyses.handleImageUpload(e);
        });
        document.getElementById('analysis-file-input').addEventListener('change', function (e) {
            Analyses.handleImageUpload(e);
        });

        document.getElementById('image-fullview-overlay').addEventListener('click', function () {
            this.style.display = 'none';
        });
    },

    onNavigate: function () {
        var profileId = UI.renderProfileSelector('analyses-profile-selector', function (id) {
            Analyses.renderList(id);
        });
        if (profileId) Analyses.renderList(profileId);
    },

    renderList: function (profileId) {
        profileId = profileId || UI.getSelectedProfileId();
        if (!profileId) return;

        var items = Storage.getAnalysesByProfile(profileId);
        var listEl = document.getElementById('analyses-list');
        var emptyEl = document.getElementById('analyses-empty');

        if (items.length === 0) {
            listEl.innerHTML = '';
            emptyEl.style.display = 'block';
            return;
        }

        emptyEl.style.display = 'none';
        var html = '';
        for (var i = 0; i < items.length; i++) {
            var a = items[i];
            html += '<div class="analysis-card" data-id="' + UI.escapeHtml(a.id) + '" tabindex="0">';
            html += '<div class="analysis-card-header">';
            html += '<span class="analysis-type-badge">' + UI.escapeHtml(a.type || 'Другое') + '</span>';
            html += '<span class="analysis-card-date">' + UI.formatDate(a.date) + '</span>';
            html += '</div>';
            html += '<div class="analysis-card-title">' + UI.escapeHtml(a.title || a.type || 'Без названия') + '</div>';
            if (a.clinic) {
                html += '<div class="analysis-card-clinic">' + UI.escapeHtml(a.clinic) + '</div>';
            }
            if (a.imageIds && a.imageIds.length > 0) {
                var fileWord = a.imageIds.length === 1 ? 'файл' : (a.imageIds.length < 5 ? 'файла' : 'файлов');
                html += '<div class="analysis-card-photos">📎 ' + a.imageIds.length + ' ' + fileWord + '</div>';
            }
            html += '</div>';
        }
        listEl.innerHTML = html;

        var cards = listEl.querySelectorAll('.analysis-card');
        for (var j = 0; j < cards.length; j++) {
            cards[j].addEventListener('click', function () {
                Analyses.openView(this.getAttribute('data-id'));
            });
        }
    },

    openView: function (id) {
        var analysis = Storage.getAnalysisById(id);
        if (!analysis) return;

        Analyses._viewingId = id;
        document.getElementById('analysis-view-title').textContent = analysis.title || analysis.type || 'Анализ';

        var content = document.getElementById('analysis-view-content');
        var html = '';
        html += '<div class="view-field"><div class="view-label">Тип</div><div class="view-value">' + UI.escapeHtml(analysis.type || 'Не указан') + '</div></div>';
        html += '<div class="view-field"><div class="view-label">Дата</div><div class="view-value">' + (analysis.date ? UI.formatDate(analysis.date) : 'Не указана') + '</div></div>';
        if (analysis.clinic) {
            html += '<div class="view-field"><div class="view-label">Клиника</div><div class="view-value">' + UI.escapeHtml(analysis.clinic) + '</div></div>';
        }
        if (analysis.notes) {
            html += '<div class="view-field"><div class="view-label">Заметки</div><div class="view-value">' + UI.escapeHtml(analysis.notes) + '</div></div>';
        }

        content.innerHTML = html;

        var gallery = document.getElementById('analysis-view-gallery');
        gallery.innerHTML = '';
        if (analysis.imageIds && analysis.imageIds.length > 0) {
            gallery.innerHTML = '<div class="view-label" style="margin-bottom:8px">Файлы</div><div class="image-preview-grid" id="view-gallery-grid"></div>';
            var grid = document.getElementById('view-gallery-grid');
            for (var i = 0; i < analysis.imageIds.length; i++) {
                (function (imgId) {
                    DB.getImage(imgId, function (record) {
                        if (!record) return;
                        var div = document.createElement('div');
                        div.className = 'image-preview-item';

                        if (Analyses._isPdf(record)) {
                            var name = record.fileName || 'document.pdf';
                            if (name.length > 20) name = name.substring(0, 17) + '...';
                            div.innerHTML = '<div class="pdf-preview"><span class="pdf-icon">📄</span><span class="pdf-label">' + UI.escapeHtml(name) + '</span></div>';
                            div.addEventListener('click', function () {
                                Analyses.openPdf(record);
                            });
                        } else {
                            var url = URL.createObjectURL(record.blob);
                            Analyses._objectUrls.push(url);
                            div.innerHTML = '<img src="' + url + '" alt="Фото анализа">';
                            div.addEventListener('click', function () {
                                Analyses.showFullImage(url);
                            });
                        }

                        grid.appendChild(div);
                    });
                })(analysis.imageIds[i]);
            }
        }

        App.navigateTo('analysis-view');
    },

    showFullImage: function (url) {
        var overlay = document.getElementById('image-fullview-overlay');
        document.getElementById('image-fullview-img').src = url;
        overlay.style.display = 'flex';
    },

    openPdf: function (record) {
        var url = URL.createObjectURL(record.blob);
        Analyses._objectUrls.push(url);
        var a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.download = record.fileName || 'document.pdf';
        a.click();
    },

    openForm: function (id) {
        Analyses.editingId = id;
        Analyses._pendingImages = [];
        Analyses._cleanup();
        var form = document.getElementById('form-analysis');
        form.reset();
        document.getElementById('analysis-date').value = UI.getTodayISO();
        document.getElementById('analysis-preview-grid').innerHTML = '';

        if (id) {
            var analysis = Storage.getAnalysisById(id);
            if (!analysis) return;
            document.getElementById('analysis-form-title').textContent = 'Редактирование';
            document.getElementById('analysis-date').value = analysis.date || '';
            document.getElementById('analysis-type').value = analysis.type || '';
            document.getElementById('analysis-title').value = analysis.title || '';
            document.getElementById('analysis-clinic').value = analysis.clinic || '';
            document.getElementById('analysis-notes-field').value = analysis.notes || '';
            document.getElementById('delete-analysis-section').style.display = 'block';

            if (analysis.imageIds) {
                Analyses._pendingImages = analysis.imageIds.slice();
                Analyses._renderPreviews();
            }
        } else {
            document.getElementById('analysis-form-title').textContent = 'Новый анализ';
            document.getElementById('delete-analysis-section').style.display = 'none';
        }

        App.navigateTo('analysis-form');
    },

    handleImageUpload: function (e) {
        var files = e.target.files;
        if (!files || files.length === 0) return;

        for (var i = 0; i < files.length; i++) {
            (function (file) {
                var isPdf = file.type === 'application/pdf' || file.name.toLowerCase().indexOf('.pdf') !== -1;
                if (isPdf) {
                    DB.saveImage(file, file.name, function (id) {
                        if (id) {
                            Analyses._pendingImages.push(id);
                            Analyses._renderPreviews();
                        }
                    });
                } else {
                    DB.resizeImage(file, 1600, 0.8, function (blob) {
                        DB.saveImage(blob, file.name, function (id) {
                            if (id) {
                                Analyses._pendingImages.push(id);
                                Analyses._renderPreviews();
                            }
                        });
                    });
                }
            })(files[i]);
        }
        e.target.value = '';
    },

    _isPdf: function (record) {
        if (!record) return false;
        if (record.mimeType === 'application/pdf') return true;
        if (record.fileName && record.fileName.toLowerCase().indexOf('.pdf') !== -1) return true;
        return false;
    },

    _renderPreviews: function () {
        var grid = document.getElementById('analysis-preview-grid');
        grid.innerHTML = '';
        for (var i = 0; i < Analyses._pendingImages.length; i++) {
            (function (imgId, idx) {
                DB.getImage(imgId, function (record) {
                    if (!record) return;
                    var div = document.createElement('div');
                    div.className = 'image-preview-item';

                    if (Analyses._isPdf(record)) {
                        var name = record.fileName || 'document.pdf';
                        if (name.length > 20) name = name.substring(0, 17) + '...';
                        div.innerHTML = '<div class="pdf-preview"><span class="pdf-icon">📄</span><span class="pdf-label">' + UI.escapeHtml(name) + '</span></div>' +
                            '<button type="button" class="image-remove-btn" data-idx="' + idx + '">✕</button>';
                    } else {
                        var url = URL.createObjectURL(record.blob);
                        Analyses._objectUrls.push(url);
                        div.innerHTML = '<img src="' + url + '" alt="Превью">' +
                            '<button type="button" class="image-remove-btn" data-idx="' + idx + '">✕</button>';
                    }

                    div.querySelector('.image-remove-btn').addEventListener('click', function (e) {
                        e.stopPropagation();
                        var removeIdx = parseInt(this.getAttribute('data-idx'));
                        var removedId = Analyses._pendingImages[removeIdx];
                        Analyses._pendingImages.splice(removeIdx, 1);
                        if (!Analyses.editingId) {
                            DB.deleteImage(removedId);
                        }
                        Analyses._renderPreviews();
                    });
                    grid.appendChild(div);
                });
            })(Analyses._pendingImages[i], i);
        }
    },

    saveForm: function () {
        var profileId = UI.getSelectedProfileId();
        if (!profileId) {
            UI.showToast('Сначала выберите пациента');
            return;
        }

        var type = document.getElementById('analysis-type').value;
        if (!type) {
            UI.showToast('Укажите тип анализа');
            return;
        }

        var data = {
            profileId: profileId,
            date: document.getElementById('analysis-date').value || UI.getTodayISO(),
            type: type,
            title: document.getElementById('analysis-title').value.trim(),
            clinic: document.getElementById('analysis-clinic').value.trim(),
            notes: document.getElementById('analysis-notes-field').value.trim(),
            imageIds: Analyses._pendingImages.slice()
        };

        if (Analyses.editingId) {
            var old = Storage.getAnalysisById(Analyses.editingId);
            if (old && old.imageIds) {
                for (var i = 0; i < old.imageIds.length; i++) {
                    if (data.imageIds.indexOf(old.imageIds[i]) === -1) {
                        DB.deleteImage(old.imageIds[i]);
                    }
                }
            }
            Storage.updateAnalysis(Analyses.editingId, data);
            UI.showToast('Анализ обновлён');
        } else {
            Storage.addAnalysis(data);
            UI.showToast('Анализ добавлен');
        }

        Analyses.editingId = null;
        Analyses._pendingImages = [];
        App.navigateTo('analyses');
    },

    confirmDelete: function () {
        if (!Analyses.editingId) return;
        UI.showConfirm(
            'Удалить анализ?',
            'Анализ и все прикреплённые фотографии будут удалены.',
            'Удалить',
            function () {
                Storage.deleteAnalysis(Analyses.editingId);
                Analyses.editingId = null;
                Analyses._pendingImages = [];
                App.navigateTo('analyses');
                UI.showToast('Анализ удалён');
            }
        );
    },

    _cleanup: function () {
        for (var i = 0; i < Analyses._objectUrls.length; i++) {
            URL.revokeObjectURL(Analyses._objectUrls[i]);
        }
        Analyses._objectUrls = [];
    },

    _viewingId: null
};
