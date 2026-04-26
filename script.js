// Motor Parts POS System - Complete Functionality

class POSSystem {
    constructor() {
        this.inventory = [];
        this.cart = [];
        this.discount = 0;
        this.paymentMethod = 'cash';
        this.salesHistory = [];
        this.receiptNumber = 1000;
        this.heldTransaction = null;
        this.categories = [
            'engine',
            'electrical',
            'body',
            'brake',
            'suspension',
            'transmission',
            'exhaust',
            'other'
        ];
        
        this.init();
    }

    loadCategories() {
        return this.categories;
    }

    saveCategories() {
        this.saveToFirestore();
    }

    async init() {
        await this.loadFromFirestore();
        this.setupEventListeners();
        this.setupSearchListeners();
        this.updateDateTime();
        setInterval(() => this.updateDateTime(), 1000);
        this.renderInventory();
        this.updateCart();
        this.populateCategoryDropdowns();
        
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
        
        // Hide settings from cashiers
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn && currentUser.role === 'cashier') {
            settingsBtn.style.display = 'none';
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    async loadFromFirestore() {
        try {
            // Load inventory
            const inventorySnapshot = await db.collection('inventory').get();
            this.inventory = inventorySnapshot.docs.map(doc => ({
                id: parseInt(doc.id),
                ...doc.data()
            }));
            
            // Load sales
            const salesSnapshot = await db.collection('sales').get();
            this.salesHistory = salesSnapshot.docs.map(doc => ({
                receiptNumber: doc.id,
                ...doc.data()
            }));
            
            // Load settings
            const settingsDoc = await db.collection('settings').doc('general').get();
            if (settingsDoc.exists) {
                const settings = settingsDoc.data();
                if (settings.receiptNumber) this.receiptNumber = settings.receiptNumber;
                if (settings.categories) this.categories = settings.categories;
            }
        } catch (error) {
            console.error('Error loading from Firestore:', error);
        }
    }

    async saveToFirestore() {
        try {
            await db.collection('settings').doc('general').set({
                receiptNumber: this.receiptNumber,
                categories: this.categories,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    async saveInventoryItem(item) {
        try {
            await db.collection('inventory').doc(item.id.toString()).set({
                ...item,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error saving inventory item:', error);
        }
    }

    async saveTransaction(transaction) {
        try {
            await db.collection('sales').doc(transaction.receiptNumber.toString()).set({
                ...transaction,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error saving transaction:', error);
        }
    }

    async deleteInventoryItem(itemId) {
        try {
            await db.collection('inventory').doc(itemId.toString()).delete();
        } catch (error) {
            console.error('Error deleting inventory item:', error);
        }
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchProduct');
        const clearSearch = document.getElementById('clearSearch');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.searchInventory(e.target.value));
        }
        if (clearSearch) {
            clearSearch.addEventListener('click', () => {
                document.getElementById('searchProduct').value = '';
                this.renderInventory();
            });
        }

        // Category filter
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => this.filterByCategory(e.target.value));
        }

        // Inventory management buttons
        const addItemBtn = document.getElementById('openAddItemModal');
        const bulkAddBtn = document.getElementById('openBulkAddModal');
        const saveItemBtn = document.getElementById('saveNewItem');
        const bulkAddProcessBtn = document.getElementById('processBulkAdd');
        
        if (addItemBtn) addItemBtn.addEventListener('click', () => this.openModal('addItemModal'));
        if (bulkAddBtn) bulkAddBtn.addEventListener('click', () => this.openModal('bulkAddModal'));
        if (saveItemBtn) saveItemBtn.addEventListener('click', () => this.saveNewItem());
        if (bulkAddProcessBtn) bulkAddProcessBtn.addEventListener('click', () => this.processBulkAdd());

        // Sales history
        const viewSalesHistoryBtn = document.getElementById('viewSalesHistory');
        if (viewSalesHistoryBtn) {
            viewSalesHistoryBtn.addEventListener('click', () => this.showSalesHistory());
        }

        // Clear cart button on main page
        const clearCartBtn = document.getElementById('clearCartBtn');
        if (clearCartBtn) {
            clearCartBtn.addEventListener('click', () => this.clearCart());
        }

        // Category management
        const manageCategoriesBtn = document.getElementById('manageCategories');
        const addNewCategoryBtn = document.getElementById('addNewCategory');
        const resetCategoriesBtn = document.getElementById('resetCategories');
        const addNewCategoryInputBtn = document.getElementById('addNewCategoryBtn');
        
        if (manageCategoriesBtn) {
            manageCategoriesBtn.addEventListener('click', () => {
                this.renderCategoryList();
                this.openModal('categoryModal');
            });
        }
        if (addNewCategoryBtn) addNewCategoryBtn.addEventListener('click', () => this.addNewCategory());
        if (resetCategoriesBtn) resetCategoriesBtn.addEventListener('click', () => this.resetCategories());
        if (addNewCategoryInputBtn) addNewCategoryInputBtn.addEventListener('click', () => this.addNewCategoryFromInput());

        // Add category on Enter key
        const newCategoryInput = document.getElementById('newCategoryInput');
        const newCategoryName = document.getElementById('newCategoryName');
        
        if (newCategoryInput) {
            newCategoryInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addNewCategoryFromInput();
                }
            });
        }
        if (newCategoryName) {
            newCategoryName.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addNewCategory();
                }
            });
        }

        // Close modals
        document.querySelectorAll('.close-modal, .close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        // Close modals on outside click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });

        // Refresh inventory button
        const refreshBtn = document.getElementById('refreshInventory');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.renderInventory());
        }

        // Help/Tutorial modal
        const helpBtn = document.getElementById('helpBtn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => this.openModal('helpModal'));
        }

        // Tutorial tabs
        document.querySelectorAll('.tutorial-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active from all tabs
                document.querySelectorAll('.tutorial-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tutorial-panel').forEach(p => p.classList.remove('active'));
                
                // Activate clicked tab
                tab.classList.add('active');
                const targetTab = tab.dataset.tab;
                const panel = document.getElementById(`tab-${targetTab}`);
                if (panel) panel.classList.add('active');
            });
        });

        // Calculator modal
        const calculatorBtn = document.getElementById('calculatorBtn');
        if (calculatorBtn) {
            calculatorBtn.addEventListener('click', () => this.openModal('calculatorModal'));
        }

        // Calculator tabs
        document.querySelectorAll('.calc-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.calc-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.calc-panel').forEach(p => p.classList.remove('active'));
                
                tab.classList.add('active');
                const targetTab = tab.dataset.tab;
                const panel = document.getElementById(`panel-${targetTab}`);
                if (panel) panel.classList.add('active');
            });
        });

        // Markup Calculator
        const calcMarkupBtn = document.getElementById('calcMarkup');
        if (calcMarkupBtn) {
            calcMarkupBtn.addEventListener('click', () => {
                const cost = parseFloat(document.getElementById('markupCost').value) || 0;
                const percent = parseFloat(document.getElementById('markupPercent').value) || 0;
                
                const markupAmount = cost * (percent / 100);
                const sellingPrice = cost + markupAmount;
                const profitMargin = sellingPrice > 0 ? ((sellingPrice - cost) / sellingPrice * 100) : 0;
                
                document.getElementById('markupAmount').textContent = `₱${markupAmount.toFixed(2)}`;
                document.getElementById('markupSellingPrice').textContent = `₱${sellingPrice.toFixed(2)}`;
                document.getElementById('markupProfitMargin').textContent = `${profitMargin.toFixed(1)}%`;
                document.getElementById('markupResults').style.display = 'block';
            });
        }

        // Profit Margin Calculator
        const calcMarginBtn = document.getElementById('calcMargin');
        if (calcMarginBtn) {
            calcMarginBtn.addEventListener('click', () => {
                const cost = parseFloat(document.getElementById('marginCost').value) || 0;
                const selling = parseFloat(document.getElementById('marginSelling').value) || 0;
                
                const profit = selling - cost;
                const margin = selling > 0 ? (profit / selling * 100) : 0;
                const markup = cost > 0 ? (profit / cost * 100) : 0;
                
                document.getElementById('marginProfit').textContent = `₱${profit.toFixed(2)}`;
                document.getElementById('marginPercent').textContent = `${margin.toFixed(1)}%`;
                document.getElementById('marginMarkup').textContent = `${markup.toFixed(1)}%`;
                document.getElementById('marginResults').style.display = 'block';
            });
        }

        // Discount Calculator
        const calcDiscountBtn = document.getElementById('calcDiscount');
        if (calcDiscountBtn) {
            calcDiscountBtn.addEventListener('click', () => {
                const origPrice = parseFloat(document.getElementById('discOrigPrice').value) || 0;
                const discPercent = parseFloat(document.getElementById('discPercent').value) || 0;
                const discAmount = parseFloat(document.getElementById('discAmount').value) || 0;
                
                let discountAmount = 0;
                if (discPercent > 0) {
                    discountAmount = origPrice * (discPercent / 100);
                } else if (discAmount > 0) {
                    discountAmount = discAmount;
                }
                
                const finalPrice = origPrice - discountAmount;
                const savePercent = origPrice > 0 ? (discountAmount / origPrice * 100) : 0;
                
                document.getElementById('discResultAmount').textContent = `₱${discountAmount.toFixed(2)}`;
                document.getElementById('discFinalPrice').textContent = `₱${finalPrice.toFixed(2)}`;
                document.getElementById('discSavePercent').textContent = `${savePercent.toFixed(1)}%`;
                document.getElementById('discountResults').style.display = 'block';
            });
        }

        // VAT Calculator
        const calcAddVatBtn = document.getElementById('calcAddVat');
        const calcRemoveVatBtn = document.getElementById('calcRemoveVat');
        if (calcAddVatBtn) {
            calcAddVatBtn.addEventListener('click', () => {
                const amount = parseFloat(document.getElementById('vatAmount').value) || 0;
                const rate = parseFloat(document.getElementById('vatRate').value) || 12;
                
                const vatAmount = amount * (rate / 100);
                const total = amount + vatAmount;
                
                document.getElementById('vatResultAmount').textContent = `₱${vatAmount.toFixed(2)}`;
                document.getElementById('vatResultFinal').textContent = `₱${total.toFixed(2)}`;
                document.getElementById('vatResults').style.display = 'block';
            });
        }
        if (calcRemoveVatBtn) {
            calcRemoveVatBtn.addEventListener('click', () => {
                const amount = parseFloat(document.getElementById('vatAmount').value) || 0;
                const rate = parseFloat(document.getElementById('vatRate').value) || 12;
                
                const originalAmount = amount / (1 + rate / 100);
                const vatAmount = amount - originalAmount;
                
                document.getElementById('vatResultAmount').textContent = `₱${vatAmount.toFixed(2)}`;
                document.getElementById('vatResultFinal').textContent = `₱${originalAmount.toFixed(2)}`;
                document.getElementById('vatResults').style.display = 'block';
            });
        }

        // Cost Splitter
        const calcSplitBtn = document.getElementById('calcSplit');
        if (calcSplitBtn) {
            calcSplitBtn.addEventListener('click', () => {
                const total = parseFloat(document.getElementById('splitTotal').value) || 0;
                const units = parseInt(document.getElementById('splitUnits').value) || 1;
                const additional = parseFloat(document.getElementById('splitAdditional').value) || 0;
                
                const totalInvest = total + additional;
                const costPerUnit = totalInvest / units;
                const suggested30 = costPerUnit / (1 - 0.30);
                const suggested50 = costPerUnit / (1 - 0.50);
                
                document.getElementById('splitTotalInvest').textContent = `₱${totalInvest.toFixed(2)}`;
                document.getElementById('splitCostPerUnit').textContent = `₱${costPerUnit.toFixed(2)}`;
                document.getElementById('splitSuggested').textContent = `₱${suggested30.toFixed(2)}`;
                document.getElementById('splitSuggested50').textContent = `₱${suggested50.toFixed(2)}`;
                document.getElementById('splitResults').style.display = 'block';
            });
        }

        // Bulk Pricing Calculator
        const calcBulkBtn = document.getElementById('calcBulk');
        if (calcBulkBtn) {
            calcBulkBtn.addEventListener('click', () => {
                const costUnit = parseFloat(document.getElementById('bulkCostUnit').value) || 0;
                const sellUnit = parseFloat(document.getElementById('bulkSellUnit').value) || 0;
                const qty = parseInt(document.getElementById('bulkQuantity').value) || 0;
                
                const totalCost = costUnit * qty;
                const totalRevenue = sellUnit * qty;
                const totalProfit = totalRevenue - totalCost;
                const profitUnit = sellUnit - costUnit;
                const margin = totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0;
                
                document.getElementById('bulkTotalCost').textContent = `₱${totalCost.toFixed(2)}`;
                document.getElementById('bulkTotalRevenue').textContent = `₱${totalRevenue.toFixed(2)}`;
                document.getElementById('bulkTotalProfit').textContent = `₱${totalProfit.toFixed(2)}`;
                document.getElementById('bulkProfitUnit').textContent = `₱${profitUnit.toFixed(2)}`;
                document.getElementById('bulkMargin').textContent = `${margin.toFixed(1)}%`;
                document.getElementById('bulkResults').style.display = 'block';
            });
        }

        // Settings modal
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.loadEmployees();
                this.openModal('settingsModal');
            });
        }

        // Add employee
        const addEmployeeBtn = document.getElementById('addEmployeeBtn');
        if (addEmployeeBtn) {
            addEmployeeBtn.addEventListener('click', () => this.openModal('addEmployeeModal'));
        }

        const saveEmployee = document.getElementById('saveEmployee');
        if (saveEmployee) {
            saveEmployee.addEventListener('click', () => this.addEmployee());
        }

        // Danger zone
        const deleteAllSalesBtn = document.getElementById('deleteAllSalesBtn');
        if (deleteAllSalesBtn) {
            deleteAllSalesBtn.addEventListener('click', () => this.deleteAllSales());
        }

        const resetInventoryBtn = document.getElementById('resetInventoryBtn');
        if (resetInventoryBtn) {
            resetInventoryBtn.addEventListener('click', () => this.resetInventory());
        }

        const wipeAllDataBtn = document.getElementById('wipeAllDataBtn');
        if (wipeAllDataBtn) {
            wipeAllDataBtn.addEventListener('click', () => this.wipeAllData());
        }

        // Logout from settings
        const logoutFromSettings = document.getElementById('logoutFromSettings');
        if (logoutFromSettings) {
            logoutFromSettings.addEventListener('click', () => {
                auth.signOut().then(() => {
                    localStorage.removeItem('currentUser');
                    localStorage.removeItem('cashierName');
                    window.location.href = 'login.html';
                });
            });
        }
    }

    handleKeyboardShortcuts(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return; // Don't trigger shortcuts when typing in input fields
        }

        switch(e.key) {
            case 'F8':
                e.preventDefault();
                if (this.cart.length > 0) this.processPayment();
                break;
            case 'F2':
                e.preventDefault();
                this.openModal('addItemModal');
                break;
            case 'Escape':
                e.preventDefault();
                this.closeAllModals();
                break;
        }
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
        document.getElementById('dateTime').textContent = now.toLocaleDateString('en-US', options);
    }

    // Inventory Management
    findItemByPartNumberOrName(searchTerm) {
        searchTerm = searchTerm.toLowerCase();
        return this.inventory.find(item => 
            item.partNumber.toLowerCase() === searchTerm ||
            item.barcode === searchTerm ||
            item.name.toLowerCase().includes(searchTerm) ||
            item.partNumber.toLowerCase().includes(searchTerm)
        );
    }

    searchInventory(query) {
        if (!query) {
            this.renderInventory();
            return;
        }
        
        query = query.toLowerCase();
        const filtered = this.inventory.filter(item =>
            item.name.toLowerCase().includes(query) ||
            item.partNumber.toLowerCase().includes(query) ||
            (item.barcode && item.barcode.includes(query)) ||
            (item.brand && item.brand.toLowerCase().includes(query)) ||
            (item.vehicles && item.vehicles.toLowerCase().includes(query)) ||
            (item.category && this.getCategoryLabel(item.category).toLowerCase().includes(query))
        );
        this.renderInventory(filtered);
    }

    setupSearchListeners() {
        const searchInput = document.getElementById('searchProduct');
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const searchTerm = searchInput.value.trim();
                const foundItem = this.findItemByPartNumberOrName(searchTerm);
                if (foundItem) {
                    this.addToCart(foundItem);
                    searchInput.value = '';
                    this.searchInventory('');
                }
            }
        });
    }

    filterByCategory(category) {
        if (category === 'all') {
            this.renderInventory();
        } else {
            const filtered = this.inventory.filter(item => item.category === category);
            this.renderInventory(filtered);
        }
    }

    saveNewItem() {
        const partNumber = document.getElementById('newPartNumber').value.trim();
        const name = document.getElementById('newPartName').value.trim();
        const price = parseFloat(document.getElementById('newPrice').value);
        
        if (!partNumber || !name || !price) {
            alert('Please fill in Part Number, Part Name, and Price');
            return;
        }

        // Check for duplicate part numbers
        if (this.inventory.some(item => item.partNumber === partNumber)) {
            alert('A part with this Part Number already exists');
            return;
        }

        const newItem = {
            id: Date.now(),
            partNumber: partNumber,
            barcode: document.getElementById('newBarcode').value.trim(),
            name: name,
            category: document.getElementById('newCategory').value,
            brand: document.getElementById('newBrand').value.trim(),
            price: price,
            cost: parseFloat(document.getElementById('newCost').value) || 0,
            stock: parseInt(document.getElementById('newStock').value) || 0,
            supplier: document.getElementById('newSupplier').value.trim(),
            notes: document.getElementById('newNotes').value.trim(),
            dateAdded: new Date().toISOString()
        };

        this.inventory.push(newItem);
        this.saveInventoryItem(newItem);
        this.saveToFirestore();
        this.renderInventory();
        this.closeAllModals();
        this.clearAddItemForm();
        
        // Show success message
        this.showNotification(`Part "${name}" added successfully`, 'success');
    }

    clearAddItemForm() {
        ['newPartNumber', 'newBarcode', 'newPartName', 'newBrand', 'newPrice', 
         'newCost', 'newStock', 'newSupplier', 'newNotes'].forEach(id => {
            document.getElementById(id).value = '';
        });
        document.getElementById('newCategory').value = 'engine';
    }

    processBulkAdd() {
        const data = document.getElementById('bulkPartsData').value.trim();
        if (!data) {
            alert('Please enter parts data');
            return;
        }

        const skipDuplicates = document.getElementById('skipDuplicates').checked;
        const lines = data.split('\n').filter(line => line.trim());
        let added = 0;
        let skipped = 0;
        let errors = 0;

        lines.forEach((line, index) => {
            try {
                const parts = line.split(',').map(part => part.trim());
                if (parts.length < 4) {
                    errors++;
                    return;
                }

                const [partNumber, name, category, price, cost = 0, stock = 0, brand = '', supplier = ''] = parts;

                if (skipDuplicates && this.inventory.some(item => item.partNumber === partNumber)) {
                    skipped++;
                    return;
                }

                const newItem = {
                    id: Date.now() + index,
                    partNumber: partNumber,
                    barcode: '',
                    name: name,
                    category: category || 'other',
                    brand: brand,
                    price: parseFloat(price) || 0,
                    cost: parseFloat(cost) || 0,
                    stock: parseInt(stock) || 0,
                    supplier: supplier,
                    notes: '',
                    dateAdded: new Date().toISOString()
                };

                this.inventory.push(newItem);
                this.saveInventoryItem(newItem);
                added++;
            } catch (error) {
                errors++;
            }
        });

        this.saveToFirestore();
        this.renderInventory();
        this.closeAllModals();
        document.getElementById('bulkPartsData').value = '';
        
        this.showNotification(`Imported ${added} parts. ${skipped} skipped. ${errors} errors.`, 'success');
    }

    deleteItem(itemId) {
        if (confirm('Are you sure you want to delete this item?')) {
            this.inventory = this.inventory.filter(item => item.id !== itemId);
            this.deleteInventoryItem(itemId);
            this.saveToFirestore();
            this.renderInventory();
            this.showNotification('Item deleted successfully', 'success');
        }
    }

    renderInventory(items = null) {
        const itemsToRender = items || this.inventory;
        const tbody = document.getElementById('inventoryTableBody');

        if (itemsToRender.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-state">
                    <td colspan="6">
                        <i class="fas fa-box-open"></i>
                        <p>${items ? 'No parts match your search' : 'No parts in inventory yet'}</p>
                        <p class="sub-text">${items ? 'Try different search terms' : 'Click "Add New Part" to get started'}</p>
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = itemsToRender.map(item => `
            <tr>
                <td><strong>${item.partNumber}</strong></td>
                <td>
                    ${item.name}
                    ${item.brand ? `<br><small class="text-muted">${item.brand}</small>` : ''}
                </td>
                <td><span class="badge">${this.getCategoryLabel(item.category)}</span></td>
                <td style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.vehicles || ''}">
                    ${item.vehicles || '-'}
                </td>
                <td>₱${item.price.toFixed(2)}</td>
                <td><span class="${item.stock <= 5 ? 'stock-low' : ''}">${item.stock}</span></td>
                <td>
                    ${item.stock > 0 ? `
                        <button class="btn-primary btn-sm" onclick="pos.addToCartById(${item.id})" title="Add to cart">
                            <i class="fas fa-cart-plus"></i>
                        </button>
                    ` : `
                        <button class="btn-sm" style="background: #d1d5db; border: none; color: #9ca3af; padding: 5px 10px; border-radius: 6px; font-size: 12px; cursor: not-allowed;" disabled title="Out of stock">
                            <i class="fas fa-cart-plus"></i> Out
                        </button>
                    `}
                </td>
            </tr>
        `).join('');
    }

    getCategoryLabel(category) {
        // Convert category value to display name
        return category
            .replace(/_/g, ' ')
            .replace(/\b\w/g, char => char.toUpperCase());
    }

    editItem(itemId) {
        const item = this.inventory.find(i => i.id === itemId);
        if (!item) return;

        document.getElementById('newPartNumber').value = item.partNumber;
        document.getElementById('newBarcode').value = item.barcode || '';
        document.getElementById('newPartName').value = item.name;
        document.getElementById('newCategory').value = item.category;
        document.getElementById('newBrand').value = item.brand || '';
        document.getElementById('newPrice').value = item.price;
        document.getElementById('newCost').value = item.cost || '';
        document.getElementById('newStock').value = item.stock;
        document.getElementById('newSupplier').value = item.supplier || '';
        document.getElementById('newNotes').value = item.notes || '';

        // Change save button behavior for editing
        const saveBtn = document.getElementById('saveNewItem');
        saveBtn.textContent = 'Update Part';
        saveBtn.onclick = () => {
            item.partNumber = document.getElementById('newPartNumber').value.trim();
            item.barcode = document.getElementById('newBarcode').value.trim();
            item.name = document.getElementById('newPartName').value.trim();
            item.category = document.getElementById('newCategory').value;
            item.brand = document.getElementById('newBrand').value.trim();
            item.price = parseFloat(document.getElementById('newPrice').value);
            item.cost = parseFloat(document.getElementById('newCost').value) || 0;
            item.stock = parseInt(document.getElementById('newStock').value) || 0;
            item.supplier = document.getElementById('newSupplier').value.trim();
            item.notes = document.getElementById('newNotes').value.trim();

            this.saveInventoryItem(item);
            this.saveToFirestore();
            this.renderInventory();
            this.closeAllModals();
            this.clearAddItemForm();
            saveBtn.textContent = 'Save Part';
            saveBtn.onclick = () => this.saveNewItem();
            this.showNotification('Part updated successfully', 'success');
        };

        this.openModal('addItemModal');
    }

    // Cart Management
    addToCartById(itemId) {
        const item = this.inventory.find(i => i.id === itemId);
        if (item) {
            // Check if out of stock
            if (item.stock <= 0) {
                this.showNotification(`"${item.name}" is out of stock!`, 'error');
                return;
            }
            this.addToCart(item);
        }
    }

    addToCart(item, qty = 1) {
        // Check if item is out of stock
        if (!item.isCustom && item.stock <= 0) {
            this.showNotification(`"${item.name}" is out of stock!`, 'error');
            return;
        }
        
        const existingItem = this.cart.find(cartItem => cartItem.id === item.id);
        
        if (existingItem) {
            // Check if adding more would exceed stock
            if (!item.isCustom && (existingItem.quantity + qty) > item.stock) {
                this.showNotification(`Only ${item.stock} units available for "${item.name}"`, 'error');
                return;
            }
            existingItem.quantity += qty;
        } else {
            // Check if requested quantity exceeds stock
            if (!item.isCustom && qty > item.stock) {
                this.showNotification(`Only ${item.stock} units available for "${item.name}"`, 'error');
                qty = item.stock; // Add available stock instead
            }
            this.cart.push({
                ...item,
                quantity: qty
            });
        }

        sessionStorage.setItem('currentCart', JSON.stringify(this.cart));
        this.updateCart();
        this.showNotification(`"${item.name}" added to cart`, 'success');
    }

    addCustomToCart(name, price, qty = 1) {
        const customItem = {
            id: Date.now(),
            partNumber: 'CUSTOM',
            name: name,
            price: price,
            cost: 0,
            category: 'other',
            isCustom: true,
            quantity: qty
        };

        this.cart.push(customItem);
        this.updateCart();
    }

    removeFromCart(itemId) {
        this.cart = this.cart.filter(item => item.id !== itemId);
        sessionStorage.setItem('currentCart', JSON.stringify(this.cart));
        this.updateCart();
    }

    updateCartItemQuantity(itemId, quantity) {
        const item = this.cart.find(item => item.id === itemId);
        if (item) {
            if (quantity <= 0) {
                this.removeFromCart(itemId);
            } else {
                item.quantity = quantity;
            }
        }
        this.updateCart();
    }

    clearCart() {
        if (this.cart.length > 0 && confirm('Are you sure you want to clear the cart?')) {
            this.cart = [];
            sessionStorage.removeItem('currentCart');
            this.updateCart();
            this.showNotification('Cart cleared', 'info');
        }
    }

    calculateSubtotal() {
        return this.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    }

    updateCart() {
        // Update side cart panel
        const cartSideItems = document.getElementById('cartSideItems');
        const cartCount = document.getElementById('cartCount');
        const cartTotal = document.getElementById('cartTotal');
        
        if (this.cart.length === 0) {
            if (cartSideItems) {
                cartSideItems.innerHTML = `
                    <div class="empty-cart">
                        <i class="fas fa-shopping-basket"></i>
                        <p>No items in cart</p>
                        <p class="sub-text">Click cart icon on items to add</p>
                    </div>`;
            }
        } else {
            if (cartSideItems) {
                cartSideItems.innerHTML = this.cart.map(item => `
                    <div class="cart-side-item">
                        <div class="cart-side-item-info">
                            <div class="cart-side-item-name">${item.name}</div>
                            <div class="cart-side-item-part">${item.partNumber} | ₱${item.price.toFixed(2)}</div>
                        </div>
                        <div class="cart-side-item-qty">
                            <span class="qty-badge">${item.quantity}</span>
                            <button class="remove-item-btn" onclick="pos.removeFromCart(${item.id})" title="Remove">
                                <i class="fas fa-times-circle"></i>
                            </button>
                        </div>
                    </div>
                `).join('');
            }
        }
        
        // Update cart count
        const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        if (cartCount) cartCount.textContent = `${totalItems} item${totalItems !== 1 ? 's' : ''}`;
        
        // Update total
        const total = this.calculateSubtotal();
        if (cartTotal) cartTotal.textContent = `₱${total.toFixed(2)}`;
        
        // Save cart to sessionStorage for checkout page
        sessionStorage.setItem('currentCart', JSON.stringify(this.cart));
    }

    // Category Management
    populateCategoryDropdowns() {
        const categorySelects = ['newCategory', 'categoryFilter'];
        
        categorySelects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;
            
            // Save current selection
            const currentValue = select.value;
            
            // Clear existing options (except "All Categories" for filter)
            if (selectId === 'categoryFilter') {
                select.innerHTML = '<option value="all">All Categories</option>';
            } else {
                select.innerHTML = '';
            }
            
            // Add category options
            this.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = this.getCategoryLabel(category);
                select.appendChild(option);
            });
            
            // Restore selection if possible
            if (currentValue && this.categories.includes(currentValue)) {
                select.value = currentValue;
            }
        });
    }

    handleCategoryChange() {
        const select = document.getElementById('newCategory');
        const newCategoryInput = document.getElementById('newCategoryInput');
        
        if (select.value === 'add_new') {
            newCategoryInput.style.display = 'block';
            newCategoryInput.focus();
        } else {
            newCategoryInput.style.display = 'none';
        }
    }

    addNewCategoryFromInput() {
        const categoryInput = document.getElementById('newCategoryInput');
        const categoryName = categoryInput.value.trim().toLowerCase();
        
        if (!categoryName) {
            alert('Please enter a category name');
            return;
        }
        
        // Convert to lowercase, replace spaces with underscores
        const categoryValue = categoryName.replace(/\s+/g, '_');
        
        if (this.categories.includes(categoryValue)) {
            alert('This category already exists');
            return;
        }
        
        this.categories.push(categoryValue);
        this.saveCategories();
        this.populateCategoryDropdowns();
        
        // Select the new category
        document.getElementById('newCategory').value = categoryValue;
        categoryInput.value = '';
        categoryInput.style.display = 'none';
        
        this.showNotification(`Category "${categoryName}" added successfully`, 'success');
    }

    addNewCategory() {
        const categoryInput = document.getElementById('newCategoryName');
        const categoryName = categoryInput.value.trim().toLowerCase();
        
        if (!categoryName) {
            alert('Please enter a category name');
            return;
        }
        
        // Convert to lowercase, replace spaces with underscores
        const categoryValue = categoryName.replace(/\s+/g, '_');
        
        if (this.categories.includes(categoryValue)) {
            alert('This category already exists');
            return;
        }
        
        this.categories.push(categoryValue);
        this.saveCategories();
        this.renderCategoryList();
        this.populateCategoryDropdowns();
        
        categoryInput.value = '';
        this.showNotification(`Category "${categoryName}" added successfully`, 'success');
    }

    deleteCategory(categoryValue) {
        // Check if category is in use
        const itemsUsingCategory = this.inventory.filter(item => item.category === categoryValue);
        
        if (itemsUsingCategory.length > 0) {
            alert(`Cannot delete category. ${itemsUsingCategory.length} item(s) are using this category. Reassign them first.`);
            return;
        }
        
        if (confirm(`Are you sure you want to delete the category "${this.getCategoryLabel(categoryValue)}"?`)) {
            this.categories = this.categories.filter(cat => cat !== categoryValue);
            this.saveCategories();
            this.renderCategoryList();
            this.populateCategoryDropdowns();
            this.showNotification('Category deleted successfully', 'success');
        }
    }

    editCategory(categoryValue) {
        const newName = prompt('Enter new name for this category:', this.getCategoryLabel(categoryValue));
        
        if (newName && newName.trim()) {
            const newValue = newName.trim().toLowerCase().replace(/\s+/g, '_');
            
            if (newValue === categoryValue) return;
            
            if (this.categories.includes(newValue)) {
                alert('A category with this name already exists');
                return;
            }
            
            // Update category name
            const index = this.categories.indexOf(categoryValue);
            this.categories[index] = newValue;
            
            // Update all items using this category
            this.inventory.forEach(item => {
                if (item.category === categoryValue) {
                    item.category = newValue;
                    this.saveInventoryItem(item);
                }
            });
            
            this.saveToFirestore();
            this.renderCategoryList();
            this.populateCategoryDropdowns();
            this.renderInventory();
            
            this.showNotification('Category renamed successfully', 'success');
        }
    }

    resetCategories() {
        if (confirm('Reset categories to default? This won\'t affect your inventory items.')) {
            this.categories = [
                'engine',
                'electrical',
                'body',
                'brake',
                'suspension',
                'transmission',
                'exhaust',
                'other'
            ];
            this.saveCategories();
            this.renderCategoryList();
            this.populateCategoryDropdowns();
            this.showNotification('Categories reset to default', 'success');
        }
    }

    renderCategoryList() {
        const container = document.getElementById('categoryList');
        if (!container) return;
        
        container.innerHTML = this.categories.map(category => {
            const itemCount = this.inventory.filter(item => item.category === category).length;
            return `
                <div class="category-item">
                    <div>
                        <span class="category-item-name">${this.getCategoryLabel(category)}</span>
                        <span class="category-item-count">(${itemCount} items)</span>
                    </div>
                    <div class="category-item-actions">
                        <button class="btn-secondary" onclick="pos.editCategory('${category}')">
                            <i class="fas fa-edit"></i> Rename
                        </button>
                        ${itemCount === 0 ? `
                            <button class="btn-danger" onclick="pos.deleteCategory('${category}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Utility Functions
    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
        
        // Reset edit button if it was changed
        const saveBtn = document.getElementById('saveNewItem');
        if (saveBtn) {
            saveBtn.textContent = 'Save Part';
            saveBtn.onclick = () => this.saveNewItem();
        }
        
        // Clear add item form
        this.clearAddItemForm();
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 15px 25px;
            background: ${type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : '#4b5563'};
            color: white;
            border-radius: 8px;
            z-index: 2000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: 'Segoe UI', sans-serif;
            font-weight: 600;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Employee Management
    async loadEmployees() {
        try {
            const snapshot = await db.collection('users').get();
            const employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.renderEmployeeList(employees);
        } catch (error) {
            console.error('Error loading employees:', error);
        }
    }

    renderEmployeeList(employees) {
        const container = document.getElementById('employeeList');
        if (!container) return;
        
        if (employees.length === 0) {
            container.innerHTML = '<p style="color:#6b7280;text-align:center;padding:10px;">No employees found</p>';
            return;
        }
        
        container.innerHTML = employees.map(emp => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:#f9fafb;border-radius:8px;margin-bottom:5px;border:1px solid #e5e7eb;">
                <div>
                    <strong>${emp.name}</strong>
                    <span class="role-badge ${emp.role === 'admin' ? 'role-admin' : emp.role === 'manager' ? 'role-manager' : 'role-cashier'}" style="margin-left:8px;">${emp.role}</span>
                    <br><small style="color:#6b7280;">${emp.email}</small>
                </div>
                ${emp.role !== 'admin' ? `
                    <button class="btn-danger btn-sm" onclick="pos.deleteEmployee('${emp.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
            </div>
        `).join('');
    }

    async addEmployee() {
        const name = document.getElementById('empName').value.trim();
        const position = document.getElementById('empPosition').value;
        const email = document.getElementById('empEmail').value.trim().toLowerCase();
        const password = document.getElementById('empPassword').value;
        
        if (!name || !email || !password) {
            alert('Please fill in all fields');
            return;
        }
        
    if (password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }

    // Check if trying to create another admin
    if (position === 'admin') {
        const usersSnapshot = await db.collection('users').where('role', '==', 'admin').get();
        if (!usersSnapshot.empty) {
            alert('An Admin account already exists. Only one Admin is allowed.');
            return;
        }
    }
    
    try {
            // Create in Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await userCredential.user.updateProfile({ displayName: name });
            
            // Save to Firestore
            await db.collection('users').doc(userCredential.user.uid).set({
                name: name,
                email: email,
                role: position,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            this.closeAllModals();
            this.showNotification(`Employee "${name}" added as ${position}`, 'success');
        } catch (error) {
            alert('Error: ' + error.message);
        }
    }

    async deleteEmployee(uid) {
        if (confirm('Delete this employee? They will no longer be able to login.')) {
            try {
                await db.collection('users').doc(uid).delete();
                this.showNotification('Employee deleted', 'success');
                this.loadEmployees();
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }
    }

    // Danger Zone
    async deleteAllSales() {
        const confirmed = confirm('⚠️ DELETE ALL SALES?\n\nThis will permanently delete ALL sales transactions. This cannot be undone!\n\nType "DELETE" to confirm:');
        if (confirmed) {
            const input = prompt('Type DELETE to confirm:');
            if (input === 'DELETE') {
                try {
                    const snapshot = await db.collection('sales').get();
                    const batch = db.batch();
                    snapshot.docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                    
                    // Clear local
                    this.salesHistory = [];
                    
                    // Clear debts
                    localStorage.removeItem('motorPartsDebts');
                    
                    this.showNotification('All sales data deleted', 'success');
                } catch (error) {
                    alert('Error: ' + error.message);
                }
            }
        }
    }

    async resetInventory() {
        const confirmed = confirm('⚠️ RESET INVENTORY?\n\nThis will delete ALL inventory items. This cannot be undone!');
        if (confirmed) {
            const input = prompt('Type RESET to confirm:');
            if (input === 'RESET') {
                try {
                    const snapshot = await db.collection('inventory').get();
                    const batch = db.batch();
                    snapshot.docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                    
                    this.inventory = [];
                    this.renderInventory();
                    this.showNotification('Inventory reset', 'success');
                } catch (error) {
                    alert('Error: ' + error.message);
                }
            }
        }
    }

    async wipeAllData() {
        const confirmed = confirm('⚠️⚠️ WIPE ALL DATA? ⚠️⚠️\n\nThis will delete EVERYTHING - sales, inventory, expenses, history. This cannot be undone!\n\nType "WIPE" to confirm:');
        if (confirmed) {
            const input = prompt('Type WIPE to confirm:');
            if (input === 'WIPE') {
                try {
                    // Delete all collections
                    const collections = ['sales', 'inventory', 'expenses', 'users'];
                    for (const col of collections) {
                        const snapshot = await db.collection(col).get();
                        const batch = db.batch();
                        snapshot.docs.forEach(doc => batch.delete(doc.ref));
                        await batch.commit();
                    }
                    
                    // Clear local
                    this.inventory = [];
                    this.salesHistory = [];
                    localStorage.removeItem('motorPartsDebts');
                    localStorage.removeItem('motorPartsExpenses');
                    localStorage.removeItem('motorPartsHistory');
                    
                    this.renderInventory();
                    this.showNotification('All data wiped', 'success');
                } catch (error) {
                    alert('Error: ' + error.message);
                }
            }
        }
    }
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize POS system
const pos = new POSSystem(); 