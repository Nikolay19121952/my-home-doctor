var App = {
    currentPage: 'home',

    init: function () {
        App.initNavigation();
        Profiles.init();
        Profiles.renderList();
        App.initQuickActions();
        App.initMoreItems();

        DB.open(function () {
            Diary.init();
            Analyses.init();
            Reminders.init();
            Reminders.startChecker();
            Reminders.requestNotificationPermission();

            var saved = sessionStorage.getItem('mdd_current_page');
            if (saved) {
                App.navigateTo(saved);
            } else {
                App.renderHomeSummary();
            }
        });

        App.registerServiceWorker();
    },

    navigateTo: function (pageId) {
        var pages = document.querySelectorAll('.page');
        for (var i = 0; i < pages.length; i++) {
            pages[i].classList.remove('page-active');
        }

        var target = document.getElementById(pageId);
        if (target) {
            target.classList.add('page-active');
        }

        App.currentPage = pageId;
        sessionStorage.setItem('mdd_current_page', pageId);

        var navPage = pageId;
        if (pageId === 'profile-form' || pageId === 'profile-view') {
            navPage = 'profiles';
        } else if (pageId === 'diary-form') {
            navPage = 'diary';
        } else if (pageId === 'analyses' || pageId === 'analysis-form' || pageId === 'analysis-view') {
            navPage = 'more';
        } else if (pageId === 'reminders' || pageId === 'reminder-form') {
            navPage = 'more';
        }

        var navBtns = document.querySelectorAll('.nav-btn');
        for (var j = 0; j < navBtns.length; j++) {
            navBtns[j].classList.remove('nav-btn-active');
            if (navBtns[j].getAttribute('data-target') === navPage) {
                navBtns[j].classList.add('nav-btn-active');
            }
        }

        window.scrollTo(0, 0);

        if (pageId === 'home') App.renderHomeSummary();
        if (pageId === 'profiles') Profiles.renderList();
        if (pageId === 'diary') Diary.onNavigate();
        if (pageId === 'analyses') Analyses.onNavigate();
        if (pageId === 'reminders') Reminders.onNavigate();
    },

    initNavigation: function () {
        var navBtns = document.querySelectorAll('.nav-btn');
        for (var i = 0; i < navBtns.length; i++) {
            navBtns[i].addEventListener('click', function () {
                var target = this.getAttribute('data-target');
                App.navigateTo(target);
            });
        }
    },

    initQuickActions: function () {
        var actions = document.querySelectorAll('.action-card[data-navigate]');
        for (var i = 0; i < actions.length; i++) {
            actions[i].addEventListener('click', function () {
                var target = this.getAttribute('data-navigate');
                App.navigateTo(target);
            });
        }
    },

    initMoreItems: function () {
        var items = document.querySelectorAll('.more-item[data-navigate]');
        for (var i = 0; i < items.length; i++) {
            items[i].addEventListener('click', function () {
                var target = this.getAttribute('data-navigate');
                App.navigateTo(target);
            });
        }
    },

    renderHomeSummary: function () {
        var el = document.getElementById('home-summary');
        if (!el) return;

        var profiles = Storage.getProfiles();
        if (profiles.length === 0) {
            el.innerHTML = '';
            return;
        }

        var activeReminders = Storage.getActiveReminders();
        var todayISO = UI.getTodayISO();
        var todayReminders = [];
        for (var i = 0; i < activeReminders.length; i++) {
            if (activeReminders[i].date <= todayISO) {
                todayReminders.push(activeReminders[i]);
            }
        }

        var html = '';
        if (todayReminders.length > 0) {
            html += '<div class="home-section">';
            html += '<h3 class="home-section-title">Сегодня</h3>';
            for (var j = 0; j < todayReminders.length && j < 5; j++) {
                var r = todayReminders[j];
                var typeIcons = { medication: '💊', appointment: '👨‍⚕️', test: '🔬' };
                html += '<div class="home-reminder-item">';
                html += '<span>' + (typeIcons[r.type] || '🔔') + '</span> ';
                html += '<span>' + UI.escapeHtml(r.title) + '</span>';
                if (r.time) html += ' <span class="home-reminder-time">в ' + r.time + '</span>';
                html += '</div>';
            }
            html += '</div>';
        }

        html += '<div class="home-section">';
        html += '<h3 class="home-section-title">Статистика</h3>';
        html += '<div class="home-stats">';
        html += '<div class="home-stat"><span class="home-stat-num">' + profiles.length + '</span><span class="home-stat-label">Профилей</span></div>';

        var totalDiary = 0;
        var totalAnalyses = 0;
        for (var k = 0; k < profiles.length; k++) {
            totalDiary += Storage.getDiaryByProfile(profiles[k].id).length;
            totalAnalyses += Storage.getAnalysesByProfile(profiles[k].id).length;
        }
        html += '<div class="home-stat"><span class="home-stat-num">' + totalDiary + '</span><span class="home-stat-label">Записей</span></div>';
        html += '<div class="home-stat"><span class="home-stat-num">' + totalAnalyses + '</span><span class="home-stat-label">Анализов</span></div>';
        html += '</div></div>';

        el.innerHTML = html;
    },

    registerServiceWorker: function () {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').catch(function () {});
        }
    }
};

document.addEventListener('DOMContentLoaded', function () {
    App.init();
});
