// -------------------- Page Renderers --------------------
// تێبینی: هەموو ناوی فەنکشن/ID/onclick ـەکان وەک خۆیان ماونەتەوە،
// تەنها HTML ـی خشتەکان گۆڕدراوە بۆ "row-list" (لیستی کارتی) لە
// جیاتی <table class="data-table"> — بۆ ئەوەی شێوازی Owner Console
// بگونجێت و لە شێوازی DataGridView/grid-view دووربکەوێتەوە.
//
// باتچی وەرگێڕان — ئەم فایلە یەکەم پەڕەیە کە ناوەڕۆکی خۆی بەتەواوی
// وەرگێڕدراوە (بڕوانە js/i18n.js). emoji ـەکان جیا مانەوە لە دەقی
// وەرگێڕدراو، چونکە پێویستیان بە وەرگێڕان نییە.
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

            let html = `<h2 class="page-title">🏠 ${I18n.t('dash.title')}</h2>`;

            if (report) {
                html += `<div class="kpi-grid">
                    <div class="kpi-card"><div class="kpi-label">💰 ${I18n.t('dash.todaySales')}</div><div class="kpi-value">${App.fmtMoney(report.totalRevenue)}</div></div>
                    <div class="kpi-card"><div class="kpi-label">🧾 ${I18n.t('dash.salesCount')}</div><div class="kpi-value">${report.salesCount}</div></div>
                    <div class="kpi-card"><div class="kpi-label">💸 ${I18n.t('dash.todayExpenses')}</div><div class="kpi-value">${App.fmtMoney(report.expensesTotal)}</div></div>
                    <div class="kpi-card"><div class="kpi-label">📈 ${I18n.t('dash.todayProfit')}</div><div class="kpi-value">${App.fmtMoney(report.netProfit)}</div></div>
                </div>`;
            } else {
                html += `<div class="alert alert-danger">${I18n.t('dash.reportError')}</div>`;
            }

            html += `<div class="kpi-grid">
                <div class="kpi-card"><div class="kpi-label">📦 ${I18n.t('dash.totalProducts')}</div><div class="kpi-value">${products.length}</div></div>
                <div class="kpi-card"><div class="kpi-label">⚠️ ${I18n.t('dash.lowStockCount')}</div><div class="kpi-value">${lowStock.length}</div></div>
            </div>`;

            if (lowStock.length > 0) {
                html += `<div class="card"><h3>⚠️ ${I18n.t('dash.lowStockTitle')}</h3>
                    <div class="row-list">` +
                    lowStock.slice(0, 10).map(p => `
                        <div class="row-item">
                            <div class="row-icon">📦</div>
                            <div class="row-main"><div class="row-title">${App.escapeHtml(p.name)}</div></div>
                            <span class="badge badge-danger">${p.quantity} ${I18n.t('dash.inStock')}</span>
                        </div>
                    `).join('') + `</div></div>`;
            }

            html += `<div class="card"><h3>🕓 ${I18n.t('dash.todaySales')}</h3>`;
            if (salesArr.length === 0) {
                html += App.emptyHtml(I18n.t('dash.noSalesToday'));
            } else {
                html += `<div class="row-list">` + salesArr.slice(0, 10).map(s => `
                    <div class="row-item">
                        <div class="row-icon">🧾</div>
                        <div class="row-main">
                            <div class="row-title">${I18n.t('dash.receipt')} #${s.id}</div>
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

            let html = `<h2 class="page-title">📦 ${I18n.t('products.title')}</h2>
                <div class="filter-bar">
                    <div class="form-row" style="flex:1;min-width:200px;">
                        <input type="text" id="productSearch" placeholder="${I18n.t('products.searchPlaceholder')}" value="${App.escapeHtml(search || '')}">
                    </div>
                    <button class="btn btn-primary" onclick="Pages.searchProducts()">${I18n.t('common.search')}</button>
                    ${canEdit ? `<button class="btn btn-accent" onclick="Pages.showProductForm()">➕ ${I18n.t('common.add')}</button>` : ''}
                </div>`;

            if (products.length === 0) {
                html += App.emptyHtml(I18n.t('products.none'));
            } else {
                html += `<div class="row-list">`;
                for (const p of products) {
                    const low = p.quantity <= 5;
                    const thumb = p.imageUrl
                        ? `<img src="${App.escapeHtml(p.imageUrl)}" class="row-icon" style="object-fit:cover;border-radius:6px;" onerror="this.style.display='none'">`
                        : `<div class="row-icon">📦</div>`;
                    html += `<div class="row-item">
                        ${thumb}
                        <div class="row-main">
                            <div class="row-title">${App.escapeHtml(p.name)}</div>
                            <div class="row-sub">${App.escapeHtml(p.category || I18n.t('products.noCategory'))} ${p.barcodeSingle ? '· ' + App.escapeHtml(p.barcodeSingle) : ''}</div>
                        </div>
                        <div class="row-col"><div class="n">${App.fmtMoney(p.price)}</div><div class="l">${I18n.t('products.priceLabel')}</div></div>
                        <div>${low ? `<span class="badge badge-danger">${p.quantity} ${I18n.t('products.stockUnit')}</span>` : `<span class="badge badge-muted">${p.quantity} ${I18n.t('products.stockUnit')}</span>`}</div>
                        <div class="row-actions">
                            ${canEdit ? `<button class="btn btn-outline btn-small" onclick='Pages.showProductForm(${JSON.stringify(p)})'>${I18n.t('common.edit')}</button>` : ''}
                            ${canDelete ? `<button class="btn btn-danger btn-small" onclick="Pages.deleteProduct(${p.id}, '${App.escapeHtml(p.name)}')">${I18n.t('common.delete')}</button>` : ''}
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
        const p = product || { id: 0, name: '', category: '', price: 0, costPrice: 0, quantity: 0, barcodeSingle: '', barcodeSet: '', setQuantity: 1, barcodeRangeStart: '', barcodeRangeEnd: '', imageUrl: '' };
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-box">
                <h3>${p.id ? I18n.t('products.modalEdit') : I18n.t('products.modalAdd')}</h3>
                <div id="productFormError" class="alert alert-danger" style="display:none;"></div>
                <div class="form-row">
                    <label>${I18n.t('products.imageLabel')}</label>
                    <div style="display:flex;align-items:center;gap:10px;">
                        ${p.imageUrl ? `<img id="pf_imagePreview" src="${App.escapeHtml(p.imageUrl)}" style="width:64px;height:64px;object-fit:cover;border-radius:6px;">` : `<div id="pf_imagePreview" style="width:64px;height:64px;border-radius:6px;background:#eee;display:flex;align-items:center;justify-content:center;">📦</div>`}
                        <div style="flex:1;">
                            <input type="file" id="pf_image" accept="image/jpeg,image/png,image/webp">
                            ${p.id && p.imageUrl ? `<button type="button" class="btn btn-outline btn-small" style="margin-top:6px;" onclick="Pages.deleteProductImage(${p.id})">${I18n.t('products.deleteImage')}</button>` : ''}
                        </div>
                    </div>
                </div>
                <div class="form-row"><label>${I18n.t('products.name')}</label><input id="pf_name" value="${App.escapeHtml(p.name)}"></div>
                <div class="form-row"><label>${I18n.t('products.category')}</label><input id="pf_category" value="${App.escapeHtml(p.category)}"></div>
                <div class="form-row"><label>${I18n.t('products.sellPrice')}</label><input id="pf_price" type="number" step="0.01" value="${p.price}"></div>
                <div class="form-row"><label>${I18n.t('products.costPrice')}</label><input id="pf_costPrice" type="number" step="0.01" value="${p.costPrice}"></div>
                <div class="form-row"><label>${I18n.t('products.stockLabel')}</label><input id="pf_quantity" type="number" value="${p.quantity}"></div>
                <div class="form-row"><label>${I18n.t('products.barcodeSingle')}</label><input id="pf_barcodeSingle" value="${App.escapeHtml(p.barcodeSingle)}"></div>
                <div class="form-row"><label>${I18n.t('products.barcodeSet')}</label><input id="pf_barcodeSet" value="${App.escapeHtml(p.barcodeSet)}"></div>
                <div class="form-row"><label>${I18n.t('products.setQty')}</label><input id="pf_setQuantity" type="number" value="${p.setQuantity}"></div>
                <div style="display:flex;gap:8px;margin-top:14px;">
                    <button class="btn btn-primary" style="flex:1;" onclick="Pages.saveProduct(${p.id})">${I18n.t('common.save')}</button>
                    <button class="btn btn-outline" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">${I18n.t('common.cancel')}</button>
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
            errBox.textContent = I18n.t('products.nameRequired');
            errBox.style.display = 'block';
            return;
        }

        try {
            let savedId = id;
            if (id) {
                await Api.updateProduct(id, product);
            } else {
                const created = await Api.createProduct(product);
                savedId = created?.id;
            }

            // فازی وێنەی کاڵا — ئەگەر فایلێک هەڵبژێردرا، دوای
            // پاشەکەوتکردنی زانیاری بنەڕەتی کاڵاکە (کە پێویستە Id ی
            // ڕاستەقینەی هەبێت پێش بارکردنی وێنە)، ئێستا وێنەکە بار دەکرێت.
            const fileInput = document.getElementById('pf_image');
            const file = fileInput?.files?.[0];
            if (file && savedId) {
                try {
                    await Api.uploadProductImage(savedId, file);
                } catch (imgErr) {
                    // زانیاری بنەڕەتی سەرکەوتوو بوو — تەنها وێنەکە شکستی
                    // هێنا، بۆیە فۆرمەکە دادەخرێت بەڵام ئاگاداری دەکەینەوە
                    // نەک هەموو کارەکە پووچەڵ بکەینەوە.
                    alert(I18n.t('products.imageUploadFailedPrefix') + imgErr.message);
                }
            }

            document.querySelector('.modal-overlay')?.remove();
            this.products();
        } catch (err) {
            errBox.textContent = err.message;
            errBox.style.display = 'block';
        }
    },

    async deleteProductImage(id) {
        if (!confirm(I18n.t('products.confirmDeleteImage'))) return;
        try {
            await Api.deleteProductImage(id);
            document.querySelector('.modal-overlay')?.remove();
            this.products();
        } catch (err) {
            alert(err.message);
        }
    },

    async deleteProduct(id, name) {
        if (!confirm(I18n.t('products.confirmDelete', { name }))) return;
        try {
            await Api.deleteProduct(id);
            this.products();
        } catch (err) {
            alert(err.message);
        }
    }
};
