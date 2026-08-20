// -------------------- Page Renderers --------------------
// تێبینی: هەموو ناوی فەنکشن/ID/onclick ـەکان وەک خۆیان ماونەتەوە،
// تەنها HTML ـی خشتەکان گۆڕدراوە بۆ "row-list" (لیستی کارتی) لە
// جیاتی <table class="data-table"> — بۆ ئەوەی شێوازی Owner Console
// بگونجێت و لە شێوازی DataGridView/grid-view دووربکەوێتەوە.
const Pages = {

    // ============ داشبۆرد ============
    async dashboard() {
        App.setContent(App.loadingHtml());
        try {
            const today = new Date().toISOString().slice(0, 10);
            const [report, products, sales] = await Promise.all([
                Api.getReport(today, today).catch(() => null),
                Api.getProducts().catch(() => []),
                Api.getSales({ from: today, to: today }).catch(() => [])
            ]);

            const salesArr = Array.isArray(sales) ? sales : (sales?.data || []);
            const lowStock = products.filter(p => p.quantity <= 5).sort((a, b) => a.quantity - b.quantity);

            let html = `<h2 class="page-title">🏠 داشبۆرد</h2>`;

            if (report) {
                html += `<div class="kpi-grid">
                    <div class="kpi-card"><div class="kpi-label">💰 فرۆشتنی ئەمڕۆ</div><div class="kpi-value">${App.fmtMoney(report.totalRevenue)}</div></div>
                    <div class="kpi-card"><div class="kpi-label">🧾 ژمارەی فرۆشتن</div><div class="kpi-value">${report.salesCount}</div></div>
                    <div class="kpi-card"><div class="kpi-label">💸 خەرجی ئەمڕۆ</div><div class="kpi-value">${App.fmtMoney(report.expensesTotal)}</div></div>
                    <div class="kpi-card"><div class="kpi-label">📈 سوودی ئەمڕۆ</div><div class="kpi-value">${App.fmtMoney(report.netProfit)}</div></div>
                </div>`;
            } else {
                html += `<div class="alert alert-danger">نەتوانرا ڕاپۆرتی ئەمڕۆ بهێنرێت (لەوانەیە دەسەڵاتت نەبێت).</div>`;
            }

            html += `<div class="kpi-grid">
                <div class="kpi-card"><div class="kpi-label">📦 کۆی کاڵاکان</div><div class="kpi-value">${products.length}</div></div>
                <div class="kpi-card"><div class="kpi-label">⚠️ کەمی کۆگا</div><div class="kpi-value">${lowStock.length}</div></div>
            </div>`;

            if (lowStock.length > 0) {
                html += `<div class="card"><h3>⚠️ کاڵای کەمی کۆگا</h3>
                    <div class="row-list">` +
                    lowStock.slice(0, 10).map(p => `
                        <div class="row-item">
                            <div class="row-icon">📦</div>
                            <div class="row-main"><div class="row-title">${App.escapeHtml(p.name)}</div></div>
                            <span class="badge badge-danger">${p.quantity} لە کۆگا</span>
                        </div>
                    `).join('') + `</div></div>`;
            }

            html += `<div class="card"><h3>🕓 فرۆشتنی ئەمڕۆ</h3>`;
            if (salesArr.length === 0) {
                html += App.emptyHtml('هێشتا هیچ فرۆشتنێک ئەمڕۆ نەکراوە');
            } else {
                html += `<div class="row-list">` + salesArr.slice(0, 10).map(s => `
                    <div class="row-item">
                        <div class="row-icon">🧾</div>
                        <div class="row-main">
                            <div class="row-title">وەصڵ #${s.id}</div>
                            <div class="row-sub">${App.fmtDate(s.date)} · ${App.escapeHtml(s.soldBy)}</div>
                        </div>
                        <div class="row-total">${App.fmtMoney(s.total)}</div>
                    </div>
                `).join('') + `</div>`;
            }
            html += `</div>`;

            App.setContent(html);
        } catch (err) {
            App.setContent(App.errorHtml(err));
        }
    },

    // ============ کاڵاکان ============
    async products(search) {
        App.setContent(App.loadingHtml());
        try {
            const products = await Api.getProducts(search);
            const canEdit = ['Admin', 'DataEntry'].includes(Api.getRole());
            const canDelete = Api.getRole() === 'Admin';

            let html = `<h2 class="page-title">📦 کاڵاکان</h2>
                <div class="filter-bar">
                    <div class="form-row" style="flex:1;min-width:200px;">
                        <input type="text" id="productSearch" placeholder="گەڕان بە ناو/بارکۆد..." value="${App.escapeHtml(search || '')}">
                    </div>
                    <button class="btn btn-primary" onclick="Pages.searchProducts()">گەڕان</button>
                    ${canEdit ? `<button class="btn btn-accent" onclick="Pages.showProductForm()">➕ زیادکردن</button>` : ''}
                </div>`;

            if (products.length === 0) {
                html += App.emptyHtml('هیچ کاڵایەک نەدۆزرایەوە');
            } else {
                html += `<div class="row-list">`;
                for (const p of products) {
                    const low = p.quantity <= 5;
                    html += `<div class="row-item">
                        <div class="row-icon">📦</div>
                        <div class="row-main">
                            <div class="row-title">${App.escapeHtml(p.name)}</div>
                            <div class="row-sub">${App.escapeHtml(p.category || 'بێ پۆل')} ${p.barcodeSingle ? '· ' + App.escapeHtml(p.barcodeSingle) : ''}</div>
                        </div>
                        <div class="row-col"><div class="n">${App.fmtMoney(p.price)}</div><div class="l">نرخ</div></div>
                        <div>${low ? `<span class="badge badge-danger">${p.quantity} کۆگا</span>` : `<span class="badge badge-muted">${p.quantity} کۆگا</span>`}</div>
                        <div class="row-actions">
                            ${canEdit ? `<button class="btn btn-outline btn-small" onclick='Pages.showProductForm(${JSON.stringify(p)})'>دەستکاری</button>` : ''}
                            ${canDelete ? `<button class="btn btn-danger btn-small" onclick="Pages.deleteProduct(${p.id}, '${App.escapeHtml(p.name)}')">سڕینەوە</button>` : ''}
                        </div>
                    </div>`;
                }
                html += `</div>`;
            }

            App.setContent(html);
            document.getElementById('productSearch')?.addEventListener('keydown', e => {
                if (e.key === 'Enter') this.searchProducts();
            });
        } catch (err) {
            App.setContent(App.errorHtml(err));
        }
    },

    searchProducts() {
        this.products(document.getElementById('productSearch').value.trim());
    },

    showProductForm(product) {
        const p = product || { id: 0, name: '', category: '', price: 0, costPrice: 0, quantity: 0, barcodeSingle: '', barcodeSet: '', setQuantity: 1, barcodeRangeStart: '', barcodeRangeEnd: '' };
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-box">
                <h3>${p.id ? 'دەستکاریکردنی کاڵا' : 'زیادکردنی کاڵا'}</h3>
                <div id="productFormError" class="alert alert-danger" style="display:none;"></div>
                <div class="form-row"><label>ناو</label><input id="pf_name" value="${App.escapeHtml(p.name)}"></div>
                <div class="form-row"><label>پۆل</label><input id="pf_category" value="${App.escapeHtml(p.category)}"></div>
                <div class="form-row"><label>نرخی فرۆشتن</label><input id="pf_price" type="number" step="0.01" value="${p.price}"></div>
                <div class="form-row"><label>نرخی کڕین</label><input id="pf_costPrice" type="number" step="0.01" value="${p.costPrice}"></div>
                <div class="form-row"><label>کۆگا</label><input id="pf_quantity" type="number" value="${p.quantity}"></div>
                <div class="form-row"><label>بارکۆدی تاک</label><input id="pf_barcodeSingle" value="${App.escapeHtml(p.barcodeSingle)}"></div>
                <div class="form-row"><label>بارکۆدی سێت</label><input id="pf_barcodeSet" value="${App.escapeHtml(p.barcodeSet)}"></div>
                <div class="form-row"><label>ژمارەی سێت</label><input id="pf_setQuantity" type="number" value="${p.setQuantity}"></div>
                <div style="display:flex;gap:8px;margin-top:14px;">
                    <button class="btn btn-primary" style="flex:1;" onclick="Pages.saveProduct(${p.id})">پاشەکەوتکردن</button>
                    <button class="btn btn-outline" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">پاشگەزبوونەوە</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
    },

    async saveProduct(id) {
        const errBox = document.getElementById('productFormError');
        const product = {
            id: id || 0,
            name: document.getElementById('pf_name').value.trim(),
            category: document.getElementById('pf_category').value.trim(),
            price: parseFloat(document.getElementById('pf_price').value) || 0,
            costPrice: parseFloat(document.getElementById('pf_costPrice').value) || 0,
            quantity: parseInt(document.getElementById('pf_quantity').value) || 0,
            barcodeSingle: document.getElementById('pf_barcodeSingle').value.trim(),
            barcodeSet: document.getElementById('pf_barcodeSet').value.trim(),
            setQuantity: parseInt(document.getElementById('pf_setQuantity').value) || 1,
            barcodeRangeStart: '',
            barcodeRangeEnd: ''
        };

        if (!product.name) {
            errBox.textContent = 'ناوی کاڵا پێویستە.';
            errBox.style.display = 'block';
            return;
        }

        try {
            if (id) {
                await Api.updateProduct(id, product);
            } else {
                await Api.createProduct(product);
            }
            document.querySelector('.modal-overlay')?.remove();
            this.products();
        } catch (err) {
            errBox.textContent = err.message;
            errBox.style.display = 'block';
        }
    },

    async deleteProduct(id, name) {
        if (!confirm(`دڵنیایت لە سڕینەوەی "${name}"؟`)) return;
        try {
            await Api.deleteProduct(id);
            this.products();
        } catch (err) {
            alert(err.message);
        }
    }
};
