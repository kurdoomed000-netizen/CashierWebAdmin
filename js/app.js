// -------------------- App Shell + Router --------------------

const App = {
    async init() {
        // باتچی وەرگێڕان — یەکەم شت، پێش هەموو شتێکی تر، تاوەکو دەقی
        // چوونەژوورەوە/تۆمارکردن لە دەستپێکەوە بە زمانی هەڵبژێردراوی
        // پێشوو دەربکەوێت (ئەگەر پێشتر هەڵبژێردرابوو).
        I18n.init();
        I18n.applyStaticTranslations();
        document.querySelectorAll('.lang-switcher').forEach(sel => {
            sel.addEventListener('change', () => {
                I18n.setLanguage(sel.value);
                // ئەگەر ئاپەکە کراوەیە (چوونەژوورەوە کراوە)، خشتەی
                // ناڤیگەیشن و badge ی ئاگادارکردنەوەکان و ناوی
                // ڕۆڵی بەکارهێنەر پێویستە بە زمانی نوێ نوێبکرێنەوە.
                if (Api.isLoggedIn()) {
                    document.getElementById('currentUserLabel').textContent =
                        Api.getUsername() + ' (' + this.roleLabel(Api.getRole()) + ')';
                    this.loadNotifBadge();
                }
            });
        });

        document.getElementById('apiBaseUrl').value = Api.getBaseUrl();

        document.getElementById('btnSaveApiUrl').onclick = () => {
            Api.setBaseUrl(document.getElementById('apiBaseUrl').value.trim());
            alert(I18n.t('common.save') + ' ✓');
        };

        document.getElementById('btnLogin').onclick = () => this.doLogin();
        document.getElementById('loginPassword').addEventListener('keydown', e => {
            if (e.key === 'Enter') this.doLogin();
        });
        document.getElementById('btnLogout').onclick = () => this.doLogout();

        // -------------------- گۆڕین نێوان چوونەژوورەوە و تۆمارکردن --------------------
        document.getElementById('linkShowRegister').onclick = (e) => {
            e.preventDefault();
            document.getElementById('regApiBaseUrl').value = Api.getBaseUrl();
            this.showRegister();
        };
        document.getElementById('linkShowLogin').onclick = (e) => {
            e.preventDefault();
            this.showLogin();
        };
        document.getElementById('btnRegister').onclick = () => this.doRegister();
        document.getElementById('regAdminPassword').addEventListener('keydown', e => {
            if (e.key === 'Enter') this.doRegister();
        });

        window.addEventListener('hashchange', () => this.route());

        if (Api.isLoggedIn()) {
            this.showApp();
        } else {
            this.showLogin();
        }
    },

    showLogin() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('registerScreen').style.display = 'none';
        document.getElementById('appShell').style.display = 'none';
    },

    showRegister() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('registerScreen').style.display = 'flex';
        document.getElementById('appShell').style.display = 'none';
    },

    showApp() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appShell').style.display = 'flex';
        document.getElementById('storeNameLabel').textContent = Api.getStoreName();
        document.getElementById('currentUserLabel').textContent =
            Api.getUsername() + ' (' + this.roleLabel(Api.getRole()) + ')';
        this.applyRoleVisibility();
        this.route();
        this.loadSubscriptionBanner();
        this.loadNotifBadge();
    },

    // باتچی پڕۆفایل/فیدباک/نۆتیفیکەیشن — ژمارەی نەخوێندراوەکان لای
    // ناوی "🔔 ئاگادارکردنەوەکان" لە sidebar دەردەخات. شکستهێنانی ئەم
    // پشکنینە (بۆ نموونە endpoint ـەکە هێشتا نوێ deploy نەکرابێت) نابێت
    // ببێتە هۆی وەستانی ئاپەکە — هەمان شێوازی loadSubscriptionBanner.
    async loadNotifBadge() {
        const el = document.getElementById('navNotifications');
        if (!el) return;
        // باتچی وەرگێڕان — پێشتر ڕاستەوخۆ el.textContent دادنرا، کە
        // بەربوونی <span data-i18n="nav.notifications"> ـی نوێی
        // نێوان ئایکۆن/دەق دەشکاند. ئێستا تەنها ناوەڕۆکی ئەو span ـە
        // دەگۆڕدرێت، بۆیە ئایکۆنەکە دەمێنێتەوە و بە هەر زمانێک کە
        // ئێستا چالاکە دەردەکەوێت.
        const labelSpan = el.querySelector('[data-i18n="nav.notifications"]');
        try {
            const count = await Api.getUnreadNotificationCount();
            const label = I18n.t('nav.notifications');
            if (labelSpan) labelSpan.textContent = count > 0 ? `${label} (${count})` : label;
        } catch {
            // بێدەنگانە ڕەتی دەکاتەوە
        }
    },

    // باتچ ٣ (دوای MFA) — Part 37 follow-up: GET /api/Subscription/status
    // پێشتر هیچ لایەنی WebAdmin ـی نەبوو کە بیخوێنێتەوە، تەنانەت
    // Owner Console ـیش تەنها هی خۆی دەبینی. ئێستا جارێک لە هەر
    // چوونەژوورەوەیەک (نەک لە هەر route() ـێک — بۆ کەمکردنەوەی
    // داواکاری بێهوودە) بانەرێکی ساکار پیشان دەدات ئەگەر پێویست بێت.
    async loadSubscriptionBanner() {
        const el = document.getElementById('subscriptionBanner');
        if (!el) return;

        try {
            const status = await Api.getSubscriptionStatus();
            el.innerHTML = '';
            el.className = '';
            if (!status) return;

            const days = status.daysRemaining;
            let cls = null, text = null;

            if (status.status === 'Trial' && days != null) {
                cls = days <= 3 ? 'alert-danger' : 'alert-info';
                text = I18n.t('subscription.trialDays', { days });
            } else if (status.status === 'GracePeriod') {
                cls = 'alert-danger';
                text = days != null
                    ? I18n.t('subscription.graceWithDays', { days })
                    : I18n.t('subscription.graceNoDays');
            } else if (status.status === 'PaymentDue') {
                cls = 'alert-warning';
                text = I18n.t('subscription.paymentDue');
            }

            if (cls && text) {
                el.className = 'alert ' + cls;
                el.textContent = text;
            }
        } catch {
            // شکستهێنانی ئەم پشکنینە نابێت ببێتە هۆی وەستانی ئاپەکە —
            // بێدەنگانە ڕەتی دەکاتەوە (بۆ نموونە ئەگەر endpoint ـەکە
            // لە کڕیارێکی کۆنی Render ـدا هێشتا زیاد نەکرابێت).
        }
    },

    roleLabel(role) {
        return I18n.t('role.' + role) !== ('role.' + role) ? I18n.t('role.' + role) : (role || '');
    },

    // خاڵی: ئەمە تەنها ڕوکارە (UI convenience) — پاراستنی ڕاستەقینە
    // هەمیشە لای سێرڤەرەوەیە (بڕوانە permission matrix ی Phase #1).
    applyRoleVisibility() {
        const role = Api.getRole();
        const rules = {
            dashboard: ['Admin', 'Cashier', 'DataEntry', 'Accountant'],
            products: ['Admin', 'Cashier', 'DataEntry', 'Accountant'],
            sales: ['Admin', 'Cashier', 'Accountant'],
            // Part 13/29 — CustomersController/SuppliersController خۆیان
            // تەنها [Authorize] ی هەیە بۆ GetAll/GetOne (هەموو ڕۆڵێک
            // دەتوانێت ببینێت)، بۆیە ئێرەش هەمان چوار ڕۆڵی products.
            customers: ['Admin', 'Cashier', 'DataEntry', 'Accountant'],
            // باتچی قەرزی کڕیار — endpoint ـەکانی with-balance/unpaid-sales
            // لای سێرڤەرەوە تەنها [Authorize(Roles="Admin,Cashier,Accountant")]ن
            // (DataEntry نیە)، بۆیە ئێرەش هەمان سێ ڕۆڵە تاوەکو DataEntry
            // پەڕەیەکی 403 نەبینێت.
            customerdebts: ['Admin', 'Cashier', 'Accountant'],
            purchases: ['Admin', 'DataEntry', 'Accountant'],
            suppliers: ['Admin', 'Cashier', 'DataEntry', 'Accountant'],
            expenses: ['Admin', 'Accountant'],
            reports: ['Admin', 'Accountant'],
            users: ['Admin'],
            activitylog: ['Admin'],
            // باتچ ٤ — هەموو ڕۆڵێک دەتوانێت ببینێت (هەمان [Authorize]
            // ی سادەی TenantController.GetSettings)، بەڵام تەنها Admin
            // دەتوانێت بگۆڕێت (Pages.settings خۆی فۆرمەکە disable دەکات
            // بۆ ڕۆڵی تر).
            settings: ['Admin', 'Cashier', 'DataEntry', 'Accountant'],
            // باتچی پڕۆفایل/فیدباک/نۆتیفیکەیشن — هەموو ڕۆڵێک، هەمان
            // شێوازی settings (endpoint ـەکانی [Authorize] ـی سادەن،
            // بەبێ سنووری ڕۆڵ لای سێرڤەرەوە).
            notifications: ['Admin', 'Cashier', 'DataEntry', 'Accountant'],
            profile: ['Admin', 'Cashier', 'DataEntry', 'Accountant']
        };
        document.querySelectorAll('.nav-item').forEach(el => {
            const page = el.dataset.page;
            el.style.display = (rules[page] || []).includes(role) ? '' : 'none';
        });
    },

    async doLogin() {
        const slug = document.getElementById('loginSlug').value.trim();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errBox = document.getElementById('loginError');
        errBox.style.display = 'none';

        if (!slug || !username || !password) {
            errBox.textContent = I18n.t('common.fillAllFields');
            errBox.style.display = 'block';
            return;
        }

        try {
            const result = await Api.login(slug, username, password);
            Api.setSession(result.token, result.username, result.role, result.storeName);
            this.showApp();
        } catch (err) {
            errBox.textContent = err.message || I18n.t('login.failed');
            errBox.style.display = 'block';
        }
    },

    async doRegister() {
        const storeName = document.getElementById('regStoreName').value.trim();
        const slug = document.getElementById('regSlug').value.trim();
        const adminUsername = document.getElementById('regAdminUsername').value.trim();
        const adminPassword = document.getElementById('regAdminPassword').value;
        const apiUrl = document.getElementById('regApiBaseUrl').value.trim();
        const errBox = document.getElementById('registerError');
        errBox.style.display = 'none';

        if (!storeName || !slug || !adminUsername || !adminPassword) {
            errBox.textContent = I18n.t('common.fillAllFields');
            errBox.style.display = 'block';
            return;
        }

        if (apiUrl) Api.setBaseUrl(apiUrl);

        const btn = document.getElementById('btnRegister');
        btn.disabled = true;
        btn.textContent = I18n.t('common.pleaseWait');

        try {
            const result = await Api.registerTenant(storeName, slug, adminUsername, adminPassword);
            Api.setSession(result.token, result.username, result.role, result.storeName);
            alert(I18n.t('register.successMessage', { username: result.username }));
            this.showApp();
        } catch (err) {
            errBox.textContent = err.message || I18n.t('register.failed');
            errBox.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.textContent = I18n.t('register.submit');
        }
    },

    doLogout() {
        Api.clearSession();
        const banner = document.getElementById('subscriptionBanner');
        if (banner) { banner.innerHTML = ''; banner.className = ''; }
        this.showLogin();
    },

    route() {
        const hash = (location.hash || '#dashboard').substring(1);
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === hash);
        });

        const renderers = {
            dashboard: Pages.dashboard,
            products: Pages.products,
            sales: Pages.sales,
            customers: Pages.customers,
            customerdebts: Pages.customerDebts,
            purchases: Pages.purchases,
            suppliers: Pages.suppliers,
            expenses: Pages.expenses,
            reports: Pages.reports,
            users: Pages.users,
            activitylog: Pages.activitylog,
            settings: Pages.settings,
            notifications: Pages.notifications,
            profile: Pages.profile
        };

        const renderer = renderers[hash] || Pages.dashboard;
        renderer.call(Pages);
    },

    // -------------------- یارمەتیدەرەکانی گشتی --------------------

    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;');
    },

    fmtMoney(n) {
        return (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    // تێبینی: بەرهەمی ئەم فەنکشنە ڕاستەوخۆ لەناو HTML template ـدا
    // بەکاردێت (نەک وەک دەقی سادە)، بۆیە <bdi dir="ltr"> پێویستە تاوەکو
    // ڕیزبەندی بەروار لەناو دەقی RTL ـدا هەڵنەگەڕدرێت (Bidi bug).
    fmtDate(d) {
        const date = new Date(d);
        if (isNaN(date)) return '';
        const text = date.toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        return `<bdi dir="ltr">${text}</bdi>`;
    },

    setContent(html) {
        document.getElementById('pageContent').innerHTML = html;
    },

    loadingHtml(label) {
        return `<div class="state-box">⏳ ${label || I18n.t('common.loading')}</div>`;
    },

    errorHtml(err) {
        const msg = (err && err.message) ? err.message : I18n.t('common.genericError');
        return `<div class="state-box">⚠️ ${App.escapeHtml(msg)}</div>`;
    },

    emptyHtml(label) {
        return `<div class="state-box">🗒️ ${label || I18n.t('common.noData')}</div>`;
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
