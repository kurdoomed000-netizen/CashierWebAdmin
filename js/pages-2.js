// -------------------- Page Renderers (بەشی ٢) --------------------
Object.assign(Pages, {

    // ============ مێژووی فرۆشتن ============
    async sales(filters) {
        App.setContent(App.loadingHtml());
        const f = filters || this._salesFilters || {};
        this._salesFilters = f;

        try {
            const result = await Api.getSales(f);
            const salesArr = Array.isArray(result) ? result : (result?.data || []);

            let html = `<h2 class="page-title">🕓 مێژووی فرۆشتن</h2>
                <div class="filter-bar">
                    <div class="form-row"><label>لە بەرواری</label><input type="date" id="sFrom" value="${f.from || ''}"></div>
                    <div class="form-row"><label>بۆ بەرواری</label><input type="date" id="sTo" value="${f.to || ''}"></div>
                    <div class="form-row"><label>گەڕان (فرۆشیار/ژمارە)</label><input type="text" id="sSearch" value="${App.escapeHtml(f.search || '')}"></div>
                    <button class="btn btn-primary" onclick="Pages.applySalesFilter()">فلتەرکردن</button>
                    <button class="btn btn-outline" onclick="Pages.sales({})">سڕینەوەی فلتەر</button>
                </div>`;

            if (salesArr.length === 0) {
                html += App.emptyHtml('هیچ فرۆشتنێک نەدۆزرایەوە');
            } else {
                const totalRevenue = salesArr.reduce((sum, s) => sum + s.total, 0);
                html += `<div class="kpi-grid">
                    <div class="kpi-card"><div class="kpi-label">وەصڵ</div><div class="kpi-value">${salesArr.length}</div></div>
                    <div class="kpi-card"><div class="kpi-label">کۆی گشتی</div><div class="kpi-value">${App.fmtMoney(totalRevenue)}</div></div>
                </div>`;

                html += `<div class="row-list">`;
                for (const s of salesArr) {
                    // Part 13 — INVOICES: ژمارەی وەصڵ (ئەگەر نەبوو، وەک
                    // پێشتر #id) و بادجی دۆخی پارەدان زیادکران، هیچ
                    // ستوونێکی پێشوو نەگۆڕا.
                    html += `<div class="row-item">
                        <div class="row-icon">🧾</div>
                        <div class="row-main">
                            <div class="row-title">${App.escapeHtml(s.invoiceNumber || ('#' + s.id))}</div>
                            <div class="row-sub">${App.fmtDate(s.date)} · ${App.escapeHtml(s.soldBy)}</div>
                        </div>
                        <div class="row-col"><div class="n">${(s.items || []).length}</div><div class="l">کاڵا</div></div>
                        <div class="row-col"><div class="n">${App.fmtMoney(s.discount)}</div><div class="l">داشکاندن</div></div>
                        <div class="row-total">${App.fmtMoney(s.total)}</div>
                        <div class="row-col">${Pages.paymentStateBadge(s.paymentState)}</div>
                        <div class="row-actions"><button class="btn btn-outline btn-small" onclick='Pages.showSaleDetails(${JSON.stringify(s)})'>وردەکاری</button></div>
                    </div>`;
                }
                html += `</div>`;
            }

            App.setContent(html);
        } catch (err) {
            App.setContent(App.errorHtml(err));
        }
    },

    applySalesFilter() {
        this.sales({
            from: document.getElementById('sFrom').value,
            to: document.getElementById('sTo').value,
            search: document.getElementById('sSearch').value.trim()
        });
    },

    // Part 13 — INVOICES: بادجی دۆخی پارەدان، بەکاردێت لە لیستی
    // فرۆشتن و لە دیالۆگی وردەکاری. "Paid" وەک پێشتر هیچ بادجێکی
    // زیادەی نیشان نادات (سروشتی) — تەنها Partial/Unpaid دەردەکەون.
    paymentStateBadge(state) {
        if (state === 'Partial') return `<span class="badge badge-warning">بەشێک دراوە</span>`;
        if (state === 'Unpaid') return `<span class="badge badge-danger">هیچ نەدراوە</span>`;
        return `<span class="badge badge-success">دراوە بە تەواوی</span>`;
    },

    showSaleDetails(sale) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'saleDetailModal';
        const itemsHtml = (sale.items || []).map(i => `
            <div class="mini-row">
                <div class="mr-name">${App.escapeHtml(i.productName)}</div>
                <div class="mr-field">${i.quantity}×</div>
                <div class="mr-field">${App.fmtMoney(i.price)}</div>
                <div class="mr-field" style="font-weight:700;">${App.fmtMoney(i.price * i.quantity)}</div>
            </div>
        `).join('');

        const amountDue = Math.max((sale.total || 0) - (sale.amountPaid || 0), 0);
        const notPaid = sale.paymentState && sale.paymentState !== 'Paid';

        overlay.innerHTML = `
            <div class="modal-box">
                <h3>${App.escapeHtml(sale.invoiceNumber || ('وەصڵ #' + sale.id))}</h3>
                <p class="text-muted">${App.fmtDate(sale.date)} — فرۆشیار: ${App.escapeHtml(sale.soldBy)}</p>
                <p>${Pages.paymentStateBadge(sale.paymentState)}</p>
                <div class="mini-row-list">${itemsHtml}</div>
                <p style="margin-top:14px;">داشکاندن: <b>${App.fmtMoney(sale.discount)}</b></p>
                <p style="font-size:18px;color:var(--primary-dark);">کۆی گشتی: <b>${App.fmtMoney(sale.total)}</b></p>
                ${notPaid ? `
                    <p>دراوە: <b>${App.fmtMoney(sale.amountPaid)}</b> — ماوە: <b style="color:var(--danger);">${App.fmtMoney(amountDue)}</b></p>
                    <div class="form-row"><label>بڕی پارەدانی نوێ</label><input type="number" step="0.01" id="payAmount_${sale.id}"></div>
                    <button class="btn btn-primary btn-block" onclick="Pages.recordSalePayment(${sale.id})">✅ تۆمارکردنی پارەدان</button>
                ` : ''}
                <div style="display:flex;gap:8px;margin-top:10px;">
                    <button class="btn btn-outline" style="flex:1;" onclick='Pages.printInvoice(${JSON.stringify(sale)})'>🖨️ چاپکردن</button>
                    <button class="btn btn-outline" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">داخستن</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
    },

    // Part 13 — INVOICES: تۆمارکردنی پارەدانی زیاتر — هەمان endpoint ی
    // PATCH /api/Sales/{id}/payment. سەرکەوتوو بوو، دیالۆگەکە دادەخرێت
    // و لیستی فرۆشتن دووبارە بار دەکرێتەوە تا دۆخی نوێ بگاتێ.
    async recordSalePayment(saleId) {
        const input = document.getElementById('payAmount_' + saleId);
        const amount = parseFloat(input?.value || '0');
        if (!amount || amount <= 0) {
            alert('تکایە بڕێکی دروست (لە سفر گەورەتر) بنووسە.');
            return;
        }

        try {
            await Api.recordSalePayment(saleId, amount);
            document.getElementById('saleDetailModal')?.remove();
            Pages.sales(this._salesFilters || {});
        } catch (err) {
            alert('نەتوانرا پارەدانەکە تۆمار بکرێت:\n' + err.message);
        }
    },

    // Part 13 — INVOICES: نمایشی فۆرمی چاپکردن — پەڕەیەکی نوێی سادە
    // دەکرێتەوە و window.print() خۆکارانە بانگ دەکرێت، وەک ئەوپەڕی
    // سادەترین "printable representation" بۆ وێبی (بەبێ هیچ لۆجیکی
    // ESC/POS یان کتێبخانەی PDF ی زیادە).
    printInvoice(sale) {
        const itemsRows = (sale.items || []).map(i => `
            <tr>
                <td>${App.escapeHtml(i.productName)}</td>
                <td style="text-align:center;">${i.quantity}</td>
                <td style="text-align:center;">${App.fmtMoney(i.price)}</td>
                <td style="text-align:left;">${App.fmtMoney(i.price * i.quantity)}</td>
            </tr>`).join('');

        const amountDue = Math.max((sale.total || 0) - (sale.amountPaid || 0), 0);
        const paymentStateText = sale.paymentState === 'Partial' ? 'بەشێک دراوە'
            : sale.paymentState === 'Unpaid' ? 'هیچ نەدراوە' : 'دراوە بە تەواوی';

        const win = window.open('', '_blank');
        if (!win) { alert('وێبگەڕەکەت ڕێگری کرد لە کردنەوەی پەنجەرەی چاپکردن.'); return; }

        win.document.write(`
            <html dir="rtl" lang="ku">
            <head>
                <meta charset="utf-8">
                <title>${App.escapeHtml(sale.invoiceNumber || ('وەصڵ #' + sale.id))}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 30px; color: #17332E; }
                    h1 { font-size: 20px; margin-bottom: 4px; }
                    .muted { color: #71807B; font-size: 13px; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
                    th, td { padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px; }
                    th { text-align: right; background: #f6f6f6; }
                    .totals p { font-size: 14px; margin: 4px 0; }
                    .totals .grand { font-size: 20px; font-weight: bold; }
                </style>
            </head>
            <body onload="window.print()">
                <h1>${App.escapeHtml(sale.invoiceNumber || ('وەصڵ #' + sale.id))}</h1>
                <p class="muted">${App.fmtDate(sale.date)} — فرۆشیار: ${App.escapeHtml(sale.soldBy || '')}</p>
                <table>
                    <thead><tr><th>کاڵا</th><th>بڕ</th><th>نرخ</th><th>کۆ</th></tr></thead>
                    <tbody>${itemsRows}</tbody>
                </table>
                <div class="totals">
                    <p>داشکاندن: ${App.fmtMoney(sale.discount)}</p>
                    <p class="grand">کۆی گشتی: ${App.fmtMoney(sale.total)}</p>
                    <p>دۆخی پارەدان: ${paymentStateText}</p>
                    ${sale.paymentState !== 'Paid' ? `<p>دراوە: ${App.fmtMoney(sale.amountPaid)} — ماوە: ${App.fmtMoney(amountDue)}</p>` : ''}
                </div>
            </body>
            </html>`);
        win.document.close();
    },

    // ============ کڕین ============
    async purchases(filters) {
        App.setContent(App.loadingHtml());
        const f = filters || this._purchaseFilters || {};
        this._purchaseFilters = f;
        const canReceive = ['Admin', 'DataEntry'].includes(Api.getRole());

        try {
            const purchases = await Api.getPurchases(f);

            let html = `<h2 class="page-title">📥 کڕین</h2>
                <div class="filter-bar">
                    <div class="form-row"><label>گەڕان بە دابینکەر</label><input type="text" id="puSupplier" value="${App.escapeHtml(f.supplier || '')}"></div>
                    <button class="btn btn-primary" onclick="Pages.applyPurchaseFilter()">گەڕان</button>
                    ${canReceive ? `<button class="btn btn-accent" onclick="Pages.showPurchaseForm()">➕ کڕینی نوێ</button>` : ''}
                </div>`;

            if (purchases.length === 0) {
                html += App.emptyHtml('هیچ کڕینێک تۆمار نەکراوە');
            } else {
                html += `<div class="row-list">`;
                for (const p of purchases) {
                    html += `<div class="row-item">
                        <div class="row-icon">📥</div>
                        <div class="row-main">
                            <div class="row-title">${App.escapeHtml(p.supplierName || 'بێ ناوی دابینکەر')}</div>
                            <div class="row-sub">${App.escapeHtml(p.referenceNumber || '—')} · ${App.fmtDate(p.date)} · ${App.escapeHtml(p.createdBy)}</div>
                        </div>
                        <div class="row-col"><div class="n">${(p.items || []).length}</div><div class="l">کاڵا</div></div>
                        <div class="row-total">${App.fmtMoney(p.total)}</div>
                    </div>`;
                }
                html += `</div>`;
            }

            App.setContent(html);
        } catch (err) {
            App.setContent(App.errorHtml(err));
        }
    },

    applyPurchaseFilter() {
        this.purchases({ supplier: document.getElementById('puSupplier').value.trim() });
    },

    async showPurchaseForm() {
        this._purchaseCart = [];
        const products = await Api.getProducts().catch(() => []);
        this._purchaseProducts = products;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'purchaseModal';
        overlay.innerHTML = `
            <div class="modal-box" style="max-width:560px;">
                <h3>➕ کڕینی نوێ</h3>
                <div id="purchaseFormError" class="alert alert-danger" style="display:none;"></div>
                <div class="form-row"><label>ناوی دابینکەر</label><input id="pu_supplier"></div>
                <div class="form-row"><label>ژمارەی وەصڵ</label><input id="pu_reference"></div>
                <div class="form-row">
                    <label>زیادکردنی کاڵا</label>
                    <select id="pu_productSelect">
                        <option value="">-- کاڵا هەڵبژێرە --</option>
                        ${products.map(p => `<option value="${p.id}">${App.escapeHtml(p.name)} (کۆگا: ${p.quantity})</option>`).join('')}
                    </select>
                </div>
                <button class="btn btn-outline btn-small" onclick="Pages.addPurchaseItem()">➕ زیادکردنی ئەم کاڵایە</button>
                <div id="purchaseItemsList" style="margin-top:10px;"></div>
                <div class="form-row" style="margin-top:12px;"><label>داشکاندن</label><input id="pu_discount" type="number" step="0.01" value="0" oninput="Pages.renderPurchaseItems()"></div>
                <p id="pu_total" style="font-size:16px;font-weight:bold;color:var(--primary-dark);"></p>
                <div style="display:flex;gap:8px;">
                    <button class="btn btn-primary" style="flex:1;" onclick="Pages.savePurchase()">✅ پەسەندکردن</button>
                    <button class="btn btn-outline" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">پاشگەزبوونەوە</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        this.renderPurchaseItems();
    },

    addPurchaseItem() {
        const select = document.getElementById('pu_productSelect');
        const id = parseInt(select.value);
        if (!id) return;
        const product = this._purchaseProducts.find(p => p.id === id);
        if (!product) return;

        const existing = this._purchaseCart.find(i => i.productId === id);
        if (existing) existing.quantity += 1;
        else this._purchaseCart.push({ productId: id, productName: product.name, quantity: 1, costPrice: product.costPrice || 0 });

        this.renderPurchaseItems();
    },

    removePurchaseItem(id) {
        this._purchaseCart = this._purchaseCart.filter(i => i.productId !== id);
        this.renderPurchaseItems();
    },

    updatePurchaseItem(id, field, value) {
        const item = this._purchaseCart.find(i => i.productId === id);
        if (item) item[field] = parseFloat(value) || 0;
        this.renderPurchaseItems();
    },

    renderPurchaseItems() {
        const container = document.getElementById('purchaseItemsList');
        if (!container) return;

        if (this._purchaseCart.length === 0) {
            container.innerHTML = `<p class="text-muted" style="font-size:13px;">هێشتا هیچ کاڵایەک زیاد نەکراوە</p>`;
        } else {
            container.innerHTML = `<div class="mini-row-list">` +
                this._purchaseCart.map(i => `
                    <div class="mini-row">
                        <div class="mr-name">${App.escapeHtml(i.productName)}</div>
                        <div class="mr-field"><input type="number" value="${i.quantity}" onchange="Pages.updatePurchaseItem(${i.productId},'quantity',this.value)"></div>
                        <div class="mr-field"><input type="number" step="0.01" value="${i.costPrice}" onchange="Pages.updatePurchaseItem(${i.productId},'costPrice',this.value)"></div>
                        <button class="btn btn-danger btn-small" onclick="Pages.removePurchaseItem(${i.productId})">✕</button>
                    </div>
                `).join('') + `</div>`;
        }

        const subtotal = this._purchaseCart.reduce((s, i) => s + i.quantity * i.costPrice, 0);
        const discount = parseFloat(document.getElementById('pu_discount')?.value) || 0;
        const total = Math.max(subtotal - discount, 0);
        const totalEl = document.getElementById('pu_total');
        if (totalEl) totalEl.textContent = `کۆی گشتی: ${App.fmtMoney(total)} (کۆی پێش داشکاندن: ${App.fmtMoney(subtotal)})`;
    },

    async savePurchase() {
        const errBox = document.getElementById('purchaseFormError');
        if (this._purchaseCart.length === 0) {
            errBox.textContent = 'پێویستە هەر لانیکەم یەک کاڵا زیاد بکەیت.';
            errBox.style.display = 'block';
            return;
        }

        const payload = {
            supplierName: document.getElementById('pu_supplier').value.trim(),
            referenceNumber: document.getElementById('pu_reference').value.trim(),
            discount: parseFloat(document.getElementById('pu_discount').value) || 0,
            notes: '',
            items: this._purchaseCart.map(i => ({ productId: i.productId, quantity: i.quantity, costPrice: i.costPrice })),
            clientRequestId: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()
        };

        try {
            await Api.receivePurchase(payload);
            document.getElementById('purchaseModal')?.remove();
            this.purchases();
        } catch (err) {
            errBox.textContent = err.message;
            errBox.style.display = 'block';
        }
    },

    // ============ خەرجی ============
    async expenses() {
        App.setContent(App.loadingHtml());
        try {
            const expenses = await Api.getExpenses();

            let html = `<h2 class="page-title">💰 خەرجی</h2>
                <div class="filter-bar">
                    <button class="btn btn-accent" onclick="Pages.showExpenseForm()">➕ زیادکردنی خەرجی</button>
                </div>`;

            if (expenses.length === 0) {
                html += App.emptyHtml('هیچ خەرجییەک تۆمار نەکراوە');
            } else {
                html += `<div class="row-list">`;
                for (const e of expenses) {
                    html += `<div class="row-item">
                        <div class="row-icon">💰</div>
                        <div class="row-main">
                            <div class="row-title">${App.escapeHtml(e.title)}</div>
                            <div class="row-sub">${App.escapeHtml(e.category || 'بێ پۆل')} · ${App.fmtDate(e.date)}</div>
                        </div>
                        ${e.isLinkedToPurchase ? `<span class="badge">📥 پەیوەست بە کڕین</span>` : ''}
                        <div class="row-total">${App.fmtMoney(e.amount)}</div>
                    </div>`;
                }
                html += `</div>`;
            }

            App.setContent(html);
        } catch (err) {
            App.setContent(App.errorHtml(err));
        }
    },

    showExpenseForm() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-box">
                <h3>➕ زیادکردنی خەرجی</h3>
                <div id="expenseFormError" class="alert alert-danger" style="display:none;"></div>
                <div class="form-row"><label>ناونیشان</label><input id="ex_title"></div>
                <div class="form-row"><label>پۆل</label><input id="ex_category"></div>
                <div class="form-row"><label>بڕ</label><input id="ex_amount" type="number" step="0.01"></div>
                <div class="form-row"><label>تێبینی</label><textarea id="ex_note"></textarea></div>
                <div style="display:flex;gap:8px;margin-top:14px;">
                    <button class="btn btn-primary" style="flex:1;" onclick="Pages.saveExpense()">پاشەکەوتکردن</button>
                    <button class="btn btn-outline" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">پاشگەزبوونەوە</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
    },

    async saveExpense() {
        const errBox = document.getElementById('expenseFormError');
        const expense = {
            title: document.getElementById('ex_title').value.trim(),
            category: document.getElementById('ex_category').value.trim(),
            amount: parseFloat(document.getElementById('ex_amount').value) || 0,
            note: document.getElementById('ex_note').value.trim(),
            date: new Date().toISOString()
        };

        if (!expense.title || expense.amount <= 0) {
            errBox.textContent = 'ناونیشان و بڕی گونجاو پێویستە.';
            errBox.style.display = 'block';
            return;
        }

        try {
            await Api.createExpense(expense);
            document.querySelector('.modal-overlay')?.remove();
            this.expenses();
        } catch (err) {
            errBox.textContent = err.message;
            errBox.style.display = 'block';
        }
    },

    // ============ ڕاپۆرت ============
    async reports(range) {
        const today = new Date().toISOString().slice(0, 10);
        const r = range || { from: today, to: today };

        let html = `<h2 class="page-title">📊 ڕاپۆرت</h2>
            <div class="filter-bar">
                <div class="form-row"><label>لە بەرواری</label><input type="date" id="rFrom" value="${r.from}"></div>
                <div class="form-row"><label>بۆ بەرواری</label><input type="date" id="rTo" value="${r.to}"></div>
                <button class="btn btn-primary" onclick="Pages.applyReportFilter()">پیشاندان</button>
                <button class="btn btn-outline btn-small" onclick="Pages.reportPreset('today')">ئەمڕۆ</button>
                <button class="btn btn-outline btn-small" onclick="Pages.reportPreset('week')">ئەم هەفتەیە</button>
                <button class="btn btn-outline btn-small" onclick="Pages.reportPreset('month')">ئەم مانگە</button>
            </div>
            <div id="reportResults">${App.loadingHtml()}</div>`;

        App.setContent(html);

        try {
            const report = await Api.getReport(r.from, r.to);
            let resultsHtml = `<div class="kpi-grid">
                <div class="kpi-card"><div class="kpi-label">💰 داهات</div><div class="kpi-value">${App.fmtMoney(report.totalRevenue)}</div></div>
                <div class="kpi-card"><div class="kpi-label">🧾 ژمارەی فرۆشتن</div><div class="kpi-value">${report.salesCount}</div></div>
                <div class="kpi-card"><div class="kpi-label">📦 تێچووی کاڵا (COGS)</div><div class="kpi-value">${App.fmtMoney(report.costOfGoodsSold)}</div></div>
                <div class="kpi-card"><div class="kpi-label">💸 خەرجی</div><div class="kpi-value">${App.fmtMoney(report.expensesTotal)}</div></div>
                <div class="kpi-card"><div class="kpi-label">📈 سوودی پوخت</div><div class="kpi-value">${App.fmtMoney(report.netProfit)}</div></div>
            </div>`;

            if (report.topProducts && report.topProducts.length > 0) {
                resultsHtml += `<div class="card"><h3>🏆 باشترین کاڵا فرۆشراو</h3>
                    <div class="row-list">` +
                    report.topProducts.map(p => `
                        <div class="row-item">
                            <div class="row-icon">🏆</div>
                            <div class="row-main"><div class="row-title">${App.escapeHtml(p.name)}</div></div>
                            <div class="row-col"><div class="n">${p.quantitySold}</div><div class="l">بڕ</div></div>
                            <div class="row-total">${App.fmtMoney(p.revenue)}</div>
                        </div>
                    `).join('') + `</div></div>`;
            }

            document.getElementById('reportResults').innerHTML = resultsHtml;
        } catch (err) {
            document.getElementById('reportResults').innerHTML = App.errorHtml(err);
        }
    },

    applyReportFilter() {
        this.reports({ from: document.getElementById('rFrom').value, to: document.getElementById('rTo').value });
    },

    reportPreset(preset) {
        const today = new Date();
        let from = new Date(today);
        if (preset === 'week') {
            const diff = (7 + (today.getDay() - 6)) % 7; // شەممە دەستپێکردنی هەفتە
            from.setDate(today.getDate() - diff);
        } else if (preset === 'month') {
            from = new Date(today.getFullYear(), today.getMonth(), 1);
        }
        const fmt = d => d.toISOString().slice(0, 10);
        this.reports({ from: fmt(from), to: fmt(today) });
    },

    // ============ بەکارهێنەران ============
    async users() {
        App.setContent(App.loadingHtml());
        try {
            const users = await Api.getUsers();

            let html = `<h2 class="page-title">👤 بەکارهێنەران</h2>
                <div class="filter-bar"><button class="btn btn-accent" onclick="Pages.showUserForm()">➕ زیادکردنی بەکارهێنەر</button></div>
                <div class="row-list">`;

            for (const u of users) {
                html += `<div class="row-item">
                    <div class="row-icon">${App.escapeHtml((u.username || '?').charAt(0).toUpperCase())}</div>
                    <div class="row-main"><div class="row-title">${App.escapeHtml(u.username)}</div></div>
                    <span class="badge">${App.escapeHtml(App.roleLabel ? App.roleLabel(u.role) : u.role)}</span>
                    <div class="row-actions">
                        <button class="btn btn-outline btn-small" onclick='Pages.showUserForm(${JSON.stringify(u)})'>دەستکاری</button>
                        ${u.username !== 'admin' ? `<button class="btn btn-danger btn-small" onclick="Pages.deleteUser(${u.id}, '${App.escapeHtml(u.username)}')">سڕینەوە</button>` : ''}
                    </div>
                </div>`;
            }
            html += `</div>`;

            App.setContent(html);
        } catch (err) {
            App.setContent(App.errorHtml(err));
        }
    },

    showUserForm(user) {
        const u = user || { id: 0, username: '', role: 'Cashier' };
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-box">
                <h3>${u.id ? 'دەستکاریکردنی بەکارهێنەر' : 'زیادکردنی بەکارهێنەر'}</h3>
                <div id="userFormError" class="alert alert-danger" style="display:none;"></div>
                <div class="form-row"><label>ناوی بەکارهێنەر</label><input id="uf_username" value="${App.escapeHtml(u.username)}"></div>
                <div class="form-row"><label>ڕۆڵ</label>
                    <select id="uf_role">
                        ${['Admin', 'Cashier', 'DataEntry', 'Accountant'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}
                    </select>
                </div>
                <div class="form-row"><label>وشەی نهێنی ${u.id ? '(بەتاڵی بهێڵەرەوە ئەگەر نایگۆڕیت)' : ''}</label><input id="uf_password" type="password"></div>
                <div style="display:flex;gap:8px;margin-top:14px;">
                    <button class="btn btn-primary" style="flex:1;" onclick="Pages.saveUser(${u.id})">پاشەکەوتکردن</button>
                    <button class="btn btn-outline" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">پاشگەزبوونەوە</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
    },

    async saveUser(id) {
        const errBox = document.getElementById('userFormError');
        const payload = {
            id: id || 0,
            username: document.getElementById('uf_username').value.trim(),
            role: document.getElementById('uf_role').value,
            password: document.getElementById('uf_password').value || null
        };

        if (!payload.username || (!id && !payload.password)) {
            errBox.textContent = 'ناوی بەکارهێنەر و وشەی نهێنی (بۆ بەکارهێنەری نوێ) پێویستە.';
            errBox.style.display = 'block';
            return;
        }

        try {
            await Api.saveUser(payload);
            document.querySelector('.modal-overlay')?.remove();
            this.users();
        } catch (err) {
            errBox.textContent = err.message;
            errBox.style.display = 'block';
        }
    },

    async deleteUser(id, username) {
        if (!confirm(`دڵنیایت لە سڕینەوەی بەکارهێنەری "${username}"؟`)) return;
        try {
            await Api.deleteUser(id);
            this.users();
        } catch (err) {
            alert(err.message);
        }
    },

    // ============ کڕیاران (Part 13 — یەکەم ڕوکاری وێبی ئەم مۆدیوولە.
    // API ـەکە پێشتر لە session ـێکی پێشووتر تەواو بوو، بەڵام هیچ
    // پەڕەیەکی WebAdmin بۆی نەبوو — بەکارهێنەر نەیدەتوانی هیچ کڕیارێک
    // زیاد بکات لە هیچ کام لە ئەپەکانەوە. ئەم پەڕەیە هەمان شێوازی
    // "کاڵاکان" ـە.) ============
    async customers(search) {
        App.setContent(App.loadingHtml());
        try {
            const customers = await Api.getCustomers(search);
            const canEdit = ['Admin', 'DataEntry'].includes(Api.getRole());
            const canDelete = Api.getRole() === 'Admin';

            let html = `<h2 class="page-title">🧑‍🤝‍🧑 کڕیاران</h2>
                <div class="filter-bar">
                    <div class="form-row" style="flex:1;min-width:200px;">
                        <input type="text" id="customerSearch" placeholder="گەڕان بە ناو/ژمارەی مۆبایل..." value="${App.escapeHtml(search || '')}">
                    </div>
                    <button class="btn btn-primary" onclick="Pages.searchCustomers()">گەڕان</button>
                    ${canEdit ? `<button class="btn btn-accent" onclick="Pages.showCustomerForm()">➕ زیادکردنی کڕیار</button>` : ''}
                </div>`;

            if (customers.length === 0) {
                html += App.emptyHtml('هیچ کڕیارێک تۆمار نەکراوە');
            } else {
                html += `<div class="row-list">`;
                for (const c of customers) {
                    html += `<div class="row-item">
                        <div class="row-icon">🧑</div>
                        <div class="row-main">
                            <div class="row-title">${App.escapeHtml(c.name)}</div>
                            <div class="row-sub">${App.escapeHtml(c.phone || 'بێ ژمارە')} ${c.address ? '· ' + App.escapeHtml(c.address) : ''}</div>
                        </div>
                        <div class="row-actions">
                            <button class="btn btn-outline btn-small" onclick="Pages.showCustomerHistory(${c.id}, '${App.escapeHtml(c.name)}')">مێژوو</button>
                            ${canEdit ? `<button class="btn btn-outline btn-small" onclick='Pages.showCustomerForm(${JSON.stringify(c)})'>دەستکاری</button>` : ''}
                            ${canDelete ? `<button class="btn btn-danger btn-small" onclick="Pages.deleteCustomer(${c.id}, '${App.escapeHtml(c.name)}')">سڕینەوە</button>` : ''}
                        </div>
                    </div>`;
                }
                html += `</div>`;
            }

            App.setContent(html);
            document.getElementById('customerSearch')?.addEventListener('keydown', e => {
                if (e.key === 'Enter') this.searchCustomers();
            });
        } catch (err) {
            App.setContent(App.errorHtml(err));
        }
    },

    searchCustomers() {
        this.customers(document.getElementById('customerSearch').value.trim());
    },

    showCustomerForm(customer) {
        const c = customer || { id: 0, name: '', phone: '', address: '', notes: '' };
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-box">
                <h3>${c.id ? 'دەستکاریکردنی کڕیار' : 'زیادکردنی کڕیار'}</h3>
                <div id="customerFormError" class="alert alert-danger" style="display:none;"></div>
                <div class="form-row"><label>ناو</label><input id="cf_name" value="${App.escapeHtml(c.name)}"></div>
                <div class="form-row"><label>ژمارەی مۆبایل</label><input id="cf_phone" value="${App.escapeHtml(c.phone)}"></div>
                <div class="form-row"><label>ناونیشان</label><input id="cf_address" value="${App.escapeHtml(c.address)}"></div>
                <div class="form-row"><label>تێبینی</label><textarea id="cf_notes">${App.escapeHtml(c.notes)}</textarea></div>
                <div style="display:flex;gap:8px;margin-top:14px;">
                    <button class="btn btn-primary" style="flex:1;" onclick="Pages.saveCustomer(${c.id})">پاشەکەوتکردن</button>
                    <button class="btn btn-outline" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">پاشگەزبوونەوە</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
    },

    async saveCustomer(id) {
        const errBox = document.getElementById('customerFormError');
        const customer = {
            id: id || 0,
            name: document.getElementById('cf_name').value.trim(),
            phone: document.getElementById('cf_phone').value.trim(),
            address: document.getElementById('cf_address').value.trim(),
            notes: document.getElementById('cf_notes').value.trim()
        };

        if (!customer.name) {
            errBox.textContent = 'ناوی کڕیار پێویستە.';
            errBox.style.display = 'block';
            return;
        }

        try {
            if (id) {
                await Api.updateCustomer(id, customer);
            } else {
                await Api.createCustomer(customer);
            }
            document.querySelector('.modal-overlay')?.remove();
            this.customers();
        } catch (err) {
            errBox.textContent = err.message;
            errBox.style.display = 'block';
        }
    },

    async deleteCustomer(id, name) {
        if (!confirm(`دڵنیایت لە سڕینەوەی کڕیاری "${name}"؟`)) return;
        try {
            await Api.deleteCustomer(id);
            this.customers();
        } catch (err) {
            alert(err.message);
        }
    },

    async showCustomerHistory(id, name) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal-box"><h3>مێژووی کڕیار: ${App.escapeHtml(name)}</h3>${App.loadingHtml()}</div>`;
        document.body.appendChild(overlay);

        try {
            const sales = await Api.getCustomerSales(id);
            const total = sales.reduce((s, x) => s + x.total, 0);
            let html = `<div class="modal-box">
                <h3>مێژووی کڕیار: ${App.escapeHtml(name)}</h3>
                <div class="kpi-grid">
                    <div class="kpi-card"><div class="kpi-label">وەصڵ</div><div class="kpi-value">${sales.length}</div></div>
                    <div class="kpi-card"><div class="kpi-label">کۆی گشتی</div><div class="kpi-value">${App.fmtMoney(total)}</div></div>
                </div>`;
            if (sales.length === 0) {
                html += App.emptyHtml('هیچ فرۆشتنێک بۆ ئەم کڕیارە تۆمار نەکراوە');
            } else {
                html += `<div class="row-list">` + sales.map(s => `
                    <div class="row-item">
                        <div class="row-icon">🧾</div>
                        <div class="row-main"><div class="row-title">وەصڵ #${s.id}</div><div class="row-sub">${App.fmtDate(s.date)}</div></div>
                        <div class="row-total">${App.fmtMoney(s.total)}</div>
                    </div>`).join('') + `</div>`;
            }
            html += `<button class="btn btn-outline btn-block" style="margin-top:14px;" onclick="this.closest('.modal-overlay').remove()">داخستن</button></div>`;
            overlay.innerHTML = html;
        } catch (err) {
            overlay.innerHTML = `<div class="modal-box">${App.errorHtml(err)}
                <button class="btn btn-outline btn-block" style="margin-top:14px;" onclick="this.closest('.modal-overlay').remove()">داخستن</button></div>`;
        }
    },

    // ============ دابینکەران (Part 13 — یەکەم ڕوکاری وێبی ئەم
    // مۆدیوولە، هەمان شێوازی کڕیاران) ============
    async suppliers(search) {
        App.setContent(App.loadingHtml());
        try {
            const suppliers = await Api.getSuppliers(search);
            const canEdit = ['Admin', 'DataEntry'].includes(Api.getRole());
            const canDelete = Api.getRole() === 'Admin';

            let html = `<h2 class="page-title">🚚 دابینکەران</h2>
                <div class="filter-bar">
                    <div class="form-row" style="flex:1;min-width:200px;">
                        <input type="text" id="supplierSearch" placeholder="گەڕان بە ناو/ژمارەی مۆبایل..." value="${App.escapeHtml(search || '')}">
                    </div>
                    <button class="btn btn-primary" onclick="Pages.searchSuppliers()">گەڕان</button>
                    ${canEdit ? `<button class="btn btn-accent" onclick="Pages.showSupplierForm()">➕ زیادکردنی دابینکەر</button>` : ''}
                </div>`;

            if (suppliers.length === 0) {
                html += App.emptyHtml('هیچ دابینکەرێک تۆمار نەکراوە');
            } else {
                html += `<div class="row-list">`;
                for (const s of suppliers) {
                    html += `<div class="row-item">
                        <div class="row-icon">🚚</div>
                        <div class="row-main">
                            <div class="row-title">${App.escapeHtml(s.name)}</div>
                            <div class="row-sub">${App.escapeHtml(s.phone || 'بێ ژمارە')} ${s.address ? '· ' + App.escapeHtml(s.address) : ''}</div>
                        </div>
                        <div class="row-actions">
                            <button class="btn btn-outline btn-small" onclick="Pages.showSupplierHistory(${s.id}, '${App.escapeHtml(s.name)}')">مێژوو</button>
                            ${canEdit ? `<button class="btn btn-outline btn-small" onclick='Pages.showSupplierForm(${JSON.stringify(s)})'>دەستکاری</button>` : ''}
                            ${canDelete ? `<button class="btn btn-danger btn-small" onclick="Pages.deleteSupplier(${s.id}, '${App.escapeHtml(s.name)}')">سڕینەوە</button>` : ''}
                        </div>
                    </div>`;
                }
                html += `</div>`;
            }

            App.setContent(html);
            document.getElementById('supplierSearch')?.addEventListener('keydown', e => {
                if (e.key === 'Enter') this.searchSuppliers();
            });
        } catch (err) {
            App.setContent(App.errorHtml(err));
        }
    },

    searchSuppliers() {
        this.suppliers(document.getElementById('supplierSearch').value.trim());
    },

    showSupplierForm(supplier) {
        const s = supplier || { id: 0, name: '', phone: '', address: '', notes: '' };
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-box">
                <h3>${s.id ? 'دەستکاریکردنی دابینکەر' : 'زیادکردنی دابینکەر'}</h3>
                <div id="supplierFormError" class="alert alert-danger" style="display:none;"></div>
                <div class="form-row"><label>ناو</label><input id="sf_name" value="${App.escapeHtml(s.name)}"></div>
                <div class="form-row"><label>ژمارەی مۆبایل</label><input id="sf_phone" value="${App.escapeHtml(s.phone)}"></div>
                <div class="form-row"><label>ناونیشان</label><input id="sf_address" value="${App.escapeHtml(s.address)}"></div>
                <div class="form-row"><label>تێبینی</label><textarea id="sf_notes">${App.escapeHtml(s.notes)}</textarea></div>
                <div style="display:flex;gap:8px;margin-top:14px;">
                    <button class="btn btn-primary" style="flex:1;" onclick="Pages.saveSupplier(${s.id})">پاشەکەوتکردن</button>
                    <button class="btn btn-outline" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">پاشگەزبوونەوە</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
    },

    async saveSupplier(id) {
        const errBox = document.getElementById('supplierFormError');
        const supplier = {
            id: id || 0,
            name: document.getElementById('sf_name').value.trim(),
            phone: document.getElementById('sf_phone').value.trim(),
            address: document.getElementById('sf_address').value.trim(),
            notes: document.getElementById('sf_notes').value.trim()
        };

        if (!supplier.name) {
            errBox.textContent = 'ناوی دابینکەر پێویستە.';
            errBox.style.display = 'block';
            return;
        }

        try {
            if (id) {
                await Api.updateSupplier(id, supplier);
            } else {
                await Api.createSupplier(supplier);
            }
            document.querySelector('.modal-overlay')?.remove();
            this.suppliers();
        } catch (err) {
            errBox.textContent = err.message;
            errBox.style.display = 'block';
        }
    },

    async deleteSupplier(id, name) {
        if (!confirm(`دڵنیایت لە سڕینەوەی دابینکەری "${name}"؟`)) return;
        try {
            await Api.deleteSupplier(id);
            this.suppliers();
        } catch (err) {
            alert(err.message);
        }
    },

    async showSupplierHistory(id, name) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal-box"><h3>مێژووی دابینکەر: ${App.escapeHtml(name)}</h3>${App.loadingHtml()}</div>`;
        document.body.appendChild(overlay);

        try {
            const purchases = await Api.getSupplierPurchases(id);
            const total = purchases.reduce((s, x) => s + x.total, 0);
            let html = `<div class="modal-box">
                <h3>مێژووی دابینکەر: ${App.escapeHtml(name)}</h3>
                <div class="kpi-grid">
                    <div class="kpi-card"><div class="kpi-label">کڕین</div><div class="kpi-value">${purchases.length}</div></div>
                    <div class="kpi-card"><div class="kpi-label">کۆی گشتی</div><div class="kpi-value">${App.fmtMoney(total)}</div></div>
                </div>`;
            if (purchases.length === 0) {
                html += App.emptyHtml('هیچ کڕینێک لەم دابینکەرەوە تۆمار نەکراوە');
            } else {
                html += `<div class="row-list">` + purchases.map(p => `
                    <div class="row-item">
                        <div class="row-icon">📥</div>
                        <div class="row-main"><div class="row-title">${App.escapeHtml(p.referenceNumber || ('کڕین #' + p.id))}</div><div class="row-sub">${App.fmtDate(p.date)}</div></div>
                        <div class="row-total">${App.fmtMoney(p.total)}</div>
                    </div>`).join('') + `</div>`;
            }
            html += `<button class="btn btn-outline btn-block" style="margin-top:14px;" onclick="this.closest('.modal-overlay').remove()">داخستن</button></div>`;
            overlay.innerHTML = html;
        } catch (err) {
            overlay.innerHTML = `<div class="modal-box">${App.errorHtml(err)}
                <button class="btn btn-outline btn-block" style="margin-top:14px;" onclick="this.closest('.modal-overlay').remove()">داخستن</button></div>`;
        }
    },

    // ============ تۆماری چالاکی ============
    async activitylog() {
        App.setContent(App.loadingHtml());
        try {
            const logs = await Api.getActivityLog();

            let html = `<h2 class="page-title">📜 تۆماری چالاکی</h2>`;
            if (logs.length === 0) {
                html += App.emptyHtml('هیچ تۆمارێک نییە');
            } else {
                html += `<div class="row-list">` + logs.map(l => `
                    <div class="row-item">
                        <div class="row-icon gray">📜</div>
                        <div class="row-main">
                            <div class="row-title">${App.escapeHtml(l.action)}</div>
                            <div class="row-sub">${App.escapeHtml(l.username)} · ${App.fmtDate(l.date)}</div>
                        </div>
                    </div>
                `).join('') + `</div>`;
            }

            App.setContent(html);
        } catch (err) {
            App.setContent(App.errorHtml(err));
        }
    },

    // ============ ڕێکخستنەکان (باتچ ٤) — پێشتر backend ـی
    // TenantController.GetSettings/UpdateSettings هەبوو بەڵام هیچ
    // پەڕەیەکی WebAdmin ـی نەبوو کە بیخوێنێتەوە/بگۆڕێت. هەموو
    // بەکارهێنەرێکی چوونەژووردەرو دەتوانێت ببینێت (هەمان شێوازی
    // GetSettings ـی سێرڤەر کە [Authorize] ـی سادەیە)، بەڵام تەنها
    // Admin دەتوانێت بگۆڕێت (UpdateSettings سێرڤەر خۆی
    // [Authorize(Roles = "Admin")] ـە — ئێرەش هەمان سنوورە لە ڕوکاردا). ============
    async settings() {
        App.setContent(App.loadingHtml());
        try {
            const s = await Api.getTenantSettings();
            const canEdit = Api.getRole() === 'Admin';

            let html = `<h2 class="page-title">⚙️ ڕێکخستنەکان</h2>
                <div id="settingsError" class="alert alert-danger" style="display:none;"></div>
                <div id="settingsSuccess" class="alert alert-success" style="display:none;"></div>
                <div class="card" style="max-width:480px;">
                    <div class="form-row"><label>ناوی فرۆشگا</label>
                        <input id="st_storeName" value="${App.escapeHtml(s.storeName)}" ${canEdit ? '' : 'disabled'}></div>
                    <div class="form-row"><label>ناونیشان</label>
                        <input id="st_address" value="${App.escapeHtml(s.address)}" ${canEdit ? '' : 'disabled'}></div>
                    <div class="form-row"><label>ژمارەی مۆبایل</label>
                        <input id="st_phone" value="${App.escapeHtml(s.phone)}" ${canEdit ? '' : 'disabled'}></div>
                    <div class="form-row"><label>پلانی بەشداری</label>
                        <input value="${App.escapeHtml(s.planName)}" disabled></div>
                    ${canEdit ? `<button class="btn btn-primary" style="margin-top:10px;" onclick="Pages.saveTenantSettings()">پاشەکەوتکردن</button>`
                        : `<p class="row-sub" style="margin-top:10px;">تەنها بەڕێوەبەر (Admin) دەتوانێت ئەم زانیاریانە بگۆڕێت.</p>`}
                </div>`;

            App.setContent(html);
        } catch (err) {
            App.setContent(App.errorHtml(err));
        }
    },

    async saveTenantSettings() {
        const errBox = document.getElementById('settingsError');
        const okBox = document.getElementById('settingsSuccess');
        errBox.style.display = 'none';
        okBox.style.display = 'none';

        const payload = {
            storeName: document.getElementById('st_storeName').value.trim(),
            address: document.getElementById('st_address').value.trim(),
            phone: document.getElementById('st_phone').value.trim()
        };

        if (!payload.storeName) {
            errBox.textContent = 'ناوی فرۆشگا پێویستە.';
            errBox.style.display = 'block';
            return;
        }

        try {
            const updated = await Api.updateTenantSettings(payload);
            localStorage.setItem('storeName', updated.storeName);
            document.getElementById('storeNameLabel').textContent = updated.storeName;
            okBox.textContent = 'زانیارییەکان بە سەرکەوتووی پاشەکەوتکران.';
            okBox.style.display = 'block';
        } catch (err) {
            errBox.textContent = err.message;
            errBox.style.display = 'block';
        }
    }
});
