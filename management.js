 // Inventory Management System

class ManagementSystem {
    constructor() {
        this.inventory = [];
        this.categories = [];
        this.editingItemId = null;
        this.lowStockThreshold = 5;
        this.history = [];
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.populateCategoryDropdowns();
        this.renderInventory();
        this.updateStats();
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

            const settingsDoc = await db.collection('settings').doc('general').get();
            if (settingsDoc.exists) {
                const settings = settingsDoc.data();
                if (settings.categories) this.categories = settings.categories;
            } else {
                this.categories = ['engine', 'electrical', 'body', 'brake', 'suspension', 'transmission', 'exhaust', 'other'];
            }

            const savedThreshold = localStorage.getItem('lowStockThreshold');
            if (savedThreshold) this.lowStockThreshold = parseInt(savedThreshold);

            const savedHistory = localStorage.getItem('motorPartsHistory');
            if (savedHistory) this.history = JSON.parse(savedHistory);
        } catch (error) {
            console.error('Error loading from Firestore:', error);
        }
    }

    async saveData() {
        try {
            await db.collection('settings').doc('general').set({
                categories: this.categories,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (error) {
            console.error('Error saving to Firestore:', error);
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

    async deleteInventoryItem(itemId) {
        try {
            await db.collection('inventory').doc(itemId.toString()).delete();
        } catch (error) {
            console.error('Error deleting item:', error);
        }
    }

    setupEventListeners() {
        document.getElementById('openAddItemModal').addEventListener('click', () => {
            this.clearAddItemForm();
            this.openModal('addItemModal');
        });
        document.getElementById('saveNewItem').addEventListener('click', () => this.saveNewItem());
        document.getElementById('openBulkAddModal').addEventListener('click', () => this.openModal('bulkAddModal'));
        document.getElementById('processBulkAdd').addEventListener('click', () => this.processBulkAdd());
        document.getElementById('manageCategoriesBtn').addEventListener('click', () => {
            this.renderCategoryList();
            this.openModal('categoryModal');
        });
        document.getElementById('addNewCategory').addEventListener('click', () => this.addNewCategory());
        document.getElementById('resetCategories').addEventListener('click', () => this.resetCategories());
        document.getElementById('updateItem').addEventListener('click', () => this.updateItem());
        document.getElementById('searchParts').addEventListener('input', () => this.filterInventory());
        document.getElementById('categoryFilter').addEventListener('change', () => this.filterInventory());
        document.getElementById('stockFilter').addEventListener('change', () => this.filterInventory());
        document.getElementById('exportInventoryBtn').addEventListener('click', () => this.exportInventory());
        document.getElementById('lowStockThreshold').value = this.lowStockThreshold;
        document.getElementById('saveThreshold').addEventListener('click', () => this.saveThreshold());
        document.getElementById('openHistoryBtn').addEventListener('click', () => this.openHistory());
        document.getElementById('historySearch').addEventListener('input', () => this.renderHistory());
        document.getElementById('historyActionFilter').addEventListener('change', () => this.renderHistory());
        document.getElementById('clearHistoryBtn').addEventListener('click', () => this.clearHistory());
        
        document.querySelectorAll('.close-modal, .close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });
        
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });
    }

    populateCategoryDropdowns() {
        const selects = ['newCategory', 'categoryFilter'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;
            if (selectId === 'categoryFilter') {
                select.innerHTML = '<option value="all">All Categories</option>';
            } else {
                select.innerHTML = '';
            }
            this.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = this.getCategoryLabel(category);
                select.appendChild(option);
            });
        });
    }

    getCategoryLabel(category) {
        return category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    saveNewItem() {
        const partNumber = document.getElementById('newPartNumber').value.trim();
        const name = document.getElementById('newPartName').value.trim();
        const price = parseFloat(document.getElementById('newPrice').value);

        if (!partNumber || !name || !price) {
            alert('Please fill in Part Number, Part Name, and Price');
            return;
        }

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
            vehicles: document.getElementById('newVehicles').value.trim(),
            price: price,
            cost: parseFloat(document.getElementById('newCost').value) || 0,
            stock: parseInt(document.getElementById('newStock').value) || 0,
            supplier: document.getElementById('newSupplier').value.trim(),
            notes: document.getElementById('newNotes').value.trim(),
            dateAdded: new Date().toISOString()
        };

        this.inventory.push(newItem);
        this.addHistoryEntry('added', newItem);
        this.saveInventoryItem(newItem);
        this.saveData();
        this.renderInventory();
        this.updateStats();
        this.closeAllModals();
        this.clearAddItemForm();
        this.showNotification(`Part "${name}" added successfully`, 'success');
    }

    clearAddItemForm() {
        ['newPartNumber', 'newBarcode', 'newPartName', 'newBrand', 'newVehicles', 'newPrice', 
         'newCost', 'newStock', 'newSupplier', 'newNotes'].forEach(id => {
            document.getElementById(id).value = '';
        });
        document.getElementById('newCategory').value = this.categories[0] || 'other';
    }

    processBulkAdd() {
        const data = document.getElementById('bulkPartsData').value.trim();
        if (!data) { alert('Please enter parts data'); return; }

        const skipDuplicates = document.getElementById('skipDuplicates').checked;
        const lines = data.split('\n').filter(line => line.trim());
        let added = 0, skipped = 0, errors = 0;

        lines.forEach((line, index) => {
            try {
                const parts = line.split(',').map(part => part.trim());
                if (parts.length < 4) { errors++; return; }
                const [partNumber, name, category, price, cost = 0, stock = 0, brand = '', supplier = ''] = parts;
                if (skipDuplicates && this.inventory.some(item => item.partNumber === partNumber)) { skipped++; return; }
                const newItem = {
                    id: Date.now() + index, partNumber, barcode: '', name,
                    category: category || 'other', brand,
                    price: parseFloat(price) || 0, cost: parseFloat(cost) || 0,
                    stock: parseInt(stock) || 0, supplier, vehicles: '', notes: '',
                    dateAdded: new Date().toISOString()
                };
                this.inventory.push(newItem);
                this.saveInventoryItem(newItem);
                added++;
            } catch (error) { errors++; }
        });

        this.saveData();
        this.addHistoryEntry('bulk_added', { count: added, name: `Bulk import: ${added} parts`, partNumber: 'BULK' });
        this.renderInventory();
        this.updateStats();
        this.closeAllModals();
        document.getElementById('bulkPartsData').value = '';
        this.showNotification(`Imported ${added} parts. ${skipped} skipped. ${errors} errors.`, 'success');
    }

    editItem(itemId) {
        const item = this.inventory.find(i => i.id === itemId);
        if (!item) return;

        this.editingItemId = itemId;

        const editBody = document.getElementById('editItemBody');
        editBody.innerHTML = `
            <div class="form-row">
                <div class="form-group">
                    <label>Part Number/SKU *</label>
                    <input type="text" id="editPartNumber" value="${item.partNumber}">
                </div>
                <div class="form-group">
                    <label>Barcode</label>
                    <input type="text" id="editBarcode" value="${item.barcode || ''}">
                </div>
            </div>
            <div class="form-group">
                <label>Part Name *</label>
                <input type="text" id="editPartName" value="${item.name}">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Category</label>
                    <select id="editCategory">${this.categories.map(cat => `<option value="${cat}" ${item.category === cat ? 'selected' : ''}>${this.getCategoryLabel(cat)}</option>`).join('')}</select>
                </div>
                <div class="form-group">
                    <label>Brand</label>
                    <input type="text" id="editBrand" value="${item.brand || ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Price (₱) *</label>
                    <input type="number" id="editPrice" value="${item.price}" step="0.01">
                </div>
                <div class="form-group">
                    <label>Cost (₱)</label>
                    <input type="number" id="editCost" value="${item.cost || 0}" step="0.01">
                </div>
                <div class="form-group">
                    <label>Stock</label>
                    <input type="number" id="editStock" value="${item.stock}" min="0">
                </div>
            </div>
            <div class="form-group">
                <label>Supplier</label>
                <input type="text" id="editSupplier" value="${item.supplier || ''}">
            </div>
            <div class="form-group">
                <label>Compatible Vehicles</label>
                <input type="text" id="editVehicles" value="${item.vehicles || ''}" placeholder="e.g., Honda Civic 2016-2020">
            </div>
            <div class="form-group">
                <label>Notes</label>
                <textarea id="editNotes" rows="2">${item.notes || ''}</textarea>
            </div>
        `;

        this.openModal('editItemModal');
    }

    updateItem() {
        if (!this.editingItemId) return;
        
        const item = this.inventory.find(i => i.id === this.editingItemId);
        if (!item) return;

        item.partNumber = document.getElementById('editPartNumber').value.trim();
        item.barcode = document.getElementById('editBarcode').value.trim();
        item.name = document.getElementById('editPartName').value.trim();
        item.category = document.getElementById('editCategory').value;
        item.brand = document.getElementById('editBrand').value.trim();
        item.price = parseFloat(document.getElementById('editPrice').value);
        item.cost = parseFloat(document.getElementById('editCost').value) || 0;
        item.stock = parseInt(document.getElementById('editStock').value) || 0;
        item.supplier = document.getElementById('editSupplier').value.trim();
        item.vehicles = document.getElementById('editVehicles').value.trim();
        item.notes = document.getElementById('editNotes').value.trim();

        this.saveInventoryItem(item);
        this.saveData();
        this.addHistoryEntry('edited', item);
        this.renderInventory();
        this.updateStats();
        this.closeAllModals();
        this.editingItemId = null;
        this.showNotification('Part updated successfully', 'success');
    }

    deleteItem(itemId) {
        const item = this.inventory.find(i => i.id === itemId);
        if (confirm('Are you sure you want to delete this part?')) {
            this.addHistoryEntry('deleted', item);
            this.inventory = this.inventory.filter(i => i.id !== itemId);
            this.deleteInventoryItem(itemId);
            this.renderInventory();
            this.updateStats();
            this.showNotification('Part deleted', 'success');
        }
    }

    filterInventory() {
        const searchTerm = document.getElementById('searchParts').value.toLowerCase();
        const category = document.getElementById('categoryFilter').value;
        const stockFilter = document.getElementById('stockFilter').value;

        let filtered = this.inventory;

        if (searchTerm) {
            filtered = filtered.filter(item =>
                item.name.toLowerCase().includes(searchTerm) ||
                item.partNumber.toLowerCase().includes(searchTerm) ||
                (item.brand && item.brand.toLowerCase().includes(searchTerm)) ||
                (item.supplier && item.supplier.toLowerCase().includes(searchTerm)) ||
                (item.vehicles && item.vehicles.toLowerCase().includes(searchTerm)) ||
                (item.category && this.getCategoryLabel(item.category).toLowerCase().includes(searchTerm))
            );
        }

        if (category !== 'all') {
            filtered = filtered.filter(item => item.category === category);
        }

        if (stockFilter === 'out') {
            filtered = filtered.filter(item => item.stock === 0);
        } else if (stockFilter === 'low') {
            filtered = filtered.filter(item => item.stock > 0 && item.stock <= this.lowStockThreshold);
        } else if (stockFilter === 'in') {
            filtered = filtered.filter(item => item.stock > this.lowStockThreshold);
        }

        this.renderInventory(filtered);
    }

    renderInventory(items = null) {
        const itemsToRender = items || this.inventory;
        const tbody = document.getElementById('inventoryTableBody');

        if (itemsToRender.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-state">
                    <td colspan="10">
                        <i class="fas fa-box-open"></i>
                        <p>${items ? 'No parts match your search' : 'No parts in inventory'}</p>
                        <p class="sub-text">${items ? 'Try different search terms' : 'Click "Add New Part" to get started'}</p>
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = itemsToRender.map(item => {
            let stockBadge = 'in';
            let stockText = 'In Stock';
            if (item.stock === 0) {
                stockBadge = 'out';
                stockText = 'Out of Stock';
            } else if (item.stock <= this.lowStockThreshold) {
                stockBadge = 'low';
                stockText = `Low Stock (≤${this.lowStockThreshold})`;
            }

            return `
                <tr>
                    <td><strong>${item.partNumber}</strong></td>
                    <td>${item.name}</td>
                    <td>${this.getCategoryLabel(item.category)}</td>
                    <td>${item.brand || '-'}</td>
                    <td title="${item.vehicles || ''}">${item.vehicles || '-'}</td>
                    <td>₱${(item.price || 0).toFixed(2)}</td>
                    <td>₱${(item.cost || 0).toFixed(2)}</td>
                    <td>
                        <span class="stock-badge ${stockBadge}">${item.stock} - ${stockText}</span>
                    </td>
                    <td>${item.supplier || '-'}</td>
                    <td>
                        <button class="btn-primary btn-sm" onclick="managementSystem.editItem(${item.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-danger btn-sm" onclick="managementSystem.deleteItem(${item.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    updateStats() {
        document.getElementById('totalParts').textContent = this.inventory.length;
        document.getElementById('outOfStockCount').textContent = this.inventory.filter(i => i.stock === 0).length;
        document.getElementById('lowStockCount').textContent = this.inventory.filter(i => i.stock > 0 && i.stock <= this.lowStockThreshold).length;
        
        const itemsWithCost = this.inventory.filter(item => item.cost && item.cost > 0);
        const itemsWithoutCost = this.inventory.filter(item => !item.cost || item.cost === 0);
        
        const totalStockValue = this.inventory.reduce((sum, item) => sum + ((item.price || 0) * (item.stock || 0)), 0);
        document.getElementById('totalStockValue').textContent = `₱${totalStockValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        
        const withCostStockValue = itemsWithCost.reduce((sum, item) => sum + ((item.price || 0) * (item.stock || 0)), 0);
        const withCostCostValue = itemsWithCost.reduce((sum, item) => sum + ((item.cost || 0) * (item.stock || 0)), 0);
        const withoutCostStockValue = itemsWithoutCost.reduce((sum, item) => sum + ((item.price || 0) * (item.stock || 0)), 0);
        
        const totalCostValue = this.inventory.reduce((sum, item) => sum + ((item.cost || 0) * (item.stock || 0)), 0);
        document.getElementById('totalCostValue').textContent = `₱${totalCostValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        document.getElementById('totalValue').textContent = `₱${totalStockValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        
        const withCostEl = document.getElementById('mgmtWithCostValue');
        const withCostCostEl = document.getElementById('mgmtWithCostCost');
        const withCostCount = document.getElementById('mgmtWithCostCount');
        const withoutCostEl = document.getElementById('mgmtWithoutCostValue');
        const withoutCostCount = document.getElementById('mgmtWithoutCostCount');
        const withCostProfitEl = document.getElementById('mgmtWithCostProfit');
        
        if (withCostEl) withCostEl.textContent = `₱${withCostStockValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        if (withCostCostEl) withCostCostEl.textContent = `₱${withCostCostValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        if (withCostProfitEl) withCostProfitEl.textContent = `₱${(withCostStockValue - withCostCostValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        if (withCostCount) withCostCount.textContent = itemsWithCost.length;
        if (withoutCostEl) withoutCostEl.textContent = `₱${withoutCostStockValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        if (withoutCostCount) withoutCostCount.textContent = itemsWithoutCost.length;
    }

    saveThreshold() {
        const newThreshold = parseInt(document.getElementById('lowStockThreshold').value);
        if (newThreshold && newThreshold > 0) {
            this.lowStockThreshold = newThreshold;
            localStorage.setItem('lowStockThreshold', newThreshold);
            this.renderInventory();
            this.updateStats();
            this.showNotification(`Low stock threshold updated to ${newThreshold}`, 'success');
        } else {
            alert('Please enter a valid number greater than 0');
        }
    }

    addNewCategory() {
        const input = document.getElementById('newCategoryName');
        const categoryName = input.value.trim().toLowerCase().replace(/\s+/g, '_');
        
        if (!categoryName) { alert('Please enter a category name'); return; }
        if (this.categories.includes(categoryName)) { alert('This category already exists'); return; }
        
        this.categories.push(categoryName);
        this.saveData();
        this.renderCategoryList();
        this.populateCategoryDropdowns();
        input.value = '';
        this.showNotification('Category added', 'success');
    }

    deleteCategory(categoryValue) {
        const itemsUsingCategory = this.inventory.filter(item => item.category === categoryValue);
        if (itemsUsingCategory.length > 0) {
            alert(`Cannot delete. ${itemsUsingCategory.length} item(s) are using this category.`);
            return;
        }
        if (confirm('Delete this category?')) {
            this.categories = this.categories.filter(cat => cat !== categoryValue);
            this.saveData();
            this.renderCategoryList();
            this.populateCategoryDropdowns();
            this.showNotification('Category deleted', 'success');
        }
    }

    editCategory(categoryValue) {
        const newName = prompt('Enter new name:', this.getCategoryLabel(categoryValue));
        if (newName && newName.trim()) {
            const newValue = newName.trim().toLowerCase().replace(/\s+/g, '_');
            if (this.categories.includes(newValue) && newValue !== categoryValue) {
                alert('Category already exists'); return;
            }
            const index = this.categories.indexOf(categoryValue);
            if (index !== -1) this.categories[index] = newValue;
            this.inventory.forEach(item => {
                if (item.category === categoryValue) item.category = newValue;
            });
            this.saveData();
            this.renderCategoryList();
            this.populateCategoryDropdowns();
            this.renderInventory();
            this.showNotification('Category renamed', 'success');
        }
    }

    resetCategories() {
        if (confirm('Reset categories to default?')) {
            this.categories = ['engine', 'electrical', 'body', 'brake', 'suspension', 'transmission', 'exhaust', 'other'];
            this.saveData();
            this.renderCategoryList();
            this.populateCategoryDropdowns();
            this.showNotification('Categories reset', 'success');
        }
    }

    renderCategoryList() {
        const container = document.getElementById('categoryList');
        if (!container) return;
        container.innerHTML = this.categories.map(category => {
            const count = this.inventory.filter(item => item.category === category).length;
            return `
                <div class="category-item">
                    <div>
                        <span class="category-item-name">${this.getCategoryLabel(category)}</span>
                        <span class="category-item-count">(${count} items)</span>
                    </div>
                    <div>
                        <button class="btn-primary btn-sm" onclick="managementSystem.editCategory('${category}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${count === 0 ? `
                            <button class="btn-danger btn-sm" onclick="managementSystem.deleteCategory('${category}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    exportInventory() {
        let csv = 'Part Number,Name,Category,Brand,Vehicles,Price,Cost,Stock,Supplier\n';
        this.inventory.forEach(item => {
            csv += `"${item.partNumber}","${item.name}","${item.category}","${item.brand || ''}","${item.vehicles || ''}",${item.price || 0},${item.cost || 0},${item.stock || 0},"${item.supplier || ''}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'inventory.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    }

    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('active'));
        this.editingItemId = null;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; padding: 15px 25px;
            background: ${type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : '#4b5563'};
            color: white; border-radius: 8px; z-index: 2000;
            animation: slideIn 0.3s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
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
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit' 
        };
        const dateTimeEl = document.getElementById('dateTime');
        if (dateTimeEl) dateTimeEl.textContent = now.toLocaleDateString('en-US', options);
    }

    saveHistory() {
        localStorage.setItem('motorPartsHistory', JSON.stringify(this.history));
    }

    addHistoryEntry(action, item) {
        const entry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            action: action,
            partNumber: item.partNumber || '-',
            name: item.name || '-',
            category: item.category || '-',
            price: item.price || 0,
            stock: item.stock || 0,
            details: this.getActionDetails(action, item)
        };
        this.history.unshift(entry);
        if (this.history.length > 500) this.history = this.history.slice(0, 500);
        this.saveHistory();
    }

    getActionDetails(action, item) {
        switch(action) {
            case 'added': return `Added: ${item.name} (${item.partNumber})`;
            case 'edited': return `Updated: ${item.name} (${item.partNumber})`;
            case 'deleted': return `Deleted: ${item.name} (${item.partNumber})`;
            case 'bulk_added': return `Bulk imported ${item.count || 0} parts`;
            default: return `${action}`;
        }
    }

    openHistory() {
        this.renderHistory();
        this.openModal('historyModal');
    }

    renderHistory() {
        const searchTerm = document.getElementById('historySearch').value.toLowerCase();
        const actionFilter = document.getElementById('historyActionFilter').value;
        const tbody = document.getElementById('historyTableBody');

        let filtered = this.history;
        if (searchTerm) {
            filtered = filtered.filter(entry =>
                (entry.name && entry.name.toLowerCase().includes(searchTerm)) ||
                (entry.partNumber && entry.partNumber.toLowerCase().includes(searchTerm))
            );
        }
        if (actionFilter !== 'all') {
            filtered = filtered.filter(entry => entry.action === actionFilter);
        }

        document.getElementById('histTotalAdded').textContent = this.history.filter(h => h.action === 'added' || h.action === 'bulk_added').length;
        document.getElementById('histTotalEdited').textContent = this.history.filter(h => h.action === 'edited').length;
        document.getElementById('histTotalDeleted').textContent = this.history.filter(h => h.action === 'deleted').length;
        
        const lastActivity = this.history.length > 0 
            ? new Date(this.history[0].timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '-';
        document.getElementById('histLastActivity').textContent = lastActivity;

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr class="empty-state"><td colspan="8"><i class="fas fa-history"></i><p>${this.history.length === 0 ? 'No history recorded' : 'No matching entries'}</p></td></tr>`;
            return;
        }

        const actionColors = { 'added': '#059669', 'edited': '#2563eb', 'deleted': '#dc2626', 'bulk_added': '#d97706' };
        const actionLabels = { 'added': 'Added', 'edited': 'Edited', 'deleted': 'Deleted', 'bulk_added': 'Bulk Added' };

        tbody.innerHTML = filtered.map(entry => {
            const date = new Date(entry.timestamp);
            const color = actionColors[entry.action] || '#6b7280';
            const label = actionLabels[entry.action] || entry.action;
            return `
                <tr>
                    <td><div style="font-weight:600;">${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div><div style="font-size:11px;color:#6b7280;">${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div></td>
                    <td><span style="background:${color}20;color:${color};padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;">${label}</span></td>
                    <td><strong>${entry.partNumber}</strong></td>
                    <td>${entry.name}</td>
                    <td>${this.getCategoryLabel(entry.category)}</td>
                    <td>₱${(entry.price || 0).toFixed(2)}</td>
                    <td>${entry.stock !== undefined ? entry.stock : '-'}</td>
                    <td style="font-size:12px;color:#6b7280;">${entry.details}</td>
                </tr>
            `;
        }).join('');
    }

    clearHistory() {
        if (confirm('Are you sure you want to clear all history? This cannot be undone.')) {
            this.history = [];
            this.saveHistory();
            this.renderHistory();
            this.showNotification('History cleared', 'success');
        }
    }
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(400px); opacity: 0; } }
`;
document.head.appendChild(style);

const managementSystem = new ManagementSystem();