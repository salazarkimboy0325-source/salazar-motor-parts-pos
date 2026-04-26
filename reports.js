// Reports System for Motor Parts POS

class ReportsSystem {
    constructor() {
        this.salesHistory = [];
        this.inventory = [];
        this.expenses = [];
        this.categories = [];
        this.currentDateRange = 'this_month';
        this.salesChart = null;
        this.lowStockThreshold = 5;
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.renderAllReports();
        this.initSwipeable();
        this.updateDateTime();
        setInterval(() => this.updateDateTime(), 1000);

        // Display cashier name and position
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const cashierName = currentUser.name || localStorage.getItem('cashierName') || 'Cashier';
        const cashierRole = currentUser.role || 'Cashier';

        const nameEl = document.getElementById('cashierName');
        const posEl = document.getElementById('cashierPosition');

        if (nameEl) nameEl.textContent = cashierName;
        if (posEl) {
            const roleLabels = { 'admin': 'Admin', 'manager': 'Manager', 'cashier': 'Cashier' };
            posEl.textContent = roleLabels[cashierRole] || cashierRole;
        }
    }

    async loadData() {
        try {
            const inventorySnapshot = await db.collection('inventory').get();
            this.inventory = inventorySnapshot.docs.map(doc => ({
                id: parseInt(doc.id),
                ...doc.data()
            }));
            
            const salesSnapshot = await db.collection('sales').get();
            this.salesHistory = salesSnapshot.docs.map(doc => ({
                receiptNumber: doc.id,
                ...doc.data()
            }));
            
            const expensesSnapshot = await db.collection('expenses').get();
            this.expenses = expensesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            const settingsDoc = await db.collection('settings').doc('general').get();
            if (settingsDoc.exists) {
                const settings = settingsDoc.data();
                if (settings.categories) this.categories = settings.categories;
            }
            
            const savedThreshold = localStorage.getItem('lowStockThreshold');
            if (savedThreshold) this.lowStockThreshold = parseInt(savedThreshold);
            
            this.setDateRange('this_month');
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    async saveExpenseToFirestore(expense) {
        try {
            await db.collection('expenses').doc(expense.id.toString()).set(expense);
        } catch (error) {
            console.error('Error saving expense:', error);
        }
    }

    setupEventListeners() {
        document.getElementById('applyDateRange').addEventListener('click', () => this.applyCustomDateRange());
        document.getElementById('resetDateRange').addEventListener('click', () => this.setDateRange('this_month'));
        
        document.querySelectorAll('.btn-date').forEach(btn => {
            btn.addEventListener('click', (e) => this.setDateRange(e.target.dataset.period));
        });
        
        document.getElementById('chartPeriod')?.addEventListener('change', (e) => {
            this.renderSalesChart(e.target.value);
        });
        
        document.getElementById('addExpenseBtn').addEventListener('click', () => this.openExpenseModal());
        document.getElementById('saveExpense').addEventListener('click', () => this.saveExpense());
        
        document.querySelectorAll('.close-modal, .close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });
        
        document.getElementById('exportTransactions')?.addEventListener('click', () => this.exportTransactions());
        document.getElementById('exportLowStock')?.addEventListener('click', () => this.exportLowStock());
        document.getElementById('exportDebts')?.addEventListener('click', () => this.exportDebts());
        
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });
    }

    setDateRange(period) {
        this.currentDateRange = period;
        
        document.querySelectorAll('.btn-date').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`[data-period="${period}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        
        const today = new Date();
        let startDate = new Date();
        let endDate = new Date(today);
        
        switch(period) {
            case 'today':
                startDate = new Date(today);
                break;
            case 'yesterday':
                startDate = new Date(today);
                startDate.setDate(startDate.getDate() - 1);
                endDate = new Date(today);
                endDate.setDate(endDate.getDate() - 1);
                break;
            case 'this_week':
                startDate.setDate(today.getDate() - today.getDay());
                break;
            case 'this_month':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                break;
            case 'this_year':
                startDate = new Date(today.getFullYear(), 0, 1);
                break;
            case 'last_month':
                startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                endDate = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
            case 'all':
                startDate = new Date(2000, 0, 1);
                break;
            case 'daily_summary':
                startDate = new Date(today);
                this.showDailyReport();
                return;
        }
        
        document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
        document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
        
        this.renderAllReports();
    }

    applyCustomDateRange() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        
        if (startDate && endDate) {
            this.currentDateRange = 'custom';
            document.querySelectorAll('.btn-date').forEach(btn => btn.classList.remove('active'));
            this.renderAllReports();
        }
    }

    getDateRange() {
        const startDate = new Date(document.getElementById('startDate').value);
        const endDate = new Date(document.getElementById('endDate').value);
        endDate.setHours(23, 59, 59, 999);
        return { startDate, endDate };
    }

    getFilteredSales() {
        const { startDate, endDate } = this.getDateRange();
        return this.salesHistory.filter(sale => {
            const saleDate = new Date(sale.date);
            return saleDate >= startDate && saleDate <= endDate;
        });
    }

    getFilteredExpenses() {
        const { startDate, endDate } = this.getDateRange();
        return this.expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate >= startDate && expenseDate <= endDate;
        });
    }

    getCategoryLabel(category) {
        return category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    renderAllReports() {
        this.renderSummaryCards();
        this.renderTopSellingItems();
        this.renderLowStockAlert();
        this.renderSalesByCategory();
        this.renderPaymentMethods();
        this.renderTransactions();
        this.renderExpenses();
        this.renderInventoryValuation();
        this.renderTopCustomers();
        this.renderHourlySales();
        this.renderSalesChart();
        this.renderDebts();
    }

    showDailyReport() {
        // Show daily report section
        const dailySection = document.getElementById('dailyReportSection');
        if (dailySection) dailySection.style.display = 'block';
        
        const today = new Date();
        document.getElementById('dailyReportDate').textContent = today.toLocaleDateString('en-US', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
        
        const sales = this.getFilteredSales();
        const expenses = this.getFilteredExpenses();
        
        // Calculate totals
        const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
        const totalCost = sales.reduce((sum, sale) => {
            return sum + sale.items.reduce((itemSum, item) => itemSum + ((item.cost || 0) * item.quantity), 0);
        }, 0);
        const grossProfit = totalSales - totalCost;
        const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        const netProfit = grossProfit - totalExpenses;
        const totalItems = sales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
        const uniqueCustomers = new Set(sales.map(s => s.customer).filter(n => n !== 'Walk-in Customer'));
        
        // Update daily summary cards
        document.getElementById('dailyTotalSales').textContent = `₱${totalSales.toFixed(2)}`;
        document.getElementById('dailyTransactions').textContent = `${sales.length} transactions`;
        document.getElementById('dailyGrossProfit').textContent = `₱${grossProfit.toFixed(2)}`;
        document.getElementById('dailyExpenses').textContent = `₱${totalExpenses.toFixed(2)}`;
        document.getElementById('dailyNetProfit').textContent = `₱${netProfit.toFixed(2)}`;
        document.getElementById('dailyItemsSold').textContent = totalItems;
        document.getElementById('dailyCustomers').textContent = uniqueCustomers.size;
        
        // Render transactions
        const transactionsContainer = document.getElementById('dailyTransactionsList');
        if (sales.length === 0) {
            transactionsContainer.innerHTML = '<p style="color:#6b7280;text-align:center;padding:20px;">No transactions today</p>';
        } else {
            transactionsContainer.innerHTML = sales.slice().reverse().map(sale => {
                const saleCost = sale.items.reduce((sum, item) => sum + ((item.cost || 0) * item.quantity), 0);
                const profit = sale.total - saleCost;
                return `
                    <div class="daily-transaction-item">
                        <div class="daily-transaction-info">
                            <div class="daily-transaction-receipt">#${sale.receiptNumber}</div>
                            <div class="daily-transaction-time">${new Date(sale.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} | Cashier: ${sale.cashier || '-'}</div>
                            <div class="daily-transaction-customer">${sale.customer || 'Walk-in'} | ${sale.items.length} item(s)</div>
                        </div>
                        <div>
                            <div class="daily-transaction-total">₱${sale.total.toFixed(2)}</div>
                            <div class="daily-transaction-profit ${profit >= 0 ? 'profit-positive' : 'profit-negative'}">${profit >= 0 ? '+' : ''}₱${profit.toFixed(2)}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        // Render items sold
        const itemsContainer = document.getElementById('dailyItemsList');
        const itemSales = {};
        sales.forEach(sale => {
            sale.items.forEach(item => {
                const key = item.name;
                if (!itemSales[key]) itemSales[key] = { name: item.name, quantity: 0, revenue: 0 };
                itemSales[key].quantity += item.quantity;
                itemSales[key].revenue += item.price * item.quantity;
            });
        });
        const sortedItems = Object.values(itemSales).sort((a, b) => b.revenue - a.revenue);
        
        if (sortedItems.length === 0) {
            itemsContainer.innerHTML = '<p style="color:#6b7280;text-align:center;padding:20px;">No items sold today</p>';
        } else {
            itemsContainer.innerHTML = sortedItems.map(item => `
                <div class="daily-item-row">
                    <span class="daily-item-name">${item.name}</span>
                    <span class="daily-item-qty">x${item.quantity}</span>
                    <span class="daily-item-total">₱${item.revenue.toFixed(2)}</span>
                </div>
            `).join('');
        }
        
        // Render expenses
        const expensesContainer = document.getElementById('dailyExpensesList');
        if (expenses.length === 0) {
            expensesContainer.innerHTML = '<p style="color:#6b7280;text-align:center;padding:20px;">No expenses today</p>';
        } else {
            expensesContainer.innerHTML = expenses.map(exp => `
                <div class="daily-expense-item">
                    <span style="flex:1;">${exp.description}</span>
                    <span class="daily-expense-category">${exp.category}</span>
                    <span style="font-weight:700;color:#dc2626;margin-left:10px;">-₱${exp.amount.toFixed(2)}</span>
                </div>
            `).join('');
        }
        
        // Render payment breakdown
        const paymentContainer = document.getElementById('dailyPaymentBreakdown');
        const paymentMethods = {};
        sales.forEach(sale => {
            const method = sale.paymentMethod || 'cash';
            if (!paymentMethods[method]) paymentMethods[method] = { count: 0, total: 0 };
            paymentMethods[method].count++;
            paymentMethods[method].total += sale.total;
        });
        const methodLabels = { 'cash': 'Cash', 'card': 'Card', 'gcash': 'GCash', 'bank_transfer': 'Bank Transfer' };
        
        if (Object.keys(paymentMethods).length === 0) {
            paymentContainer.innerHTML = '<p style="color:#6b7280;text-align:center;padding:20px;">No payments today</p>';
        } else {
            paymentContainer.innerHTML = Object.entries(paymentMethods).map(([method, data]) => `
                <div style="display:flex;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #e5e7eb;">
                    <span><span class="payment-badge payment-${method}">${methodLabels[method] || method}</span></span>
                    <span style="color:#6b7280;">${data.count} txns</span>
                    <span style="font-weight:700;">₱${data.total.toFixed(2)}</span>
                </div>
            `).join('');
        }
        
        // Render stock alerts
        const stockContainer = document.getElementById('dailyStockAlerts');
        const lowStock = this.inventory.filter(item => item.stock <= this.lowStockThreshold).sort((a, b) => a.stock - b.stock);
        
        if (lowStock.length === 0) {
            stockContainer.innerHTML = '<p style="color:#6b7280;text-align:center;padding:20px;">All items well stocked</p>';
        } else {
            stockContainer.innerHTML = lowStock.slice(0, 10).map(item => `
                <div class="stock-alert-item">
                    <span class="stock-alert-name">${item.name}</span>
                    <span style="color:#6b7280;font-size:12px;">${item.partNumber}</span>
                    <span class="stock-alert-status ${item.stock === 0 ? 'stock-out' : 'stock-low'}">
                        ${item.stock === 0 ? 'OUT' : `Low: ${item.stock}`}
                    </span>
                </div>
            `).join('');
        }
        
        // Render hourly activity
        const hourlyContainer = document.getElementById('dailyHourlyActivity');
        const hourlyData = {};
        for (let i = 8; i <= 20; i++) hourlyData[i] = 0;
        
        sales.forEach(sale => {
            const hour = new Date(sale.date).getHours();
            if (hourlyData.hasOwnProperty(hour)) hourlyData[hour] += sale.total;
        });
        
        const maxHourly = Math.max(...Object.values(hourlyData), 1);
        
        hourlyContainer.innerHTML = Object.entries(hourlyData).map(([hour, value]) => {
            const percentage = (value / maxHourly) * 100;
            return `
                <div class="hourly-activity-bar">
                    <span class="hourly-time">${hour}:00</span>
                    <div class="hourly-bar-fill">
                        <div class="hourly-fill-amount" style="width:${percentage}%"></div>
                    </div>
                    <span class="hourly-amount">₱${value.toFixed(0)}</span>
                </div>
            `;
        }).join('');
        
        // Scroll to daily report
        if (dailySection) dailySection.scrollIntoView({ behavior: 'smooth' });
    }

    renderSummaryCards() {
        const sales = this.getFilteredSales();
        const expenses = this.getFilteredExpenses();
        
        const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
        document.getElementById('totalSales').textContent = `₱${totalSales.toFixed(2)}`;
        document.getElementById('totalTransactions').textContent = `${sales.length} transactions`;
        
        const totalCost = sales.reduce((sum, sale) => {
            return sum + sale.items.reduce((itemSum, item) => itemSum + ((item.cost || 0) * item.quantity), 0);
        }, 0);
        const totalRevenue = totalSales - totalCost;
        const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        const netProfit = totalRevenue - totalExpenses;
        const profitMargin = totalSales > 0 ? ((netProfit / totalSales) * 100) : 0;
        
        document.getElementById('totalRevenue').textContent = `₱${netProfit.toFixed(2)}`;
        document.getElementById('profitMargin').textContent = `${profitMargin.toFixed(1)}% margin`;
        
        const uniqueCustomers = new Set(sales.map(s => s.customer).filter(n => n !== 'Walk-in Customer'));
        document.getElementById('totalCustomers').textContent = uniqueCustomers.size;
        
        const totalItems = sales.reduce((sum, sale) => 
            sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
        );
        document.getElementById('totalItemsSold').textContent = totalItems;
        
        const averageSale = sales.length > 0 ? totalSales / sales.length : 0;
        document.getElementById('averageSale').textContent = `₱${averageSale.toFixed(2)}`;
        
        const outOfStock = this.inventory.filter(item => item.stock === 0).length;
        document.getElementById('outOfStock').textContent = outOfStock;
    }

    renderTopSellingItems(categoryFilter = 'all') {
        const sales = this.getFilteredSales();
        const container = document.getElementById('topSellingItems');
        
        // Add category filter dropdown if not exists
        if (!document.getElementById('topItemsCategoryFilter')) {
            const filterHTML = `
                <div style="padding: 10px 15px; border-bottom: 1px solid var(--border);">
                    <select id="topItemsCategoryFilter" style="padding: 5px 10px; border: 2px solid var(--border); border-radius: var(--radius); font-size: 13px; width: 100%;">
                        <option value="all">All Categories</option>
                        ${this.categories.map(cat => `<option value="${cat}">${this.getCategoryLabel(cat)}</option>`).join('')}
                    </select>
                </div>
            `;
            container.insertAdjacentHTML('beforebegin', filterHTML);
        }
        
        // Filter sales by category
        let filteredSales = sales;
        if (categoryFilter !== 'all') {
            filteredSales = sales.map(sale => ({
                ...sale,
                items: sale.items.filter(item => item.category === categoryFilter)
            })).filter(sale => sale.items.length > 0);
        }
        
        if (filteredSales.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>No sales data</p></div>';
            return;
        }
        
        const itemSales = {};
        filteredSales.forEach(sale => {
            sale.items.forEach(item => {
                const key = item.name;
                if (!itemSales[key]) {
                    itemSales[key] = { name: item.name, quantity: 0, revenue: 0, partNumber: item.partNumber };
                }
                itemSales[key].quantity += item.quantity;
                itemSales[key].revenue += item.price * item.quantity;
            });
        });
        
        const topItems = Object.values(itemSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
        
        container.innerHTML = topItems.map((item, index) => `
            <div class="list-item">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="rank-badge" style="background: ${index < 3 ? '#dc2626' : '#6b7280'}">${index + 1}</div>
                    <div class="list-item-info">
                        <div class="list-item-name">${item.name}</div>
                        <div class="list-item-subtitle">${item.partNumber} | Sold: ${item.quantity} units</div>
                    </div>
                </div>
                <div class="list-item-value">₱${item.revenue.toFixed(2)}</div>
            </div>
        `).join('');
        
        // Add event listener for category filter
        const filterSelect = document.getElementById('topItemsCategoryFilter');
        if (filterSelect) {
            filterSelect.value = categoryFilter;
            filterSelect.onchange = (e) => this.renderTopSellingItems(e.target.value);
        }
    }

    renderLowStockAlert(categoryFilter = 'all') {
        const container = document.getElementById('lowStockItems');
        
        // Add category filter dropdown if not exists
        if (!document.getElementById('lowStockCategoryFilter')) {
            const filterHTML = `
                <div style="padding: 10px 15px; border-bottom: 1px solid var(--border);">
                    <select id="lowStockCategoryFilter" style="padding: 5px 10px; border: 2px solid var(--border); border-radius: var(--radius); font-size: 13px; width: 100%;">
                        <option value="all">All Categories</option>
                        ${this.categories.map(cat => `<option value="${cat}">${this.getCategoryLabel(cat)}</option>`).join('')}
                    </select>
                </div>
            `;
            container.insertAdjacentHTML('beforebegin', filterHTML);
        }
        
        let lowStock = this.inventory.filter(item => item.stock <= this.lowStockThreshold);
        
        // Filter by category
        if (categoryFilter !== 'all') {
            lowStock = lowStock.filter(item => item.category === categoryFilter);
        }
        
        lowStock.sort((a, b) => a.stock - b.stock);
        
        if (lowStock.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><p>All items in stock</p></div>';
            return;
        }
        
        container.innerHTML = lowStock.map(item => `
            <div class="list-item">
                <div class="list-item-info">
                    <div class="list-item-name">
                        ${item.name}
                        <span class="${item.stock === 0 ? 'stock-out-badge' : 'stock-low-badge'}">
                            ${item.stock === 0 ? 'OUT OF STOCK' : `Low: ${item.stock}`}
                        </span>
                    </div>
                    <div class="list-item-subtitle">${item.partNumber} | ${this.getCategoryLabel(item.category)} | ${item.brand || ''}</div>
                </div>
                <div class="list-item-value">₱${item.price.toFixed(2)}</div>
            </div>
        `).join('');
        
        // Add event listener for category filter
        const filterSelect = document.getElementById('lowStockCategoryFilter');
        if (filterSelect) {
            filterSelect.value = categoryFilter;
            filterSelect.onchange = (e) => this.renderLowStockAlert(e.target.value);
        }
    }

    renderSalesByCategory() {
        const sales = this.getFilteredSales();
        const container = document.getElementById('salesByCategory');
        
        if (sales.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-chart-pie"></i><p>No data available</p></div>';
            return;
        }
        
        const categorySales = {};
        let totalSales = 0;
        
        sales.forEach(sale => {
            sale.items.forEach(item => {
                const category = item.category || 'other';
                if (!categorySales[category]) categorySales[category] = { revenue: 0, quantity: 0 };
                categorySales[category].revenue += item.price * item.quantity;
                categorySales[category].quantity += item.quantity;
                totalSales += item.price * item.quantity;
            });
        });
        
        const sorted = Object.entries(categorySales).sort((a, b) => b[1].revenue - a[1].revenue);
        
        container.innerHTML = sorted.map(([category, data]) => {
            const percentage = totalSales > 0 ? (data.revenue / totalSales * 100) : 0;
            const displayName = category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            
            return `
                <div class="list-item">
                    <div class="list-item-info" style="flex: 1;">
                        <div class="list-item-name">${displayName}</div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${percentage}%"></div>
                        </div>
                        <div class="list-item-subtitle">${data.quantity} units (${percentage.toFixed(1)}%)</div>
                    </div>
                    <div class="list-item-value">₱${data.revenue.toFixed(2)}</div>
                </div>
            `;
        }).join('');
    }

    renderPaymentMethods() {
        const sales = this.getFilteredSales();
        const container = document.getElementById('paymentMethodsBreakdown');
        
        if (sales.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-money-bill"></i><p>No payment data</p></div>';
            return;
        }
        
        const paymentMethods = {};
        sales.forEach(sale => {
            const method = sale.paymentMethod || 'cash';
            if (!paymentMethods[method]) paymentMethods[method] = { count: 0, total: 0 };
            paymentMethods[method].count++;
            paymentMethods[method].total += sale.total;
        });
        
        const methodLabels = { 'cash': 'Cash', 'card': 'Credit/Debit Card', 'gcash': 'GCash', 'bank_transfer': 'Bank Transfer' };
        
        container.innerHTML = Object.entries(paymentMethods).sort((a, b) => b[1].total - a[1].total)
            .map(([method, data]) => `
                <div class="list-item">
                    <div class="list-item-info">
                        <div class="list-item-name">${methodLabels[method] || method.replace('_', ' ')}</div>
                        <div class="list-item-subtitle">${data.count} transactions</div>
                    </div>
                    <div class="list-item-value">₱${data.total.toFixed(2)}</div>
                </div>
            `).join('');
    }

    renderTransactions() {
        const sales = this.getFilteredSales();
        const tbody = document.getElementById('transactionsBody');
        
        if (sales.length === 0) {
            tbody.innerHTML = '<tr class="empty-state"><td colspan="9"><i class="fas fa-receipt"></i><p>No transactions found</p></td></tr>';
            return;
        }
        
        tbody.innerHTML = sales.slice().reverse().map(sale => {
            const totalCost = sale.items.reduce((sum, item) => sum + ((item.cost || 0) * item.quantity), 0);
            const profit = sale.total - totalCost;
            const profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';
            
            return `
                <tr>
                    <td><strong>#${sale.receiptNumber}</strong></td>
                    <td>${new Date(sale.date).toLocaleString()}</td>
                    <td>${sale.cashier || '-'}</td>
                    <td>${sale.customer || 'Walk-in'}</td>
                    <td>${sale.vehicle || '-'}</td>
                    <td>${sale.items.length} items</td>
                    <td>₱${sale.total.toFixed(2)}</td>
                    <td><span class="payment-badge payment-${sale.paymentMethod || 'cash'}">${sale.paymentMethod || 'cash'}</span></td>
                    <td class="${profitClass}">₱${profit.toFixed(2)}</td>
                </tr>
            `;
        }).join('');
    }

    renderExpenses() {
        const expenses = this.getFilteredExpenses();
        const tbody = document.getElementById('expensesBody');
        const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        
        document.getElementById('totalExpenses').textContent = `₱${totalExpenses.toFixed(2)}`;
        
        const sales = this.getFilteredSales();
        const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
        const totalCost = sales.reduce((sum, sale) => {
            return sum + sale.items.reduce((itemSum, item) => itemSum + ((item.cost || 0) * item.quantity), 0);
        }, 0);
        const netProfit = (totalSales - totalCost) - totalExpenses;
        document.getElementById('netProfit').textContent = `₱${netProfit.toFixed(2)}`;
        
        if (expenses.length === 0) {
            tbody.innerHTML = '<tr class="empty-state"><td colspan="6"><i class="fas fa-receipt"></i><p>No expenses recorded</p></td></tr>';
            return;
        }
        
        tbody.innerHTML = expenses.slice().reverse().map(expense => `
            <tr>
                <td>${new Date(expense.date).toLocaleDateString()}</td>
                <td><span class="badge">${expense.category}</span></td>
                <td>${expense.description}</td>
                <td>₱${expense.amount.toFixed(2)}</td>
                <td>${expense.reference || '-'}</td>
                <td>
                    <button class="btn-text" onclick="reportsSystem.viewExpenseDetails(${expense.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-text" onclick="reportsSystem.deleteExpense(${expense.id})" style="color: #dc2626;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    renderInventoryValuation() {
        const totalItems = this.inventory.length;
        
        // Items with cost
        const itemsWithCost = this.inventory.filter(item => item.cost && item.cost > 0);
        const itemsWithoutCost = this.inventory.filter(item => !item.cost || item.cost === 0);
        
        // Stock value (selling price) for all items
        const totalStockValue = this.inventory.reduce((sum, item) => sum + (item.price * item.stock), 0);
        
        // Stock value for items WITH cost
        const withCostStockValue = itemsWithCost.reduce((sum, item) => sum + (item.price * item.stock), 0);
        const withCostCostValue = itemsWithCost.reduce((sum, item) => sum + ((item.cost || 0) * item.stock), 0);
        const withCostProfit = withCostStockValue - withCostCostValue;
        
        // Stock value for items WITHOUT cost
        const withoutCostStockValue = itemsWithoutCost.reduce((sum, item) => sum + (item.price * item.stock), 0);
        
        // Totals
        const totalCostValue = this.inventory.reduce((sum, item) => sum + ((item.cost || 0) * item.stock), 0);
        const potentialProfit = totalStockValue - totalCostValue;
        
        document.getElementById('totalInventoryItems').textContent = totalItems;
        document.getElementById('totalStockValue').textContent = `₱${totalStockValue.toFixed(2)}`;
        document.getElementById('totalCostValue').textContent = `₱${totalCostValue.toFixed(2)}`;
        document.getElementById('potentialProfit').textContent = `₱${potentialProfit.toFixed(2)}`;
        
        // New elements
        const withCostEl = document.getElementById('withCostStockValue');
        const withCostCostEl = document.getElementById('withCostCostValue');
        const withCostProfitEl = document.getElementById('withCostProfitValue');
        const withoutCostEl = document.getElementById('withoutCostStockValue');
        const itemsWithCostCount = document.getElementById('itemsWithCostCount');
        const itemsWithoutCostCount = document.getElementById('itemsWithoutCostCount');
        
        if (withCostEl) withCostEl.textContent = `₱${withCostStockValue.toFixed(2)}`;
        if (withCostCostEl) withCostCostEl.textContent = `₱${withCostCostValue.toFixed(2)}`;
        if (withCostProfitEl) withCostProfitEl.textContent = `₱${withCostProfit.toFixed(2)}`;
        if (withoutCostEl) withoutCostEl.textContent = `₱${withoutCostStockValue.toFixed(2)}`;
        if (itemsWithCostCount) itemsWithCostCount.textContent = itemsWithCost.length;
        if (itemsWithoutCostCount) itemsWithoutCostCount.textContent = itemsWithoutCost.length;
    }

    renderTopCustomers() {
        const sales = this.getFilteredSales();
        const container = document.getElementById('topCustomers');
        
        if (sales.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>No customer data</p></div>';
            return;
        }
        
        const customers = {};
        sales.forEach(sale => {
            const customer = sale.customer || 'Walk-in Customer';
            if (!customers[customer]) customers[customer] = { name: customer, visits: 0, total: 0 };
            customers[customer].visits++;
            customers[customer].total += sale.total;
        });
        
        const topCustomers = Object.values(customers).filter(c => c.name !== 'Walk-in Customer')
            .sort((a, b) => b.total - a.total).slice(0, 10);
        
        if (topCustomers.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>No registered customers</p></div>';
            return;
        }
        
        container.innerHTML = topCustomers.map((customer, index) => `
            <div class="list-item">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="rank-badge" style="background: ${index < 3 ? '#dc2626' : '#6b7280'}">${index + 1}</div>
                    <div class="list-item-info">
                        <div class="list-item-name">${customer.name}</div>
                        <div class="list-item-subtitle">${customer.visits} visits</div>
                    </div>
                </div>
                <div class="list-item-value">₱${customer.total.toFixed(2)}</div>
            </div>
        `).join('');
    }

    renderHourlySales() {
        const sales = this.getFilteredSales();
        const container = document.getElementById('hourlySales');
        
        if (sales.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-clock"></i><p>No data available</p></div>';
            return;
        }
        
        const hourlyData = {};
        for (let i = 8; i <= 20; i++) hourlyData[i] = 0;
        
        sales.forEach(sale => {
            const hour = new Date(sale.date).getHours();
            if (hourlyData.hasOwnProperty(hour)) hourlyData[hour] += sale.total;
        });
        
        const maxValue = Math.max(...Object.values(hourlyData), 1);
        
        container.innerHTML = Object.entries(hourlyData).map(([hour, value]) => {
            const percentage = (value / maxValue) * 100;
            return `
                <div class="hour-item">
                    <span class="hour-label">${hour}:00</span>
                    <div class="hour-bar">
                        <div class="hour-fill" style="width: ${percentage}%"></div>
                    </div>
                    <span class="hour-value">₱${value.toFixed(0)}</span>
                </div>
            `;
        }).join('');
    }

    renderSalesChart(period = 'daily') {
        const ctx = document.getElementById('salesChart');
        if (!ctx) return;
        
        if (this.salesChart) {
            this.salesChart.destroy();
            this.salesChart = null;
        }
        
        const sales = this.getFilteredSales();
        
        if (sales.length === 0) return;
        
        const dateMap = {};
        sales.forEach(sale => {
            const date = new Date(sale.date).toLocaleDateString();
            if (!dateMap[date]) dateMap[date] = 0;
            dateMap[date] += sale.total;
        });
        
        const labels = Object.keys(dateMap).sort();
        const data = labels.map(date => dateMap[date]);
        
        this.salesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Sales',
                    data: data,
                    borderColor: '#dc2626',
                    backgroundColor: 'rgba(220, 38, 38, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: value => '₱' + value.toFixed(0) }
                    }
                }
            }
        });
    }

    openExpenseModal() {
        document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('expenseCategory').value = 'supplies';
        document.getElementById('expenseDescription').value = '';
        document.getElementById('expenseAmount').value = '';
        document.getElementById('expenseReference').value = '';
        document.getElementById('expenseNotes').value = '';
        document.getElementById('expenseModal').classList.add('active');
    }

    saveExpense() {
        const date = document.getElementById('expenseDate').value;
        const category = document.getElementById('expenseCategory').value;
        const description = document.getElementById('expenseDescription').value.trim();
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        const reference = document.getElementById('expenseReference').value.trim();
        const notes = document.getElementById('expenseNotes').value.trim();
        
        if (!date || !description || !amount) {
            alert('Please fill in all required fields');
            return;
        }
        
        const expense = {
            id: Date.now(),
            date: date,
            category: category,
            description: description,
            amount: amount,
            reference: reference,
            notes: notes
        };
        
        this.expenses.push(expense);
        this.saveExpenseToFirestore(expense);
        this.closeAllModals();
        this.renderAllReports();
        this.showNotification('Expense saved successfully', 'success');
    }

    async deleteExpense(id) {
        if (confirm('Are you sure you want to delete this expense?')) {
            this.expenses = this.expenses.filter(e => e.id !== id);
            try {
                await db.collection('expenses').doc(id.toString()).delete();
            } catch (error) {
                console.error('Error deleting expense:', error);
            }
            this.renderAllReports();
            this.showNotification('Expense deleted', 'success');
        }
    }

    viewExpenseDetails(id) {
        const expense = this.expenses.find(e => e.id === id);
        if (!expense) return;
        alert(`Expense Details:\n\nDate: ${new Date(expense.date).toLocaleDateString()}\nCategory: ${expense.category}\nDescription: ${expense.description}\nAmount: ₱${expense.amount.toFixed(2)}\nReference: ${expense.reference || '-'}\nNotes: ${expense.notes || '-'}`);
    }

    renderDebts() {
        const debts = JSON.parse(localStorage.getItem('motorPartsDebts') || '[]');
        
        const pendingDebts = debts.filter(d => d.status === 'pending');
        const paidDebts = debts.filter(d => d.status === 'paid');
        const totalOutstanding = pendingDebts.reduce((sum, d) => sum + d.balance, 0);
        
        const today = new Date().toDateString();
        const collectedToday = debts
            .filter(d => d.status === 'paid' && new Date(d.paidDate || d.date).toDateString() === today)
            .reduce((sum, d) => sum + (d.total - (d.balance || 0)), 0);
        
        document.getElementById('totalOutstanding').textContent = `₱${totalOutstanding.toFixed(2)}`;
        document.getElementById('pendingDebts').textContent = pendingDebts.length;
        document.getElementById('paidDebtsCount').textContent = paidDebts.length;
        document.getElementById('collectedToday').textContent = `₱${collectedToday.toFixed(2)}`;
        document.getElementById('pendingTabCount').textContent = pendingDebts.length;
        document.getElementById('paidTabCount').textContent = paidDebts.length;
        
        // Render pending table
        const pendingTbody = document.getElementById('pendingDebtsBody');
        if (pendingDebts.length === 0) {
            pendingTbody.innerHTML = '<tr class="empty-state"><td colspan="8"><i class="fas fa-check-circle"></i><p>No pending debts</p></td></tr>';
        } else {
            pendingTbody.innerHTML = pendingDebts.sort((a, b) => new Date(b.date) - new Date(a.date)).map(debt => `
                <tr>
                    <td><strong>#${debt.receiptNumber}</strong></td>
                    <td>${new Date(debt.date).toLocaleDateString()}</td>
                    <td>${debt.customer}</td>
                    <td>₱${debt.total.toFixed(2)}</td>
                    <td style="color: #059669;">₱${debt.paid.toFixed(2)}</td>
                    <td style="color: #dc2626; font-weight: 700;">₱${debt.balance.toFixed(2)}</td>
                    <td><span class="stock-badge out">PENDING</span></td>
                    <td>
                        <button class="btn-primary btn-sm" onclick="reportsSystem.markDebtAsPaid(${debt.id})">
                            <i class="fas fa-check"></i> Pay
                        </button>
                    </td>
                </tr>
            `).join('');
        }
        
        // Render paid table
        const paidTbody = document.getElementById('paidDebtsBody');
        if (paidDebts.length === 0) {
            paidTbody.innerHTML = '<tr class="empty-state"><td colspan="8"><i class="fas fa-check-circle"></i><p>No paid debts</p></td></tr>';
        } else {
            paidTbody.innerHTML = paidDebts.sort((a, b) => new Date(b.paidDate || b.date) - new Date(a.paidDate || a.date)).map(debt => `
                <tr>
                    <td><strong>#${debt.receiptNumber}</strong></td>
                    <td>${new Date(debt.date).toLocaleDateString()}</td>
                    <td>${debt.customer}</td>
                    <td>₱${debt.total.toFixed(2)}</td>
                    <td style="color: #059669;">₱${debt.total.toFixed(2)}</td>
                    <td style="color: #059669; font-weight: 700;">PAID</td>
                    <td><span class="stock-badge in">PAID</span></td>
                    <td>${new Date(debt.paidDate || debt.date).toLocaleDateString()}</td>
                </tr>
            `).join('');
        }
        
        // Tab switching
        document.querySelectorAll('.debt-tab').forEach(tab => {
            tab.onclick = function() {
                document.querySelectorAll('.debt-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                const tabType = this.dataset.tab;
                document.getElementById('pendingDebtsTable').style.display = tabType === 'pending' ? 'block' : 'none';
                document.getElementById('paidDebtsTable').style.display = tabType === 'paid' ? 'block' : 'none';
            };
        });
    }

    markDebtAsPaid(id) {
        const debts = JSON.parse(localStorage.getItem('motorPartsDebts') || '[]');
        const debtIndex = debts.findIndex(d => d.id === id);
        
        if (debtIndex !== -1) {
            const amount = prompt(`Enter payment amount for debt #${debts[debtIndex].receiptNumber}:\n\nRemaining Balance: ₱${debts[debtIndex].balance.toFixed(2)}`, debts[debtIndex].balance.toFixed(2));
            
            if (amount) {
                const paymentAmount = parseFloat(amount);
                if (isNaN(paymentAmount) || paymentAmount <= 0) {
                    alert('Invalid amount');
                    return;
                }
                
                if (paymentAmount >= debts[debtIndex].balance) {
                    debts[debtIndex].status = 'paid';
                    debts[debtIndex].paidDate = new Date().toISOString();
                    this.showNotification('Debt marked as fully paid', 'success');
                } else {
                    debts[debtIndex].balance -= paymentAmount;
                    debts[debtIndex].paid += paymentAmount;
                    this.showNotification(`Partial payment of ₱${paymentAmount.toFixed(2)} recorded. Remaining: ₱${debts[debtIndex].balance.toFixed(2)}`, 'info');
                }
                
                localStorage.setItem('motorPartsDebts', JSON.stringify(debts));
                this.renderDebts();
            }
        }
    }

    exportTransactions() {
        const sales = this.getFilteredSales();
        if (sales.length === 0) { alert('No transactions to export'); return; }
        
        let csv = 'Receipt #,Date,Customer,Vehicle,Items,Total,Payment Method,Profit\n';
        sales.forEach(sale => {
            const totalCost = sale.items.reduce((sum, item) => sum + ((item.cost || 0) * item.quantity), 0);
            const profit = sale.total - totalCost;
            csv += `#${sale.receiptNumber},"${new Date(sale.date).toLocaleString()}","${sale.customer || 'Walk-in'}","${sale.vehicle || '-'}",${sale.items.length},₱${sale.total.toFixed(2)},${sale.paymentMethod || 'cash'},₱${profit.toFixed(2)}\n`;
        });
        
        this.downloadCSV(csv, 'transactions.csv');
    }

    exportLowStock() {
        const lowStock = this.inventory.filter(item => item.stock <= this.lowStockThreshold);
        if (lowStock.length === 0) { alert('No low stock items to export'); return; }
        
        let csv = 'Part Number,Name,Category,Brand,Stock,Price,Cost,Supplier,Vehicles\n';
        lowStock.forEach(item => {
            csv += `"${item.partNumber}","${item.name}","${item.category}","${item.brand || ''}",${item.stock},₱${item.price.toFixed(2)},₱${(item.cost || 0).toFixed(2)},"${item.supplier || ''}","${item.vehicles || ''}"\n`;
        });
        
        this.downloadCSV(csv, 'low-stock.csv');
    }

    exportDebts() {
        const debts = JSON.parse(localStorage.getItem('motorPartsDebts') || '[]');
        if (debts.length === 0) { alert('No debts to export'); return; }
        
        let csv = 'Receipt #,Date,Customer,Total,Paid,Balance,Status\n';
        debts.forEach(d => {
            csv += `#${d.receiptNumber},"${new Date(d.date).toLocaleDateString()}","${d.customer}",₱${d.total.toFixed(2)},₱${d.paid.toFixed(2)},₱${d.balance.toFixed(2)},${d.status}\n`;
        });
        
        this.downloadCSV(csv, 'debts_report.csv');
    }

    downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('active'));
    }

    initSwipeable() {
        const tables = document.querySelectorAll('.table-container');
        tables.forEach(table => {
            table.style.overflowX = 'auto';
            table.style.cursor = 'default';
        });
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; padding: 15px 25px;
            background: ${type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : '#4b5563'};
            color: white; border-radius: 8px; z-index: 2000;
            animation: slideIn 0.3s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: 'Segoe UI', sans-serif; font-weight: 600;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    updateDateTime() {
        const now = new Date();
        const options = { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        };
        const dateTimeEl = document.getElementById('dateTime');
        if (dateTimeEl) {
            dateTimeEl.textContent = now.toLocaleDateString('en-US', options);
        }
    }
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(400px); opacity: 0; } }
`;
document.head.appendChild(style);

const reportsSystem = new ReportsSystem();