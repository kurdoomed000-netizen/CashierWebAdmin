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

            let html = `<h2 class="page-title">🕓 ${I18n.t('sales.title')}</h2>
                <div class="filter-bar">
                    <div class="form-row"><label>${I18n.t('common.fromDate')}</label><input type="date" id="sFrom" value="${f.from || ''}"></div>
                    <div class="form-row"><label>${I18n.t('common.toDate')}</label><input type="date" id="sTo" value="${f.to || ''}"></div>
                    <div class="form-row"><label>${I18n.t('sales.searchLabel')}</label><input type="text" id="sSearch" value="${App.escapeHtml(f.search || '')}"></div>
                    <button class="btn btn-primary" onclick="Pages.applySalesFilter()">${I18n.t('common.filter')}</button>
                    <button class="btn btn-outline" onclick="Pages.sales({})">${I18n.t('common.clearFilter')}</button>
                </div>`;

            if (salesArr.length === 0) {
                html += App.emptyHtml(I18n.t('sales.none'));
            } else {
                const totalRevenue = salesArr.reduce((sum, s) => sum + s.total, 0);
                html += `<div class="kpi-grid">
                    <div class="kpi-card"><div class="kpi-label">${I18n.t('common.receipt')}</div><div class="kpi-value">${salesArr.length}</div></div>
                    <div class="kpi-card"><div class="kpi-label">${I18n.t('common.total')}</div><div class="kpi-value">${App.fmtMoney(totalRevenue)}</div></div>
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
                        <div class="row-col"><div class="n">${(s.items || []).length}</div><div class="l">${I18n.t('common.items')}</div></div>
                        <div class="row-col"><div class="n">${App.fmtMoney(s.discount)}</div><div class="l">${I18n.t('common.discount')}</div></div>
                        <div class="row-total">${App.fmtMoney(s.total)}</div>
                        <div class="row-col">${Pages.paymentStateBadge(s.paymentState)}</div>
                        <div class="row-actions"><button class="btn btn-outline btn-small" onclick='Pages.showSaleDetails(${JSON.stringify(s)})'>${I18n.t('common.details')}</button></div>
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
        if (state === 'Partial') return `<span class="badge badge-warning">${I18n.t('sales.partiallyPaid')}</span>`;
        if (state === 'Unpaid') return `<span class="badge badge-danger">${I18n.t('sales.unpaid')}</span>`;
        return `<span class="badge badge-success">${I18n.t('sales.fullyPaid')}</span>`;
    },

    // باتچی قەرزی کڕیار — onUpdate: callback ـێکی ئارەزوومەندانە کە دوای
    // پارەدانی سەرکەوتوو یان دۆزینەوەی SUCCESS ی Qi Card بانگ دەکرێت،
    // تاوەکو ئەگەر ئەم دیالۆگە لە پەڕەی "قەرزی کڕیاران"ـەوە کراوەتەوە،
    // دوای پارەدان بگەڕێتەوە بۆ هەمان پەڕە نەک بەرەو "مێژووی فرۆشتن"
    // (کە بنەڕەتی/کۆنترۆڵی پێشووە).
    showSaleDetails(sale, onUpdate) {
        this._saleDetailOnUpdate = onUpdate || (() => Pages.sales(this._salesFilters || {}));
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
                <h3>${App.escapeHtml(sale.invoiceNumber || (I18n.t('common.receipt') + ' #' + sale.id))}</h3>
                <p class="text-muted">${App.fmtDate(sale.date)} — ${I18n.t('common.soldBy')}: ${App.escapeHtml(sale.soldBy)}</p>
                <p>${Pages.paymentStateBadge(sale.paymentState)}</p>
                <div class="mini-row-list">${itemsHtml}</div>
                <p style="margin-top:14px;">${I18n.t('common.discount')}: <b>${App.fmtMoney(sale.discount)}</b></p>
                <p style="font-size:18px;color:var(--primary-dark);">${I18n.t('common.total')}: <b>${App.fmtMoney(sale.total)}</b></p>
                ${notPaid ? `
                    <p>${I18n.t('sales.paidLabel')}: <b>${App.fmtMoney(sale.amountPaid)}</b> — ${I18n.t('sales.dueLabel')}: <b style="color:var(--danger);">${App.fmtMoney(amountDue)}</b></p>
                    <div class="form-row"><label>${I18n.t('sales.newPaymentAmount')}</label><input type="number" step="0.01" id="payAmount_${sale.id}"></div>
                    <button class="btn btn-primary btn-block" onclick="Pages.recordSalePayment(${sale.id})">${I18n.t('sales.recordPayment')}</button>
                    <button class="btn btn-outline btn-block" style="margin-top:6px;" onclick="Pages.createQiCardLink(${sale.id})">${I18n.t('sales.createQiCardLink')}</button>
                    <div id="qicardResult_${sale.id}"></div>
                ` : ''}
                <div style="display:flex;gap:8px;margin-top:10px;">
                    <button class="btn btn-outline" style="flex:1;" onclick='Pages.printInvoice(${JSON.stringify(sale)})'>🖨️ ${I18n.t('common.print')}</button>
                    <button class="btn btn-outline" style="flex:1;" onclick="Pages.closeSaleDetailModal()">${I18n.t('common.close')}</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        // Qi Card — خۆکارانە دۆخی پارەدان هەر ٥ چرکە دەپشکنرێت هەتا
        // دیالۆگەکە کراوەیە، تاوەکو پێویست نەبێت بە دەستی داخران و
        // دووبارە کرانەوە بۆ بینینی دۆخی نوێ دوای پارەدانی کڕیار.
        this.stopQiCardPoll();
        if (notPaid) {
            this._qicardPollTimer = setInterval(() => Pages.pollQiCardStatus(sale.id), 5000);
        }
    },

    stopQiCardPoll() {
        if (this._qicardPollTimer) {
            clearInterval(this._qicardPollTimer);
            this._qicardPollTimer = null;
        }
    },

    closeSaleDetailModal() {
        this.stopQiCardPoll();
        document.getElementById('saleDetailModal')?.remove();
    },

    // پشکنینی دۆخی پارەدانی Qi Card بەبێ دووبارە کردنەوەی دیالۆگ.
    // بانگکردنی GetQiCardStatus لای سێرڤەر خۆی هەوڵی auto-apply
    // دەدات ئەگەر تا ئێستا وێبهووکی Qi Card نەگەیشتبێت (بڕوانە
    // PaymentsController.cs). بەم شێوەیە پارەدان دەردەکەوێت تەنانەت
    // ئەگەر وێبهووکەکە دواکەوتبێت.
    async pollQiCardStatus(saleId) {
        if (!document.getElementById('saleDetailModal')) { this.stopQiCardPoll(); return; }
        try {
            const status = await Api.getQiCardStatus(saleId);
            if (status && status.status === 'SUCCESS') {
                this.stopQiCardPoll();
                document.getElementById('saleDetailModal')?.remove();
                alert(I18n.t('sales.qiCardPaid'));
                (Pages._saleDetailOnUpdate || (() => Pages.sales(Pages._salesFilters || {})))();
            }
        } catch {
            // هەڵەی کاتی/ئینتەرنێت — پشکنینی دواتر بەردەوام دەبێت،
            // پێویست بە ئاگادارکردنەوەی ئەدمین لێرە نییە.
        }
    },

    // Part 13 — INVOICES: تۆمارکردنی پارەدانی زیاتر — هەمان endpoint ی
    // PATCH /api/Sales/{id}/payment. سەرکەوتوو بوو، دیالۆگەکە دادەخرێت
    // و لیستی فرۆشتن دووبارە بار دەکرێتەوە تا دۆخی نوێ بگاتێ.
    async recordSalePayment(saleId) {
        const input = document.getElementById('payAmount_' + saleId);
        const amount = parseFloat(input?.value || '0');
        if (!amount || amount <= 0) {
            alert(I18n.t('sales.invalidAmount'));
            return;
        }

        try {
            await Api.recordSalePayment(saleId, amount);
            Pages.stopQiCardPoll();
            document.getElementById('saleDetailModal')?.remove();
            (Pages._saleDetailOnUpdate || (() => Pages.sales(Pages._salesFilters || {})))();
        } catch (err) {
            alert(I18n.t('sales.paymentFailedPrefix') + '\n' + err.message);
        }
    },

    // قۆناغی دەروازەی پارەدان — Qi Card. لینکێک/QR دروست دەکات کە کڕیار
    // لە مۆبایلی خۆیەوە دەیکاتەوە و بڕی ماوەی وەصڵەکە دەدات — دوای
    // پارەدان، Qi Card خۆکارانە وێبهووک دەنێرێت بۆ CashierApi و
    // Sale.PaymentState خۆکارانە نوێ دەکرێتەوە (بڕوانە
    // CashierApi/Controllers/PaymentsController.cs). ئەم دوگمەیە لینکەکە
    // پیشان دەدات؛ دۆخی پارەدان خۆکارانە دەپشکنرێت (بڕوانە
    // pollQiCardStatus/stopQiCardPoll) هەتا دیالۆگەکە کراوەیە — پێویست
    // بە داخستن/کردنەوەی دەستی نییە.
    async createQiCardLink(saleId) {
        const resultBox = document.getElementById('qicardResult_' + saleId);
        if (resultBox) resultBox.innerHTML = `<p class="text-muted">${I18n.t('common.waitingDots')}</p>`;

        try {
            const result = await Api.createQiCardPayment(saleId);
            if (!resultBox) return;

            if (!result?.formUrl) {
                resultBox.innerHTML = `<p style="color:var(--danger);">${I18n.t('sales.qiCardBadResponse')}</p>`;
                return;
            }

            resultBox.innerHTML = `
                <div class="form-row" style="margin-top:8px;">
                    <label>${I18n.t('sales.paymentLinkLabel', { amount: App.fmtMoney(result.amount) })}</label>
                    <input type="text" readonly value="${App.escapeHtml(result.formUrl)}" onclick="this.select()">
                </div>
                <div style="display:flex;gap:8px;">
                    <a class="btn btn-primary" style="flex:1;text-align:center;" href="${App.escapeHtml(result.formUrl)}" target="_blank" rel="noopener">${I18n.t('sales.openLink')}</a>
                    <button class="btn btn-outline" style="flex:1;" onclick="navigator.clipboard.writeText('${App.escapeHtml(result.formUrl)}').then(()=>alert('${I18n.t('common.copied')}'))">${I18n.t('common.copy')}</button>
                </div>`;
        } catch (err) {
            if (resultBox) resultBox.innerHTML = `<p style="color:var(--danger);">${I18n.t('sales.qiCardCreateFailed')}<br>${App.escapeHtml(err.message)}</p>`;
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
        const paymentStateText = sale.paymentState === 'Partial' ? I18n.t('sales.partiallyPaid')
            : sale.paymentState === 'Unpaid' ? I18n.t('sales.unpaid') : I18n.t('sales.fullyPaid');

        const win = window.open('', '_blank');
        if (!win) { alert(I18n.t('sales.popupBlocked')); return; }

        win.document.write(`
            <html dir="${I18n.langMeta[I18n.current].dir}" lang="${I18n.current}">
            <head>
                <meta charset="utf-8">
                <title>${App.escapeHtml(sale.invoiceNumber || (I18n.t('common.receipt') + ' #' + sale.id))}</title>
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
                <h1>${App.escapeHtml(sale.invoiceNumber || (I18n.t('common.receipt') + ' #' + sale.id))}</h1>
                <p class="muted">${App.fmtDate(sale.date)} — ${I18n.t('common.soldBy')}: ${App.escapeHtml(sale.soldBy || '')}</p>
                <table>
                    <thead><tr><th>${I18n.t('sales.colProduct')}</th><th>${I18n.t('common.qty')}</th><th>${I18n.t('sales.colPrice')}</th><th>${I18n.t('common.total')}</th></tr></thead>
                    <tbody>${itemsRows}</tbody>
                </table>
                <div class="totals">
                    <p>${I18n.t('common.discount')}: ${App.fmtMoney(sale.discount)}</p>
                    <p class="grand">${I18n.t('common.total')}: ${App.fmtMoney(sale.total)}</p>
                    <p>${I18n.t('sales.paymentStateLabel')}: ${paymentStateText}</p>
                    ${sale.paymentState !== 'Paid' ? `<p>${I18n.t('sales.paidLabel')}: ${App.fmtMoney(sale.amountPaid)} — ${I18n.t('sales.dueLabel')}: ${App.fmtMoney(amountDue)}</p>` : ''}
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

            let html = `<h2 class="page-title">📥 ${I18n.t('purchases.title')}</h2>
                <div class="filter-bar">
                    <div class="form-row"><label>${I18n.t('purchases.searchBySupplier')}</label><input type="text" id="puSupplier" value="${App.escapeHtml(f.supplier || '')}"></div>
                    <button class="btn btn-primary" onclick="Pages.applyPurchaseFilter()">${I18n.t('common.search')}</button>
                    ${canReceive ? `<button class="btn btn-accent" onclick="Pages.showPurchaseForm()">${I18n.t('purchases.newPurchase')}</button>` : ''}
                </div>`;

            if (purchases.length === 0) {
                html += App.emptyHtml(I18n.t('purchases.none'));
            } else {
                html += `<div class="row-list">`;
                for (const p of purchases) {
                    html += `<div class="row-item">
                        <div class="row-icon">📥</div>
                        <div class="row-main">
                            <div class="row-title">${App.escapeHtml(p.supplierName || I18n.t('purchases.noSupplierName'))}</div>
                            <div class="row-sub">${App.escapeHtml(p.referenceNumber || '—')} · ${App.fmtDate(p.date)} · ${App.escapeHtml(p.createdBy)}</div>
                        </div>
                        <div class="row-col"><div class="n">${(p.items || []).length}</div><div class="l">${I18n.t('common.items')}</div></div>
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
                <h3>${I18n.t('purchases.newPurchase')}</h3>
                <div id="purchaseFormError" class="alert alert-danger" style="display:none;"></div>
                <div class="form-row"><label>${I18n.t('purchases.supplierName')}</label><input id="pu_supplier"></div>
                <div class="form-row"><label>${I18n.t('purchases.referenceNumber')}</label><input id="pu_reference"></div>
                <div class="form-row">
                    <label>${I18n.t('purchases.addItemLabel')}</label>
                    <select id="pu_productSelect">
                        <option value="">${I18n.t('purchases.selectProduct')}</option>
                        ${products.map(p => `<option value="${p.id}">${App.escapeHtml(p.name)} ${I18n.t('purchases.stockSuffix', { qty: p.quantity })}</option>`).join('')}
                    </select>
                </div>
                <button class="btn btn-outline btn-small" onclick="Pages.addPurchaseItem()">${I18n.t('purchases.addThisItem')}</button>
                <div id="purchaseItemsList" style="margin-top:10px;"></div>
                <div class="form-row" style="margin-top:12px;"><label>${I18n.t('common.discount')}</label><input id="pu_discount" type="number" step="0.01" value="0" oninput="Pages.renderPurchaseItems()"></div>
                <p id="pu_total" style="font-size:16px;font-weight:bold;color:var(--primary-dark);"></p>
                <div style="display:flex;gap:8px;">
                    <button class="btn btn-primary" style="flex:1;" onclick="Pages.savePurchase()">✅ ${I18n.t('common.approve')}</button>
                    <button class="btn btn-outline" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">${I18n.t('common.cancel')}</button>
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
            container.innerHTML = `<p class="text-muted" style="font-size:13px;">${I18n.t('purchases.noItemsYet')}</p>`;
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
        if (totalEl) totalEl.textContent = I18n.t('purchases.totalsLine', { total: App.fmtMoney(total), subtotal: App.fmtMoney(subtotal) });
    },

    async savePurchase() {
        const errBox = document.getElementById('purchaseFormError');
        if (this._purchaseCart.length === 0) {
            errBox.textContent = I18n.t('purchases.needAtLeastOneItem');
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

            let html = `<h2 class="page-title">💰 ${I18n.t('expenses.title')}</h2>
                <div class="filter-bar">
                    <button class="btn btn-accent" onclick="Pages.showExpenseForm()">${I18n.t('expenses.add')}</button>
                </div>`;

            if (expenses.length === 0) {
                html += App.emptyHtml(I18n.t('expenses.none'));
            } else {
                html += `<div class="row-list">`;
                for (const e of expenses) {
                    html += `<div class="row-item">
                        <div class="row-icon">💰</div>
                        <div class="row-main">
                            <div class="row-title">${App.escapeHtml(e.title)}</div>
                            <div class="row-sub">${App.escapeHtml(e.category || I18n.t('products.noCategory'))} · ${App.fmtDate(e.date)}</div>
                        </div>
                        ${e.isLinkedToPurchase ? `<span class="badge">${I18n.t('expenses.linkedToPurchase')}</span>` : ''}
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
                <h3>${I18n.t('expenses.add')}</h3>
                <div id="expenseFormError" class="alert alert-danger" style="display:none;"></div>
                <div class="form-row"><label>${I18n.t('expenses.fieldTitle')}</label><input id="ex_title"></div>
                <div class="form-row"><label>${I18n.t('common.category')}</label><input id="ex_category"></div>
                <div class="form-row"><label>${I18n.t('expenses.amount')}</label><input id="ex_amount" type="number" step="0.01"></div>
                <div class="form-row"><label>${I18n.t('common.notes')}</label><textarea id="ex_note"></textarea></div>
                <div style="display:flex;gap:8px;margin-top:14px;">
                    <button class="btn btn-primary" style="flex:1;" onclick="Pages.saveExpense()">${I18n.t('common.save')}</button>
                    <button class="btn btn-outline" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">${I18n.t('common.cancel')}</button>
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
            errBox.textContent = I18n.t('expenses.titleAmountRequired');
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

        let html = `<h2 class="page-title">📊 ${I18n.t('reports.title')}</h2>
            <div class="filter-bar">
                <div class="form-row"><label>${I18n.t('common.fromDate')}</label><input type="date" id="rFrom" value="${r.from}"></div>
                <div class="form-row"><label>${I18n.t('common.toDate')}</label><input type="date" id="rTo" value="${r.to}"></div>
                <button class="btn btn-primary" onclick="Pages.applyReportFilter()">${I18n.t('common.show')}</button>
                <button class="btn btn-outline btn-small" onclick="Pages.reportPreset('today')">${I18n.t('reports.today')}</button>
                <button class="btn btn-outline btn-small" onclick="Pages.reportPreset('week')">${I18n.t('reports.thisWeek')}</button>
                <button class="btn btn-outline btn-small" onclick="Pages.reportPreset('month')">${I18n.t('reports.thisMonth')}</button>
            </div>
            <div id="reportResults">${App.loadingHtml()}</div>`;

        App.setContent(html);

        try {
            const report = await Api.getReport(r.from, r.to);
            let resultsHtml = `<div class="kpi-grid">
                <div class="kpi-card"><div class="kpi-label">💰 ${I18n.t('reports.revenue')}</div><div class="kpi-value">${App.fmtMoney(report.totalRevenue)}</div></div>
                <div class="kpi-card"><div class="kpi-label">🧾 ${I18n.t('dash.salesCount')}</div><div class="kpi-value">${report.salesCount}</div></div>
                <div class="kpi-card"><div class="kpi-label">📦 ${I18n.t('reports.cogs')}</div><div class="kpi-value">${App.fmtMoney(report.costOfGoodsSold)}</div></div>
                <div class="kpi-card"><div class="kpi-label">💸 ${I18n.t('reports.expenses')}</div><div class="kpi-value">${App.fmtMoney(report.expensesTotal)}</div></div>
                <div class="kpi-card"><div class="kpi-label">📈 ${I18n.t('reports.netProfit')}</div><div class="kpi-value">${App.fmtMoney(report.netProfit)}</div></div>
            </div>`;

            if (report.topProducts && report.topProducts.length > 0) {
                resultsHtml += `<div class="card"><h3>🏆 ${I18n.t('reports.topProducts')}</h3>
                    <div class="row-list">` +
                    report.topProducts.map(p => `
                        <div class="row-item">
                            <div class="row-icon">🏆</div>
                            <div class="row-main"><div class="row-title">${App.escapeHtml(p.name)}</div></div>
                            <div class="row-col"><div class="n">${p.quantitySold}</div><div class="l">${I18n.t('common.qty')}</div></div>
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

            let html = `<h2 class="page-title">👤 ${I18n.t('users.title')}</h2>
                <div class="filter-bar"><button class="btn btn-accent" onclick="Pages.showUserForm()">${I18n.t('users.add')}</button></div>
                <div class="row-list">`;

            for (const u of users) {
                html += `<div class="row-item">
                    <div class="row-icon">${App.escapeHtml((u.username || '?').charAt(0).toUpperCase())}</div>
                    <div class="row-main"><div class="row-title">${App.escapeHtml(u.username)}</div></div>
                    <span class="badge">${App.escapeHtml(App.roleLabel ? App.roleLabel(u.role) : u.role)}</span>
                    <div class="row-actions">
                        <button class="btn btn-outline btn-small" onclick='Pages.showUserForm(${JSON.stringify(u)})'>${I18n.t('common.edit')}</button>
                        ${u.username !== 'admin' ? `<button class="btn btn-danger btn-small" onclick="Pages.deleteUser(${u.id}, '${App.escapeHtml(u.username)}')">${I18n.t('common.delete')}</button>` : ''}
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
                <h3>${u.id ? I18n.t('users.modalEdit') : I18n.t('users.modalAdd')}</h3>
                <div id="userFormError" class="alert alert-danger" style="display:none;"></div>
                <div class="form-row"><label>${I18n.t('common.username')}</label><input id="uf_username" value="${App.escapeHtml(u.username)}"></div>
                <div class="form-row"><label>${I18n.t('common.role')}</label>
                    <select id="uf_role">
                        ${['Admin', 'Cashier', 'DataEntry', 'Accountant'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${I18n.t('role.' + r)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-row"><label>${I18n.t('common.password')} ${u.id ? I18n.t('users.passwordHint') : ''}</label><input id="uf_password" type="password"></div>
                <div style="display:flex;gap:8px;margin-top:14px;">
                    <button class="btn btn-primary" style="flex:1;" onclick="Pages.saveUser(${u.id})">${I18n.t('common.save')}</button>
                    <button class="btn btn-outline" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">${I18n.t('common.cancel')}</button>
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
            errBox.textContent = I18n.t('users.usernamePasswordRequired');
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
        if (!confirm(I18n.t('users.confirmDelete', { name: username }))) return;
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

            let html = `<h2 class="page-title">🧑‍🤝‍🧑 ${I18n.t('customers.title')}</h2>
                <div class="filter-bar">
                    <div class="form-row" style="flex:1;min-width:200px;">
                        <input type="text" id="customerSearch" placeholder="${I18n.t('customers.searchPlaceholder')}" value="${App.escapeHtml(search || '')}">
                    </div>
                    <button class="btn btn-primary" onclick="Pages.searchCustomers()">${I18n.t('common.search')}</button>
                    ${canEdit ? `<button class="btn btn-accent" onclick="Pages.showCustomerForm()">➕ ${I18n.t('customers.add')}</button>` : ''}
                </div>`;

            if (customers.length === 0) {
                html += App.emptyHtml(I18n.t('customers.none'));
            } else {
                html += `<div class="row-list">`;
                for (const c of customers) {
                    html += `<div class="row-item">
                        <div class="row-icon">🧑</div>
                        <div class="row-main">
                            <div class="row-title">${App.escapeHtml(c.name)}</div>
                            <div class="row-sub">${App.escapeHtml(c.phone || I18n.t('common.noPhone'))} ${c.address ? '· ' + App.escapeHtml(c.address) : ''}</div>
                        </div>
                        <div class="row-actions">
                            <button class="btn btn-outline btn-small" onclick="Pages.showCustomerHistory(${c.id}, '${App.escapeHtml(c.name)}')">${I18n.t('common.history')}</button>
                            ${canEdit ? `<button class="btn btn-outline btn-small" onclick='Pages.showCustomerForm(${JSON.stringify(c)})'>${I18n.t('common.edit')}</button>` : ''}
                            ${canDelete ? `<button class="btn btn-danger btn-small" onclick="Pages.deleteCustomer(${c.id}, '${App.escapeHtml(c.name)}')">${I18n.t('common.delete')}</button>` : ''}
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
                <h3>${c.id ? I18n.t('customers.modalEdit') : I18n.t('customers.add')}</h3>
                <div id="customerFormError" class="alert alert-danger" style="display:none;"></div>
                <div class="form-row"><label>${I18n.t('common.name')}</label><input id="cf_name" value="${App.escapeHtml(c.name)}"></div>
                <div class="form-row"><label>${I18n.t('common.phone')}</label><input id="cf_phone" value="${App.escapeHtml(c.phone)}"></div>
                <div class="form-row"><label>${I18n.t('common.address')}</label><input id="cf_address" value="${App.escapeHtml(c.address)}"></div>
                <div class="form-row"><label>${I18n.t('common.notes')}</label><textarea id="cf_notes">${App.escapeHtml(c.notes)}</textarea></div>
                <div style="display:flex;gap:8px;margin-top:14px;">
                    <button class="btn btn-primary" style="flex:1;" onclick="Pages.saveCustomer(${c.id})">${I18n.t('common.save')}</button>
                    <button class="btn btn-outline" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">${I18n.t('common.cancel')}</button>
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
            errBox.textContent = I18n.t('customers.nameRequired');
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
        if (!confirm(I18n.t('customers.confirmDelete', { name }))) return;
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
        overlay.innerHTML = `<div class="modal-box"><h3>${I18n.t('customers.historyTitle', { name: App.escapeHtml(name) })}</h3>${App.loadingHtml()}</div>`;
        document.body.appendChild(overlay);

        try {
            const sales = await Api.getCustomerSales(id);
            const total = sales.reduce((s, x) => s + x.total, 0);
            let html = `<div class="modal-box">
                <h3>${I18n.t('customers.historyTitle', { name: App.escapeHtml(name) })}</h3>
                <div class="kpi-grid">
                    <div class="kpi-card"><div class="kpi-label">${I18n.t('common.receipt')}</div><div class="kpi-value">${sales.length}</div></div>
                    <div class="kpi-card"><div class="kpi-label">${I18n.t('common.total')}</div><div class="kpi-value">${App.fmtMoney(total)}</div></div>
                </div>`;
            if (sales.length === 0) {
                html += App.emptyHtml(I18n.t('customers.noSalesHistory'));
            } else {
                html += `<div class="row-list">` + sales.map(s => `
                    <div class="row-item">
                        <div class="row-icon">🧾</div>
                        <div class="row-main"><div class="row-title">${I18n.t('common.receipt')} #${s.id}</div><div class="row-sub">${App.fmtDate(s.date)}</div></div>
                        <div class="row-total">${App.fmtMoney(s.total)}</div>
                    </div>`).join('') + `</div>`;
            }
            html += `<button class="btn btn-outline btn-block" style="margin-top:14px;" onclick="this.closest('.modal-overlay').remove()">${I18n.t('common.close')}</button></div>`;
            overlay.innerHTML = html;
        } catch (err) {
            overlay.innerHTML = `<div class="modal-box">${App.errorHtml(err)}
                <button class="btn btn-outline btn-block" style="margin-top:14px;" onclick="this.closest('.modal-overlay').remove()">${I18n.t('common.close')}</button></div>`;
        }
    },

    // ============ قەرزی کڕیاران (باتچی قەرزی کڕیار — API ـەکە پێشتر
    // لە سیشنێکی پێشووتردا لای سێرڤەرەوە تەواو بوو، Sale.CustomerId +
    // Sale.PaymentState/AmountPaid خۆیان سەرچاوەی ڕاستی قەرزن، هیچ
    // ستوونی جیاوازی قەرز پاشەکەوت نابێت — بۆیە قەرز خۆکارانە زیاد
    // دەبێت کاتێک فرۆشتنێکی Partial/Unpaid بۆ کڕیارێک تۆمار دەکرێت لە
    // هەر ئەپێکەوە (Desktop/Mobile). ئەم پەڕەیە یەکەم ڕوکاری WebAdmin ـە
    // بۆی. ) ============
    async customerDebts(search) {
        App.setContent(App.loadingHtml());
        try {
            const list = await Api.getCustomersWithBalance(true, search);

            let html = `<h2 class="page-title">📒 ${I18n.t('debts.title')}</h2>
                <div class="filter-bar">
                    <div class="form-row" style="flex:1;min-width:200px;">
                        <input type="text" id="debtSearch" placeholder="${I18n.t('debts.searchPlaceholder')}" value="${App.escapeHtml(search || '')}">
                    </div>
                    <button class="btn btn-primary" onclick="Pages.searchCustomerDebts()">${I18n.t('common.search')}</button>
                </div>`;

            if (list.length === 0) {
                html += App.emptyHtml(I18n.t('debts.none'));
            } else {
                const totalDebt = list.reduce((s, c) => s + c.totalDebt, 0);
                html += `<div class="kpi-grid">
                    <div class="kpi-card"><div class="kpi-label">${I18n.t('debts.debtorCount')}</div><div class="kpi-value">${list.length}</div></div>
                    <div class="kpi-card"><div class="kpi-label">${I18n.t('debts.totalDebt')}</div><div class="kpi-value">${App.fmtMoney(totalDebt)}</div></div>
                </div>`;

                html += `<div class="row-list">`;
                for (const c of list) {
                    html += `<div class="row-item">
                        <div class="row-icon">📒</div>
                        <div class="row-main">
                            <div class="row-title">${App.escapeHtml(c.name)} <span class="text-muted">#${c.customerId}</span></div>
                            <div class="row-sub">${App.escapeHtml(c.phone || I18n.t('common.noPhone'))} · ${I18n.t('debts.unpaidCount', { count: c.unpaidSalesCount })}</div>
                        </div>
                        <div class="row-total" style="color:var(--danger);">${App.fmtMoney(c.totalDebt)}</div>
                        <div class="row-actions"><button class="btn btn-outline btn-small" onclick="Pages.showCustomerDebtDetail(${c.customerId}, '${App.escapeHtml(c.name)}')">${I18n.t('common.details')}</button></div>
                    </div>`;
                }
                html += `</div>`;
            }

            App.setContent(html);
            document.getElementById('debtSearch')?.addEventListener('keydown', e => {
                if (e.key === 'Enter') this.searchCustomerDebts();
            });
        } catch (err) {
            App.setContent(App.errorHtml(err));
        }
    },

    searchCustomerDebts() {
        this.customerDebts(document.getElementById('debtSearch').value.trim());
    },

    async showCustomerDebtDetail(id, name) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'debtDetailModal';
        overlay.innerHTML = `<div class="modal-box"><h3>${I18n.t('debts.unpaidSalesOf', { name: App.escapeHtml(name) })}</h3>${App.loadingHtml()}</div>`;
        document.body.appendChild(overlay);

        try {
            const sales = await Api.getCustomerUnpaidSales(id);
            const totalDue = sales.reduce((s, x) => s + Math.max((x.total || 0) - (x.amountPaid || 0), 0), 0);

            let html = `<div class="modal-box">
                <h3>${I18n.t('debts.unpaidSalesOf', { name: App.escapeHtml(name) })}</h3>
                <div class="kpi-grid">
                    <div class="kpi-card"><div class="kpi-label">${I18n.t('common.receipt')}</div><div class="kpi-value">${sales.length}</div></div>
                    <div class="kpi-card"><div class="kpi-label">${I18n.t('debts.totalDue')}</div><div class="kpi-value">${App.fmtMoney(totalDue)}</div></div>
                </div>`;

            if (sales.length === 0) {
                html += App.emptyHtml(I18n.t('debts.noneRemaining'));
            } else {
                html += `<div class="row-list">` + sales.map(s => `
                    <div class="row-item">
                        <div class="row-icon">🧾</div>
                        <div class="row-main"><div class="row-title">${App.escapeHtml(s.invoiceNumber || ('#' + s.id))}</div><div class="row-sub">${App.fmtDate(s.date)}</div></div>
                        <div class="row-col">${Pages.paymentStateBadge(s.paymentState)}</div>
                        <div class="row-total" style="color:var(--danger);">${App.fmtMoney(Math.max((s.total || 0) - (s.amountPaid || 0), 0))}</div>
                        <div class="row-actions"><button class="btn btn-outline btn-small" onclick='Pages.openDebtSaleDetail(${JSON.stringify(s)}, ${id}, ${JSON.stringify(name)})'>${I18n.t('debts.pay')}</button></div>
                    </div>`).join('') + `</div>`;
            }

            html += `<button class="btn btn-outline btn-block" style="margin-top:14px;" onclick="this.closest('.modal-overlay').remove()">${I18n.t('common.close')}</button></div>`;
            overlay.innerHTML = html;
        } catch (err) {
            overlay.innerHTML = `<div class="modal-box">${App.errorHtml(err)}
                <button class="btn btn-outline btn-block" style="margin-top:14px;" onclick="this.closest('.modal-overlay').remove()">${I18n.t('common.close')}</button></div>`;
        }
    },

    // پارەدانی وەصڵێک لەناو دیالۆگی "قەرزی کڕیاران" — دیالۆگی وردەکاری
    // کڕیارەکە داخرا دەکرێت، دیالۆگی ئاسایی showSaleDetails دەکرێتەوە،
    // و دوای پارەدان دووبارە دەگەڕێتەوە بۆ دیالۆگی وردەکاری کڕیارەکە
    // (نەک بەرەو پەڕەی "مێژووی فرۆشتن").
    openDebtSaleDetail(sale, customerId, customerName) {
        document.getElementById('debtDetailModal')?.remove();
        Pages.showSaleDetails(sale, () => {
            Pages.showCustomerDebtDetail(customerId, customerName);
            // دیوی لیستی سەرەکیش نوێ بکرێتەوە ئەگەر ئێستا لەسەری بووین.
            if ((location.hash || '').replace('#', '') === 'customerdebts') {
                Pages.customerDebts(document.getElementById('debtSearch')?.value?.trim());
            }
        });
    },

    // ============ دابینکەران (Part 13 — یەکەم ڕوکاری وێبی ئەم
    // مۆدیوولە، هەمان شێوازی کڕیاران) ============
    async suppliers(search) {
        App.setContent(App.loadingHtml());
        try {
            const suppliers = await Api.getSuppliers(search);
            const canEdit = ['Admin', 'DataEntry'].includes(Api.getRole());
            const canDelete = Api.getRole() === 'Admin';

            let html = `<h2 class="page-title">🚚 ${I18n.t('suppliers.title')}</h2>
                <div class="filter-bar">
                    <div class="form-row" style="flex:1;min-width:200px;">
                        <input type="text" id="supplierSearch" placeholder="${I18n.t('suppliers.searchPlaceholder')}" value="${App.escapeHtml(search || '')}">
                    </div>
                    <button class="btn btn-primary" onclick="Pages.searchSuppliers()">${I18n.t('common.search')}</button>
                    ${canEdit ? `<button class="btn btn-accent" onclick="Pages.showSupplierForm()">➕ ${I18n.t('suppliers.add')}</button>` : ''}
                </div>`;

            if (suppliers.length === 0) {
                html += App.emptyHtml(I18n.t('suppliers.none'));
            } else {
                html += `<div class="row-list">`;
                for (const s of suppliers) {
                    html += `<div class="row-item">
                        <div class="row-icon">🚚</div>
                        <div class="row-main">
                            <div class="row-title">${App.escapeHtml(s.name)}</div>
                            <div class="row-sub">${App.escapeHtml(s.phone || I18n.t('common.noPhone'))} ${s.address ? '· ' + App.escapeHtml(s.address) : ''}</div>
                        </div>
                        <div class="row-actions">
                            <button class="btn btn-outline btn-small" onclick="Pages.showSupplierHistory(${s.id}, '${App.escapeHtml(s.name)}')">${I18n.t('common.history')}</button>
                            ${canEdit ? `<button class="btn btn-outline btn-small" onclick='Pages.showSupplierForm(${JSON.stringify(s)})'>${I18n.t('common.edit')}</button>` : ''}
                            ${canDelete ? `<button class="btn btn-danger btn-small" onclick="Pages.deleteSupplier(${s.id}, '${App.escapeHtml(s.name)}')">${I18n.t('common.delete')}</button>` : ''}
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
                <h3>${s.id ? I18n.t('suppliers.modalEdit') : I18n.t('suppliers.add')}</h3>
                <div id="supplierFormError" class="alert alert-danger" style="display:none;"></div>
                <div class="form-row"><label>${I18n.t('common.name')}</label><input id="sf_name" value="${App.escapeHtml(s.name)}"></div>
                <div class="form-row"><label>${I18n.t('common.phone')}</label><input id="sf_phone" value="${App.escapeHtml(s.phone)}"></div>
                <div class="form-row"><label>${I18n.t('common.address')}</label><input id="sf_address" value="${App.escapeHtml(s.address)}"></div>
                <div class="form-row"><label>${I18n.t('common.notes')}</label><textarea id="sf_notes">${App.escapeHtml(s.notes)}</textarea></div>
                <div style="display:flex;gap:8px;margin-top:14px;">
                    <button class="btn btn-primary" style="flex:1;" onclick="Pages.saveSupplier(${s.id})">${I18n.t('common.save')}</button>
                    <button class="btn btn-outline" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">${I18n.t('common.cancel')}</button>
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
            errBox.textContent = I18n.t('suppliers.nameRequired');
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
        if (!confirm(I18n.t('suppliers.confirmDelete', { name }))) return;
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
        overlay.innerHTML = `<div class="modal-box"><h3>${I18n.t('suppliers.historyTitle', { name: App.escapeHtml(name) })}</h3>${App.loadingHtml()}</div>`;
        document.body.appendChild(overlay);

        try {
            const purchases = await Api.getSupplierPurchases(id);
            const total = purchases.reduce((s, x) => s + x.total, 0);
            let html = `<div class="modal-box">
                <h3>${I18n.t('suppliers.historyTitle', { name: App.escapeHtml(name) })}</h3>
                <div class="kpi-grid">
                    <div class="kpi-card"><div class="kpi-label">${I18n.t('purchases.title')}</div><div class="kpi-value">${purchases.length}</div></div>
                    <div class="kpi-card"><div class="kpi-label">${I18n.t('common.total')}</div><div class="kpi-value">${App.fmtMoney(total)}</div></div>
                </div>`;
            if (purchases.length === 0) {
                html += App.emptyHtml(I18n.t('suppliers.noPurchaseHistory'));
            } else {
                html += `<div class="row-list">` + purchases.map(p => `
                    <div class="row-item">
                        <div class="row-icon">📥</div>
                        <div class="row-main"><div class="row-title">${App.escapeHtml(p.referenceNumber || (I18n.t('purchases.title') + ' #' + p.id))}</div><div class="row-sub">${App.fmtDate(p.date)}</div></div>
                        <div class="row-total">${App.fmtMoney(p.total)}</div>
                    </div>`).join('') + `</div>`;
            }
            html += `<button class="btn btn-outline btn-block" style="margin-top:14px;" onclick="this.closest('.modal-overlay').remove()">${I18n.t('common.close')}</button></div>`;
            overlay.innerHTML = html;
        } catch (err) {
            overlay.innerHTML = `<div class="modal-box">${App.errorHtml(err)}
                <button class="btn btn-outline btn-block" style="margin-top:14px;" onclick="this.closest('.modal-overlay').remove()">${I18n.t('common.close')}</button></div>`;
        }
    },

    // ============ تۆماری چالاکی ============
    async activitylog() {
        App.setContent(App.loadingHtml());
        try {
            const logs = await Api.getActivityLog();

            let html = `<h2 class="page-title">📜 ${I18n.t('activitylog.title')}</h2>`;
            if (logs.length === 0) {
                html += App.emptyHtml(I18n.t('activitylog.none'));
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

            let html = `<h2 class="page-title">⚙️ ${I18n.t('settings.title')}</h2>
                <div id="settingsError" class="alert alert-danger" style="display:none;"></div>
                <div id="settingsSuccess" class="alert alert-success" style="display:none;"></div>
                <div class="card" style="max-width:480px;">
                    <div class="form-row"><label>${I18n.t('settings.storeName')}</label>
                        <input id="st_storeName" value="${App.escapeHtml(s.storeName)}" ${canEdit ? '' : 'disabled'}></div>
                    <div class="form-row"><label>${I18n.t('common.address')}</label>
                        <input id="st_address" value="${App.escapeHtml(s.address)}" ${canEdit ? '' : 'disabled'}></div>
                    <div class="form-row"><label>${I18n.t('common.phone')}</label>
                        <input id="st_phone" value="${App.escapeHtml(s.phone)}" ${canEdit ? '' : 'disabled'}></div>
                    <div class="form-row"><label>${I18n.t('settings.planName')}</label>
                        <input value="${App.escapeHtml(s.planName)}" disabled></div>
                    ${canEdit ? `<button class="btn btn-primary" style="margin-top:10px;" onclick="Pages.saveTenantSettings()">${I18n.t('common.save')}</button>`
                        : `<p class="row-sub" style="margin-top:10px;">${I18n.t('settings.adminOnly')}</p>`}
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
            errBox.textContent = I18n.t('settings.storeNameRequired');
            errBox.style.display = 'block';
            return;
        }

        try {
            const updated = await Api.updateTenantSettings(payload);
            localStorage.setItem('storeName', updated.storeName);
            document.getElementById('storeNameLabel').textContent = updated.storeName;
            okBox.textContent = I18n.t('common.savedSuccess');
            okBox.style.display = 'block';
        } catch (err) {
            errBox.textContent = err.message;
            errBox.style.display = 'block';
        }
    },

    // ============ پڕۆفایلی من (باتچی پڕۆفایل/فیدباک/نۆتیفیکەیشن) ============
    // بڕوانە CashierApi/MIGRATION_PROFILE_FEEDBACK_NOTIFICATIONS_REQUIRED.md.
    // گۆڕینی ناوی فرۆشگا بە ئەنقەست لێرە دووبارە نەکراوەتەوە — ئەوە
    // پێشتر لە پەڕەی "ڕێکخستنەکان" (Pages.settings) دا هەیە.
    async profile() {
        App.setContent(App.loadingHtml());
        try {
            const p = await Api.getMyProfile();

            let html = `<h2 class="page-title">👤 ${I18n.t('profile.title')}</h2>
                <div id="profileError" class="alert alert-danger" style="display:none;"></div>
                <div id="profileSuccess" class="alert alert-success" style="display:none;"></div>

                <div class="card" style="max-width:480px;">
                    <div class="form-row" style="align-items:center; display:flex; gap:14px;">
                        <img id="profilePhotoImg" src="${p.photoUrl ? App.escapeHtml(p.photoUrl) : ''}"
                             style="width:60px;height:60px;border-radius:50%;object-fit:cover;background:var(--border);${p.photoUrl ? '' : 'display:none;'}">
                        <span id="profilePhotoPlaceholder" style="font-size:38px;${p.photoUrl ? 'display:none;' : ''}">🙂</span>
                        <div>
                            <input type="file" id="profilePhotoFile" accept="image/png,image/jpeg,image/webp" style="display:none;" onchange="Pages.uploadMyPhoto()">
                            <button class="btn btn-outline btn-small" onclick="document.getElementById('profilePhotoFile').click()">${I18n.t('profile.changePhoto')}</button>
                        </div>
                    </div>

                    <div class="form-row"><label>${I18n.t('common.username')}</label>
                        <input value="${App.escapeHtml(p.username)}" disabled></div>
                    <div class="form-row"><label>${I18n.t('common.role')}</label>
                        <input value="${App.escapeHtml(App.roleLabel(p.role))}" disabled></div>
                    <div class="form-row"><label>${I18n.t('profile.fullName')}</label>
                        <input id="pf_fullName" value="${App.escapeHtml(p.fullName)}" placeholder="${I18n.t('profile.optional')}"></div>
                    <div class="form-row"><label>${I18n.t('profile.preferredLanguage')}</label>
                        <select id="pf_lang">
                            <option value="ku" ${p.preferredLanguage === 'ku' ? 'selected' : ''}>${I18n.t('profile.langKu')}</option>
                            <option value="ar" ${p.preferredLanguage === 'ar' ? 'selected' : ''}>${I18n.t('profile.langAr')}</option>
                            <option value="en" ${p.preferredLanguage === 'en' ? 'selected' : ''}>${I18n.t('profile.langEn')}</option>
                            <option value="fa" ${p.preferredLanguage === 'fa' ? 'selected' : ''}>${I18n.t('profile.langFa')}</option>
                        </select></div>
                    <button class="btn btn-primary" style="margin-top:10px;" onclick="Pages.saveMyProfile()">${I18n.t('common.save')}</button>
                </div>

                <div class="card" style="max-width:480px;">
                    <h3>${I18n.t('profile.feedbackTitle')}</h3>
                    <div id="feedbackError" class="alert alert-danger" style="display:none;"></div>
                    <div id="feedbackSuccess" class="alert alert-success" style="display:none;"></div>
                    <div class="form-row"><label>${I18n.t('profile.rating')}</label>
                        <select id="fb_rating">
                            <option value="5">${I18n.t('profile.rating5')}</option>
                            <option value="4">${I18n.t('profile.rating4')}</option>
                            <option value="3">${I18n.t('profile.rating3')}</option>
                            <option value="2">${I18n.t('profile.rating2')}</option>
                            <option value="1">${I18n.t('profile.rating1')}</option>
                        </select></div>
                    <div class="form-row"><label>${I18n.t('profile.message')}</label>
                        <textarea id="fb_message" rows="4" placeholder="${I18n.t('profile.messagePlaceholder')}" style="width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:var(--radius-sm); font-family:inherit;"></textarea></div>
                    <button class="btn btn-primary" onclick="Pages.submitFeedback()">${I18n.t('profile.submitFeedback')}</button>
                </div>`;

            App.setContent(html);
        } catch (err) {
            App.setContent(App.errorHtml(err));
        }
    },

    async saveMyProfile() {
        const errBox = document.getElementById('profileError');
        const okBox = document.getElementById('profileSuccess');
        errBox.style.display = 'none'; okBox.style.display = 'none';

        const payload = {
            fullName: document.getElementById('pf_fullName').value.trim(),
            preferredLanguage: document.getElementById('pf_lang').value
        };
        try {
            await Api.updateMyProfile(payload);
            okBox.textContent = I18n.t('profile.savedSuccess');
            okBox.style.display = 'block';
        } catch (err) {
            errBox.textContent = err.message;
            errBox.style.display = 'block';
        }
    },

    async uploadMyPhoto() {
        const fileInput = document.getElementById('profilePhotoFile');
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;

        const errBox = document.getElementById('profileError');
        const okBox = document.getElementById('profileSuccess');
        errBox.style.display = 'none'; okBox.style.display = 'none';

        try {
            const updated = await Api.uploadMyPhoto(file);
            const img = document.getElementById('profilePhotoImg');
            const placeholder = document.getElementById('profilePhotoPlaceholder');
            if (img) { img.src = updated.photoUrl; img.style.display = ''; }
            if (placeholder) placeholder.style.display = 'none';
            okBox.textContent = I18n.t('profile.photoUpdated');
            okBox.style.display = 'block';
        } catch (err) {
            // خاڵی: 503 r2_not_configured مانای وایە کۆگای وێنە (Cloudflare
            // R2) هێشتا لای سێرڤەرەوە ڕێکنەخراوە — بڕوانە
            // MIGRATION_PRODUCT_IMAGES_REQUIRED.md. نامەکەی سێرڤەر خۆی
            // ئەمە بە کوردی ڕوون دەکاتەوە، بۆیە لێرە هیچ کارێکی زیادە
            // پێویست ناکات.
            errBox.textContent = err.message;
            errBox.style.display = 'block';
        } finally {
            fileInput.value = '';
        }
    },

    async submitFeedback() {
        const errBox = document.getElementById('feedbackError');
        const okBox = document.getElementById('feedbackSuccess');
        errBox.style.display = 'none'; okBox.style.display = 'none';

        const rating = parseInt(document.getElementById('fb_rating').value, 10);
        const message = document.getElementById('fb_message').value.trim();
        if (!message) {
            errBox.textContent = I18n.t('profile.messageRequired');
            errBox.style.display = 'block';
            return;
        }

        try {
            const result = await Api.submitFeedback(rating, message);
            okBox.textContent = (result && result.message) || I18n.t('profile.feedbackThanks');
            okBox.style.display = 'block';
            document.getElementById('fb_message').value = '';
        } catch (err) {
            errBox.textContent = err.message;
            errBox.style.display = 'block';
        }
    },

    // ============ ئاگادارکردنەوەکان ============
    async notifications() {
        App.setContent(App.loadingHtml());
        try {
            const items = await Api.getNotifications();

            if (!items || !items.length) {
                App.setContent(`<h2 class="page-title">🔔 ${I18n.t('nav.notifications')}</h2>` + App.emptyHtml(I18n.t('notif.none')));
                return;
            }

            const typeIcon = { Info: 'ℹ️', Warning: '⚠️', Success: '✅', Update: '🆕' };

            let html = `<h2 class="page-title">🔔 ${I18n.t('nav.notifications')}</h2><div class="row-list">`;
            for (const n of items) {
                const icon = typeIcon[n.type] || 'ℹ️';
                html += `<div class="row-item"${n.isRead ? ' style="opacity:.6;"' : ''}>
                    <div class="row-icon">${icon}</div>
                    <div class="row-main">
                        <div class="row-title">${App.escapeHtml(n.title)}</div>
                        <div class="row-sub">${App.escapeHtml(n.body)}</div>
                        <div class="row-sub">${App.fmtDate(n.createdAt)}</div>
                    </div>
                    ${!n.isRead ? `<button class="btn btn-outline btn-small" onclick="Pages.markNotificationRead(${n.id})">${I18n.t('notif.markRead')}</button>` : ''}
                </div>`;
            }
            html += `</div>`;

            App.setContent(html);
        } catch (err) {
            App.setContent(App.errorHtml(err));
        }
    },

    async markNotificationRead(id) {
        try {
            await Api.markNotificationRead(id);
            this.notifications();
            App.loadNotifBadge();
        } catch (err) {
            alert(err.message);
        }
    }
});
