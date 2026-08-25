// -------------------- API Client --------------------
// هەموو داواکارییەکان بۆ CashierApi لێرەوە دەڕۆن. JWT لە
// localStorage هەڵدەگیرێت (هەمان شێوازی ئاسایی بۆ SPA ی سادە).
// تێبینی: هەموو Authorization لای سێرڤەرەوەیە — ئەم لایەنە تەنها
// ڕوکارە، هیچ کاتێک وەک سنووری ئاسایش دانانرێت.

const Api = {
    getBaseUrl() {
        return localStorage.getItem('apiBaseUrl') || 'https://cashierapi.onrender.com';
    },

    setBaseUrl(url) {
        localStorage.setItem('apiBaseUrl', url.replace(/\/$/, ''));
    },

    getToken() {
        return localStorage.getItem('token');
    },

    setSession(token, username, role, storeName) {
        localStorage.setItem('token', token);
        localStorage.setItem('username', username);
        localStorage.setItem('role', role);
        localStorage.setItem('storeName', storeName);
    },

    clearSession() {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('role');
        localStorage.removeItem('storeName');
    },

    getRole() { return localStorage.getItem('role') || ''; },
    getUsername() { return localStorage.getItem('username') || ''; },
    getStoreName() { return localStorage.getItem('storeName') || ''; },

    isLoggedIn() { return !!this.getToken(); },

    async request(method, path, body) {
        const headers = { 'Content-Type': 'application/json' };
        const token = this.getToken();
        if (token) headers['Authorization'] = 'Bearer ' + token;

        let resp;
        try {
            resp = await fetch(this.getBaseUrl() + path, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined
            });
        } catch (err) {
            throw new ApiError(0, I18n.t('apiError.network'));
        }

        if (resp.status === 401) {
            // token ـەکە بەسەرچووە یان نادروستە
            this.clearSession();
            throw new ApiError(401, I18n.t('apiError.sessionExpired'));
        }

        if (resp.status === 403) {
            throw new ApiError(403, I18n.t('apiError.noPermission'));
        }

        if (!resp.ok) {
            let message = I18n.t('apiError.genericStatus', { status: resp.status });
            try {
                const data = await resp.json();
                message = data.message || data.error || (typeof data === 'string' ? data : message);
            } catch { /* وەڵامەکە JSON نەبوو */ }
            throw new ApiError(resp.status, message);
        }

        if (resp.status === 204) return null;

        const totalCountHeader = resp.headers.get('X-Total-Count');
        const data = await resp.json().catch(() => null);
        if (totalCountHeader !== null) {
            return { data, totalCount: parseInt(totalCountHeader, 10) };
        }
        return data;
    },

    get(path) { return this.request('GET', path); },
    post(path, body) { return this.request('POST', path, body); },
    put(path, body) { return this.request('PUT', path, body); },
    patch(path, body) { return this.request('PATCH', path, body); },
    del(path) { return this.request('DELETE', path); },

    // -------------------- Auth --------------------
    login(storeSlug, username, password) {
        return this.request('POST', '/api/Auth/login', { storeSlug, username, password });
    },

    // تۆمارکردنی فرۆشگایەکی نوێ (tenant) + یەکەم بەکارهێنەری Admin.
    // هەمان endpoint ـی ئاپی مۆبایل و WinForms بەکاریدەهێنن.
    registerTenant(storeName, slug, adminUsername, adminPassword) {
        return this.request('POST', '/api/Auth/register-tenant', {
            storeName, slug, adminUsername, adminPassword
        });
    },

    // -------------------- Products --------------------
    getProducts(search) {
        return this.get('/api/Products' + (search ? '?search=' + encodeURIComponent(search) : ''));
    },
    createProduct(product) { return this.post('/api/Products', product); },
    updateProduct(id, product) { return this.put('/api/Products/' + id, product); },
    deleteProduct(id) { return this.del('/api/Products/' + id); },

    // فازی وێنەی کاڵا — بڕوانە CashierApi/Controllers/ProductsController.cs
    // (UploadImage/DeleteImage). uploadFile() جیاوازە لە request() ئاسایی
    // چونکە multipart/form-data دەنێرێت، نەک JSON.
    uploadProductImage(id, file) { return this.uploadFile('/api/Products/' + id + '/image', file); },
    deleteProductImage(id) { return this.del('/api/Products/' + id + '/image'); },

    async uploadFile(path, file) {
        const headers = {};
        const token = this.getToken();
        if (token) headers['Authorization'] = 'Bearer ' + token;

        const form = new FormData();
        form.append('file', file);

        let resp;
        try {
            resp = await fetch(this.getBaseUrl() + path, { method: 'POST', headers, body: form });
        } catch (err) {
            throw new ApiError(0, I18n.t('apiError.network'));
        }

        if (resp.status === 401) {
            this.clearSession();
            throw new ApiError(401, I18n.t('apiError.sessionExpired'));
        }
        if (resp.status === 403) throw new ApiError(403, I18n.t('apiError.noPermission'));

        if (!resp.ok) {
            let message = I18n.t('apiError.genericStatus', { status: resp.status });
            try {
                const data = await resp.json();
                message = data.message || data.error || message;
            } catch { /* وەڵامەکە JSON نەبوو */ }
            throw new ApiError(resp.status, message);
        }

        return resp.json().catch(() => null);
    },

    // -------------------- Sales --------------------
    getSales(params = {}) {
        const q = new URLSearchParams();
        if (params.from) q.set('from', params.from);
        if (params.to) q.set('to', params.to);
        if (params.search) q.set('search', params.search);
        return this.get('/api/Sales' + (q.toString() ? '?' + q.toString() : ''));
    },

    // Part 13 — INVOICES: تۆمارکردنی پارەدانێکی زیاتر بۆ وەصڵێکی
    // "بەشێک دراوە"/"هیچ نەدراوە" (بڕوانە PART13_INVOICES_MIGRATION_REQUIRED.md).
    recordSalePayment(id, additionalAmount, notes) {
        return this.patch('/api/Sales/' + id + '/payment', { additionalAmount, notes });
    },

    // قۆناغی دەروازەی پارەدان — Qi Card. بڕوانە
    // CashierApi/Controllers/PaymentsController.cs.
    createQiCardPayment(saleId) { return this.post('/api/Payments/qicard/' + saleId + '/create'); },
    getQiCardStatus(saleId) { return this.get('/api/Payments/qicard/' + saleId + '/status'); },

    // -------------------- Customers (Part 13 — پێشتر هیچ ڕوکارێکی
    // بۆ نەبوو، تەنها API ـەکەی هەبوو) --------------------
    getCustomers(search) {
        return this.get('/api/Customers' + (search ? '?search=' + encodeURIComponent(search) : ''));
    },
    createCustomer(customer) { return this.post('/api/Customers', customer); },
    updateCustomer(id, customer) { return this.put('/api/Customers/' + id, customer); },
    deleteCustomer(id) { return this.del('/api/Customers/' + id); },
    getCustomerSales(id) { return this.get('/api/Customers/' + id + '/sales'); },

    // باتچی قەرزی کڕیار — بڕوانە CashierApi/Controllers/CustomersController.cs.
    // with-balance: لیستی هەموو کڕیاران (یان تەنها قەرزدارەکان) + بڕی
    // قەرزی هەریەکەیان. گەڕان بە ناو/ژمارە یان بە ئایدی کڕیار.
    getCustomersWithBalance(onlyWithDebt, search) {
        const q = new URLSearchParams();
        if (onlyWithDebt) q.set('onlyWithDebt', 'true');
        if (search) q.set('search', search);
        return this.get('/api/Customers/with-balance' + (q.toString() ? '?' + q.toString() : ''));
    },
    getCustomerBalance(id) { return this.get('/api/Customers/' + id + '/balance'); },
    getCustomerUnpaidSales(id) { return this.get('/api/Customers/' + id + '/unpaid-sales'); },

    // -------------------- Expenses --------------------
    getExpenses() { return this.get('/api/Expenses'); },
    createExpense(expense) { return this.post('/api/Expenses', expense); },

    // -------------------- Purchases --------------------
    getPurchases(params = {}) {
        const q = new URLSearchParams();
        if (params.from) q.set('from', params.from);
        if (params.to) q.set('to', params.to);
        if (params.supplier) q.set('supplier', params.supplier);
        return this.get('/api/Purchases' + (q.toString() ? '?' + q.toString() : ''));
    },
    receivePurchase(purchase) { return this.post('/api/Purchases/receive', purchase); },

    // -------------------- Suppliers (Part 13 — پێشتر هیچ ڕوکارێکی
    // بۆ نەبوو، تەنها API ـەکەی هەبوو) --------------------
    getSuppliers(search) {
        return this.get('/api/Suppliers' + (search ? '?search=' + encodeURIComponent(search) : ''));
    },
    createSupplier(supplier) { return this.post('/api/Suppliers', supplier); },
    updateSupplier(id, supplier) { return this.put('/api/Suppliers/' + id, supplier); },
    deleteSupplier(id) { return this.del('/api/Suppliers/' + id); },
    getSupplierPurchases(id) { return this.get('/api/Suppliers/' + id + '/purchases'); },

    // -------------------- Reports --------------------
    getReport(from, to) {
        return this.get('/api/Reports?from=' + from + '&to=' + to);
    },

    // -------------------- Users --------------------
    // تێبینی: UsersController تەنها یەک POST/api/Users هەیە بۆ
    // دروستکردن و دەستکاریکردن پێکەوە (Id=0 بۆ نوێ، Id!=0 بۆ دەستکاری).
    getUsers() { return this.get('/api/Users'); },
    saveUser(user) { return this.post('/api/Users', user); },
    deleteUser(id) { return this.del('/api/Users/' + id); },

    // -------------------- Activity Log --------------------
    getActivityLog() { return this.get('/api/ActivityLog'); },

    // -------------------- باتچ ٣ (دوای MFA) — Subscription status --------------------
    // بۆ بانەری ماوەی تاقیکردنەوە/مۆڵەت (بڕوانە app.js ـی loadSubscriptionBanner).
    getSubscriptionStatus() { return this.get('/api/Subscription/status'); },

    // -------------------- باتچ ٤ — Tenant Settings --------------------
    // TenantController.GetSettings/UpdateSettings پێشتر لە باتچێکی
    // پێشووتردا لە backend ـدا دروستکرابوون بەڵام هیچ لایەنی WebAdmin
    // ـیان نەبوو — بڕوانە pages-2.js ـی Pages.settings.
    getTenantSettings() { return this.get('/api/Tenant/settings'); },
    updateTenantSettings(payload) { return this.put('/api/Tenant/settings', payload); },

    // -------------------- پڕۆفایل/فیدباک/نۆتیفیکەیشن --------------------
    // بڕوانە CashierApi/Controllers/ProfileController.cs,
    // FeedbackController.cs, NotificationsController.cs — بڕوانە
    // CashierApi/MIGRATION_PROFILE_FEEDBACK_NOTIFICATIONS_REQUIRED.md بۆ
    // وردەکاری backend ـەکە (پێشتر تەواو بووە و run کراوە لەسەر Aiven،
    // ئەم فایلە تەنها UI ـی WebAdmin ـە کە پێشتر بوونی نەبوو).
    getMyProfile() { return this.get('/api/Profile'); },
    updateMyProfile(payload) { return this.put('/api/Profile', payload); },
    uploadMyPhoto(file) { return this.uploadFile('/api/Profile/photo', file); },

    submitFeedback(rating, message) { return this.post('/api/Feedback', { rating, message }); },

    getNotifications() { return this.get('/api/Notifications'); },
    getUnreadNotificationCount() { return this.get('/api/Notifications/unread-count'); },
    markNotificationRead(id) { return this.post('/api/Notifications/' + id + '/read'); }
};

class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
