class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        this.setupAuthListener();
        this.setupEventListeners();
        this.checkFirstRun();
    }

    checkFirstRun() {
        // Check if there are any users
        auth.fetchSignInMethodsForEmail('test@test.com').catch(() => {
            // If Firebase is fresh, show admin setup
            const adminSection = document.getElementById('adminSetupSection');
            const loginSection = document.getElementById('loginSection');
            if (adminSection) adminSection.style.display = 'block';
            if (loginSection) loginSection.style.display = 'none';
        });
    }

    setupAuthListener() {
        auth.onAuthStateChanged(
            (user) => {
                if (user) {
                    // Refresh token
                    user.getIdToken(true).then(() => {
                        this.currentUser = {
                            id: user.uid,
                            name: user.displayName || 'Cashier',
                            email: user.email
                        };
                        
                        db.collection('users').doc(user.uid).get()
                            .then(doc => {
                                if (doc.exists) {
                                    this.currentUser.role = doc.data().role || 'cashier';
                                }
                                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                                localStorage.setItem('cashierName', this.currentUser.name);
                                
                                if (window.location.pathname.includes('login.html')) {
                                    window.location.href = 'index.html';
                                }
                            })
                            .catch(() => {
                                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                                localStorage.setItem('cashierName', this.currentUser.name);
                            });
                    });
                } else {
                    this.currentUser = null;
                    localStorage.removeItem('currentUser');
                    localStorage.removeItem('cashierName');
                }
            },
            (error) => {
                console.error('Auth error:', error);
                auth.signOut();
                localStorage.removeItem('currentUser');
                localStorage.removeItem('cashierName');
            }
        );
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
                tab.classList.add('active');
                const target = document.getElementById(tab.dataset.tab + 'Form');
                if (target) target.classList.add('active');
                this.hideMessages();
            });
        });

        // Admin setup form
        const adminSetupForm = document.getElementById('adminSetupForm');
        if (adminSetupForm) {
            adminSetupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createAdmin();
            });
        }

        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.login();
            });
        }

        // Signup form
        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.signup();
            });
        }

        // Logout buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('#logoutBtnHeader')) {
                e.preventDefault();
                this.logout();
            }
        });
    }

    async signup() {
        const name = document.getElementById('signupName').value.trim();
        const position = document.getElementById('signupPosition').value;
        const email = document.getElementById('signupEmail').value.trim().toLowerCase();
        const password = document.getElementById('signupPassword').value;

        if (!name || !email || !password) {
            this.showError('Please fill in all fields');
            return;
        }

        if (password.length < 6) {
            this.showError('Password must be at least 6 characters');
            return;
        }

        // Check if trying to create admin when one already exists
        if (position === 'admin') {
            const usersSnapshot = await db.collection('users').where('role', '==', 'admin').get();
            if (!usersSnapshot.empty) {
                this.showError('An Admin account already exists. Only one Admin is allowed.');
                return;
            }
        }

        try {
            // Sign out any existing user first
            if (auth.currentUser) {
                await auth.signOut();
            }

            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await userCredential.user.updateProfile({ displayName: name });
            
            await db.collection('users').doc(userCredential.user.uid).set({
                name: name,
                email: email,
                role: position,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.currentUser = {
                id: userCredential.user.uid,
                name: name,
                email: email,
                role: position
            };
            
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            localStorage.setItem('cashierName', name);
            this.showSuccess('Account created! Redirecting...');
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') {
                this.showError('This email is already registered');
            } else {
                this.showError(error.message);
            }
        }
    }

    async login() {
        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            this.showError('Please fill in all fields');
            return;
        }

        try {
            // Sign out any existing user first
            if (auth.currentUser) {
                await auth.signOut();
            }

            await auth.signInWithEmailAndPassword(email, password);
            this.showSuccess('Login successful! Redirecting...');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                this.showError('No account found with this email');
            } else if (error.code === 'auth/wrong-password') {
                this.showError('Incorrect password');
            } else if (error.code === 'auth/invalid-credential') {
                this.showError('Invalid credentials. Please try again.');
            } else {
                this.showError(error.message);
            }
        }
    }

    async createAdmin() {
        const name = document.getElementById('adminName').value.trim();
        const position = document.getElementById('adminPosition')?.value || 'admin';
        const email = document.getElementById('adminEmail').value.trim().toLowerCase();
        const password = document.getElementById('adminPassword').value;
        const confirmPassword = document.getElementById('adminConfirmPassword').value;

        if (!name || !email || !password) {
            this.showError('Please fill in all fields');
            return;
        }

        if (password.length < 6) {
            this.showError('Password must be at least 6 characters');
            return;
        }

        if (password !== confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }

        // Check if admin already exists
        const usersSnapshot = await db.collection('users').where('role', '==', 'admin').get();
        if (!usersSnapshot.empty) {
            this.showError('An Admin account already exists.');
            // Hide admin setup, show login
            document.getElementById('adminSetupSection').style.display = 'none';
            document.getElementById('loginSection').style.display = 'block';
            return;
        }

        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await userCredential.user.updateProfile({ displayName: name });
            
            await db.collection('users').doc(userCredential.user.uid).set({
                name: name,
                email: email,
                role: position,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.currentUser = {
                id: userCredential.user.uid,
                name: name,
                email: email,
                role: position
            };
            
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            localStorage.setItem('cashierName', name);
            this.showSuccess('Account created! Redirecting...');
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        } catch (error) {
            this.showError(error.message);
        }
    }

    async logout() {
        if (confirm('Are you sure you want to logout?')) {
            try {
                await auth.signOut();
                localStorage.removeItem('currentUser');
                localStorage.removeItem('cashierName');
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Logout error:', error);
            }
        }
    }

    showError(message) {
        const errorEl = document.getElementById('authError');
        const successEl = document.getElementById('authSuccess');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add('show');
        }
        if (successEl) successEl.classList.remove('show');
        setTimeout(() => {
            if (errorEl) errorEl.classList.remove('show');
        }, 4000);
    }

    showSuccess(message) {
        const successEl = document.getElementById('authSuccess');
        const errorEl = document.getElementById('authError');
        if (successEl) {
            successEl.textContent = message;
            successEl.classList.add('show');
        }
        if (errorEl) errorEl.classList.remove('show');
    }

    hideMessages() {
        const errorEl = document.getElementById('authError');
        const successEl = document.getElementById('authSuccess');
        if (errorEl) errorEl.classList.remove('show');
        if (successEl) successEl.classList.remove('show');
    }

    updateCashierDisplay() {
        const nameEls = document.querySelectorAll('#cashierName');
        nameEls.forEach(el => {
            if (el && this.currentUser) {
                el.textContent = this.currentUser.name;
            }
        });
    }
}

const authSystem = new AuthSystem();

