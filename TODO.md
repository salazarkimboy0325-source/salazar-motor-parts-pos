# TODO: Update Headers and Cashier Position Display

## Plan

### Information Gathered:
- **index.html**: Has `Motor Parts POS` header and `Cashier: <span id="cashierName">-</span>`. Search placeholder is "Search items by name, SKU, or part number..."
- **management.html**: Has `Motor Parts POS` header and hardcoded `Cashier: John Doe`
- **reports.html**: Has `Motor Parts POS` header and hardcoded `Cashier: John Doe`
- **checkout.html**: Has NO POS header - only a `checkout-header` div
- **script.js**: Already has cashier name display in `init()`, needs role/position added. Also had duplicate `const currentUser` — **FIXED**
- **management.js**: Already has cashier name display in `init()`, needs role/position added
- **reports.js**: Has NO cashier name display in `init()`, needs to be added

### Files Edited:
- [x] 1. `index.html` - Updated header-left + search placeholder
- [x] 2. `management.html` - Replaced header block
- [x] 3. `reports.html` - Replaced header block
- [x] 4. `checkout.html` - Added POS header
- [x] 5. `script.js` - Updated init() cashier display (fixed duplicate const)
- [x] 6. `management.js` - Updated init() cashier display
- [x] 7. `reports.js` - Added cashier display in init()

### Result:
Now the header will show:
- **Business name**: Salazar Motor Parts
- **Store info**: Store #001 | Position: Name (e.g., Store #001 | Manager: Phelip)
- **Search bar**: "Search parts, brands, vehicles..."

