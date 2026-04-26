// Checkout System for Motor Parts POS

class CheckoutSystem {
    constructor() {
        this.cart = [];
        this.discount = 0;
        this.paymentMethod = 'cash';
        this.salesHistory = [];
        this.inventory = [];
        this.receiptNumber = 1000;
        
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.updateCartDisplay();
        this.loadCartFromSession();
    }

    loadData() {
        const savedSales = localStorage.getItem('motorPartsSales');
        const savedInventory = localStorage.getItem('motorPartsInventory');
        const savedReceiptNum = localStorage.getItem('motorPartsReceiptNum');
        
        if (savedSales) this.salesHistory = JSON.parse(savedSales);
        if (savedInventory) this.inventory = JSON.parse(savedInventory);
        if (savedReceiptNum) this.receiptNumber = parseInt(savedReceiptNum);
    }

    loadCartFromSession() {
        const savedCart = sessionStorage.getItem('currentCart');
        if (savedCart) {
            this.cart = JSON.parse(savedCart);
            this.updateCartDisplay();
        }
    }

    saveCartToSession() {
        sessionStorage.setItem('currentCart', JSON.stringify(this.cart));
    }

    setupEventListeners() {
        // Clear cart
        document.getElementById('clearCartBtn').addEventListener('click', () => this.clearCart());
        
        // Apply discount
        document.getElementById('applyDiscountBtn').addEventListener('click', () => this.applyDiscount());
        
        // Payment method switching
        document.querySelectorAll('.payment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchPaymentMethod(e.currentTarget.dataset.method));
        });

        // Quick cash amounts
        document.querySelectorAll('.cash-amount').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.getElementById('amountReceived').value = e.currentTarget.dataset.amount;
                this.calculateChange();
            });
        });

        // Amount received input
        document.getElementById('amountReceived')?.addEventListener('input', () => this.calculateChange());

        // Process payment
        document.getElementById('processPaymentBtn').addEventListener('click', () => this.processPayment());
        
        // Print receipt
        document.getElementById('printReceiptBtn')?.addEventListener('click', () => this.printReceipt());

        // Close modals
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        // Close modals on outside click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });

        // Keyboard shortcut for payment
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F8' && this.cart.length > 0) {
                e.preventDefault();
                this.processPayment();
            }
        });
    }

    switchPaymentMethod(method) {
        this.paymentMethod = method;
        
        document.querySelectorAll('.payment-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.method === method) {
                btn.classList.add('active');
            }
        });

        document.getElementById('cashPayment').style.display = method === 'cash' ? 'block' : 'none';
        document.getElementById('cardPayment').style.display = method === 'card' ? 'block' : 'none';
        document.getElementById('mobilePayment').style.display = method === 'gcash' ? 'block' : 'none';
        document.getElementById('bankPayment').style.display = method === 'bank_transfer' ? 'block' : 'none';
    }

    updateCartItemQuantity(itemId, quantity) {
        const item = this.cart.find(item => item.id === itemId);
        if (item) {
            if (quantity <= 0) {
                this.removeFromCart(itemId);
            } else {
                item.quantity = parseInt(quantity) || 1;
            }
        }
        this.saveCartToSession();
        this.updateCartDisplay();
    }

    removeFromCart(itemId) {
        this.cart = this.cart.filter(item => item.id !== itemId);
        this.saveCartToSession();
        this.updateCartDisplay();
    }

    clearCart() {
        if (this.cart.length > 0 && confirm('Are you sure you want to clear the cart?')) {
            this.cart = [];
            this.discount = 0;
            document.getElementById('discountPercent').value = '';
            document.getElementById('discountAmount').value = '';
            document.getElementById('amountReceived').value = '';
            this.saveCartToSession();
            this.updateCartDisplay();
        }
    }

    applyDiscount() {
        const percentDiscount = parseFloat(document.getElementById('discountPercent').value) || 0;
        const amountDiscount = parseFloat(document.getElementById('discountAmount').value) || 0;

        if (percentDiscount > 0) {
            this.discount = percentDiscount;
            this.showNotification(`${percentDiscount}% discount applied`, 'success');
        } else if (amountDiscount > 0) {
            const subtotal = this.calculateSubtotal();
            if (subtotal > 0) {
                this.discount = (amountDiscount / subtotal) * 100;
                this.showNotification(`₱${amountDiscount} discount applied`, 'success');
            }
        } else {
            this.discount = 0;
            this.showNotification('Discount removed', 'info');
        }

        this.updateCartDisplay();
    }

    calculateSubtotal() {
        return this.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    }

    calculateSubtotalAfterDiscount() {
        const subtotal = this.calculateSubtotal();
        if (this.discount > 0) {
            return subtotal - (subtotal * (this.discount / 100));
        }
        return subtotal;
    }

    calculateDiscountAmount() {
        return this.calculateSubtotal() - this.calculateSubtotalAfterDiscount();
    }

    calculateTotal() {
        return this.calculateSubtotalAfterDiscount(); // No VAT
    }

    calculateChange() {
        const total = this.calculateTotal();
        const amountReceived = parseFloat(document.getElementById('amountReceived').value) || 0;
        const change = amountReceived - total;
        
        const changeDisplay = document.getElementById('changeDisplay');
        const changeAmount = document.getElementById('changeAmount');
        
        if (amountReceived > 0) {
            changeDisplay.style.display = 'block';
            if (change >= 0) {
                changeAmount.textContent = `₱${change.toFixed(2)}`;
                changeDisplay.style.borderColor = '#34d399';
                changeDisplay.style.background = '#ecfdf5';
            } else {
                changeAmount.textContent = `-₱${Math.abs(change).toFixed(2)}`;
                changeDisplay.style.borderColor = '#fca5a5';
                changeDisplay.style.background = '#fef2f2';
            }
        } else {
            changeDisplay.style.display = 'none';
        }
    }

    updateCartDisplay() {
        const cartItems = document.getElementById('cartItems');
        const cartCount = document.getElementById('cartCount');

        if (this.cart.length === 0) {
            cartItems.innerHTML = `
                <div class="empty-cart">
                    <i class="fas fa-shopping-basket"></i>
                    <p>Cart is empty</p>
                    <p class="sub-text">Add items from inventory first</p>
                </div>`;
        } else {
            cartItems.innerHTML = this.cart.map(item => `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.name}</div>
                        <div class="cart-item-part">${item.partNumber} ${item.isCustom ? '(Custom)' : ''}</div>
                        <div class="cart-item-price">₱${item.price.toFixed(2)} each</div>
                    <div class="cart-item-quantity">
                        <button class="qty-btn" onclick="checkoutSystem.updateCartItemQuantity(${item.id}, ${item.quantity - 1})">-</button>
                        <input type="number" class="qty-input" value="${item.quantity}" 
                               onchange="checkoutSystem.updateCartItemQuantity(${item.id}, this.value)" 
                               min="1">
                        <button class="qty-btn" onclick="checkoutSystem.updateCartItemQuantity(${item.id}, ${item.quantity + 1})">+</button>
                    </div>
                    <div class="cart-item-total">₱${(item.price * item.quantity).toFixed(2)}</div>
                    <button class="cart-item-remove" onclick="checkoutSystem.removeFromCart(${item.id})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');
        }

        // Update cart count
        const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = `${totalItems} item${totalItems !== 1 ? 's' : ''}`;

        // Update summary
        const subtotal = this.calculateSubtotal();
        const discountAmount = this.calculateDiscountAmount();
        const total = this.calculateTotal();

        document.getElementById('subtotal').textContent = `₱${subtotal.toFixed(2)}`;
        document.getElementById('tax').textContent = `₱0.00`;
        document.getElementById('discount').textContent = `-₱${discountAmount.toFixed(2)}`;
        document.getElementById('total').textContent = `₱${total.toFixed(2)}`;
        
        // Reset change display
        document.getElementById('changeAmount').textContent = '₱0.00';
        document.getElementById('changeDisplay').style.display = 'none';
    }

    async processPayment() {
        if (this.cart.length === 0) {
            alert('Cart is empty');
            return;
        }

        const total = this.calculateTotal();
        let paymentInfo = {};
        let remainingBalance = 0;

        // Validate payment
        if (this.paymentMethod === 'cash') {
            const amountReceived = parseFloat(document.getElementById('amountReceived').value) || 0;
            
            if (amountReceived < total) {
                remainingBalance = total - amountReceived;
                const confirmPartial = confirm(
                    `Insufficient payment!\n\nTotal: ₱${total.toFixed(2)}\nReceived: ₱${amountReceived.toFixed(2)}\nRemaining Balance: ₱${remainingBalance.toFixed(2)}\n\nDo you want to proceed with partial payment? The remaining balance will be recorded as debt.`
                );
                if (!confirmPartial) return;
            }
            
            paymentInfo = {
                amountReceived: amountReceived,
                change: amountReceived > total ? amountReceived - total : 0,
                remainingBalance: remainingBalance
            };
        } else if (this.paymentMethod === 'card') {
            const cardNumber = document.getElementById('cardNumber').value.trim();
            if (!cardNumber) {
                alert('Please enter card number');
                return;
            }
            paymentInfo = {
                cardLastFour: cardNumber.slice(-4),
                cardExpiry: document.getElementById('cardExpiry').value,
                cardType: 'Credit/Debit Card'
            };
        } else if (this.paymentMethod === 'gcash') {
            const refNumber = document.getElementById('referenceNumber').value.trim();
            if (!refNumber) {
                alert('Please enter GCash reference number');
                return;
            }
            paymentInfo = {
                referenceNumber: refNumber,
                paymentType: 'GCash'
            };
        } else if (this.paymentMethod === 'bank_transfer') {
            const bankName = document.getElementById('bankName').value;
            const bankRef = document.getElementById('bankReference').value.trim();
            if (!bankName || !bankRef) {
                alert('Please complete bank transfer details');
                return;
            }
            paymentInfo = {
                bankName: bankName,
                referenceNumber: bankRef,
                paymentType: 'Bank Transfer'
            };
        }

        // Create transaction record
        const transaction = {
            receiptNumber: this.receiptNumber,
            date: new Date().toISOString(),
            cashier: localStorage.getItem('cashierName') || 'Unknown',
            customer: document.getElementById('customerName').value || 'Walk-in Customer',
            vehicle: document.getElementById('vehicleInfo').value || '',
            items: [...this.cart],
            subtotal: this.calculateSubtotal(),
            discountPercent: this.discount,
            discountAmount: this.calculateDiscountAmount(),
            tax: 0,
            total: total,
            paymentMethod: this.paymentMethod,
            paymentInfo: paymentInfo,
            remainingBalance: remainingBalance,
            isPartialPayment: remainingBalance > 0
        };

        // If there's remaining balance, store as debt
        if (remainingBalance > 0) {
            this.saveDebt(transaction);
        }

        // Update inventory stock
        this.cart.forEach(cartItem => {
            if (!cartItem.isCustom) {
                const inventoryItem = this.inventory.find(item => item.id === cartItem.id);
                if (inventoryItem) {
                    inventoryItem.stock = Math.max(0, inventoryItem.stock - cartItem.quantity);
                }
            }
        });

        // Save transaction to Firestore
        try {
            await db.collection('sales').doc(transaction.receiptNumber.toString()).set(transaction);
            this.cart.forEach(async (cartItem) => {
                if (!cartItem.isCustom) {
                    await db.collection('inventory').doc(cartItem.id.toString()).update({
                        stock: firebase.firestore.FieldValue.increment(-cartItem.quantity)
                    });
                }
            });
            await db.collection('settings').doc('general').set({
                receiptNumber: this.receiptNumber
            }, { merge: true });
        } catch (error) {
            console.error('Error saving transaction:', error);
        }
        
        this.salesHistory.unshift(transaction);
        this.receiptNumber++;
        
        // Clear session cart
        sessionStorage.removeItem('currentCart');
        
        // Show receipt
        this.showReceipt(transaction);
    }

    saveDebt(transaction) {
        const debts = JSON.parse(localStorage.getItem('motorPartsDebts') || '[]');
        debts.push({
            id: Date.now(),
            receiptNumber: transaction.receiptNumber,
            customer: transaction.customer,
            vehicle: transaction.vehicle,
            total: transaction.total,
            paid: transaction.paymentInfo.amountReceived,
            balance: transaction.remainingBalance,
            date: transaction.date,
            items: transaction.items,
            status: 'pending'
        });
        localStorage.setItem('motorPartsDebts', JSON.stringify(debts));
    }

    showReceipt(transaction) {
        const receiptContent = document.getElementById('receiptContent');
        
        const paymentMethodLabels = {
            'cash': 'CASH',
            'card': 'CREDIT/DEBIT CARD',
            'gcash': 'GCASH',
            'bank_transfer': 'BANK TRANSFER'
        };

        receiptContent.innerHTML = `
            <div class="receipt">
                <div class="receipt-header">
                    <h3>MOTOR PARTS POS</h3>
                    <p>Store #001</p>
                    <p>Tel: (555) 123-4567</p>
                    <p>Receipt #${transaction.receiptNumber}</p>
                    <p>${new Date(transaction.date).toLocaleString()}</p>
                    <p>Cashier: ${transaction.cashier || localStorage.getItem('cashierName') || 'Unknown'}</p>
                    ${transaction.customer !== 'Walk-in Customer' ? `<p>Customer: ${transaction.customer}</p>` : ''}
                    ${transaction.vehicle ? `<p>Vehicle: ${transaction.vehicle}</p>` : ''}
                </div>
                
                ${transaction.items.map(item => `
                    <div class="receipt-item">
                        <span>${item.name} x${item.quantity}</span>
                        <span>₱${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                `).join('')}
                
                <div class="receipt-total">
                    <div class="receipt-item">
                        <span>Subtotal</span>
                        <span>₱${transaction.subtotal.toFixed(2)}</span>
                    </div>
                    ${transaction.discountAmount > 0 ? `
                        <div class="receipt-item">
                            <span>Discount (${transaction.discountPercent.toFixed(1)}%)</span>
                            <span>-₱${transaction.discountAmount.toFixed(2)}</span>
                        </div>
                    ` : ''}
                    <div class="receipt-item">
                        <span>VAT (0%)</span>
                        <span>₱0.00</span>
                    </div>
                    <div class="receipt-item" style="font-weight: 700; font-size: 16px; margin-top: 10px;">
                        <span>TOTAL</span>
                        <span>₱${transaction.total.toFixed(2)}</span>
                    </div>
                    <div class="receipt-item">
                        <span>Payment Method</span>
                        <span>${paymentMethodLabels[transaction.paymentMethod]}</span>
                    </div>
                    ${transaction.isPartialPayment ? `
                        <div class="receipt-item" style="color: #dc2626;">
                            <span>Partial Payment!</span>
                            <span></span>
                        </div>
                        <div class="receipt-item">
                            <span>Amount Paid</span>
                            <span>₱${transaction.paymentInfo.amountReceived.toFixed(2)}</span>
                        </div>
                        <div class="receipt-item" style="font-weight: 700; color: #dc2626;">
                            <span>Remaining Balance</span>
                            <span>₱${transaction.remainingBalance.toFixed(2)}</span>
                        </div>
                    ` : ''}
                    ${!transaction.isPartialPayment && transaction.paymentInfo.amountReceived ? `
                        <div class="receipt-item">
                            <span>Amount Received</span>
                            <span>₱${transaction.paymentInfo.amountReceived.toFixed(2)}</span>
                        </div>
                        <div class="receipt-item">
                            <span>Change</span>
                            <span>₱${transaction.paymentInfo.change.toFixed(2)}</span>
                        </div>
                    ` : ''}
                </div>
                
                <div style="text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px dashed #d1d5db;">
                    <p>Thank you for your purchase!</p>
                    <p>Please come again</p>
                </div>
        `;

        // Clear cart
        this.cart = [];
        this.discount = 0;
        document.getElementById('discountPercent').value = '';
        document.getElementById('discountAmount').value = '';
        document.getElementById('amountReceived').value = '';
        document.getElementById('customerName').value = '';
        document.getElementById('vehicleInfo').value = '';
        this.updateCartDisplay();

        // Show receipt modal
        document.getElementById('receiptModal').classList.add('active');
    }

    printReceipt() {
        const receiptContent = document.getElementById('receiptContent').innerHTML;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Receipt</title>
                    <style>
                        body { font-family: 'Courier New', monospace; }
                        .receipt { max-width: 300px; margin: 0 auto; }
                    </style>
                </head>
                <body>
                    ${receiptContent}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: ${type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : '#4b5563'};
            color: white;
            border-radius: 8px;
            z-index: 2000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: 'Segoe UI', sans-serif;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
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

// Initialize checkout system
const checkoutSystem = new CheckoutSystem();
