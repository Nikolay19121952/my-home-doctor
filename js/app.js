var App = {
    currentPage: 'home',

    init: function () {
        App.initNavigation();
        Profiles.init();
        Profiles.renderList();
        App.initQuickActions();
        App.registerServiceWorker();

        var saved = sessionStorage.getItem('mdd_current_page');
        if (saved) {
            App.navigateTo(saved);
        }
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

        var navTargets = ['home', 'profiles', 'diary', 'more'];
        var navPage = pageId;
        if (pageId === 'profile-form' || pageId === 'profile-view') {
            navPage = 'profiles';
        }

        var navBtns = document.querySelectorAll('.nav-btn');
        for (var j = 0; j < navBtns.length; j++) {
            navBtns[j].classList.remove('nav-btn-active');
            if (navBtns[j].getAttribute('data-target') === navPage) {
                navBtns[j].classList.add('nav-btn-active');
            }
        }

        window.scrollTo(0, 0);

        if (pageId === 'profiles') {
            Profiles.renderList();
        }
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

    registerServiceWorker: function () {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').catch(function () {});
        }
    }
};

document.addEventListener('DOMContentLoaded', function () {
    App.init();
});
