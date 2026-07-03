const UI = {
    showToast(message, duration) {
        duration = duration || 2000;
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.style.display = 'block';
        clearTimeout(UI._toastTimer);
        UI._toastTimer = setTimeout(function () {
            toast.style.display = 'none';
        }, duration);
    },

    showConfirm(title, message, confirmText, onConfirm) {
        const overlay = document.getElementById('modal-overlay');
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-message').textContent = message;
        document.getElementById('modal-confirm').textContent = confirmText;
        overlay.style.display = 'flex';

        const confirmBtn = document.getElementById('modal-confirm');
        const cancelBtn = document.getElementById('modal-cancel');

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

    formatDate(isoString) {
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

    calculateAge(birthDateString) {
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

    escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    pluralAge(age) {
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

    _toastTimer: null,

    savePDF: function (htmlContent, filename) {
        var container = document.createElement('div');
        container.innerHTML = htmlContent;
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = '700px';
        document.body.appendChild(container);

        var opt = {
            margin: [10, 10, 10, 10],
            filename: filename,
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(container).save().then(function () {
            document.body.removeChild(container);
            UI.showToast('PDF сохранён');
        }).catch(function () {
            document.body.removeChild(container);
            UI.showToast('Ошибка сохранения PDF');
        });
    }
};
