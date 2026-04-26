// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyB7vVOatydHKUj9JENusOYxBWBLmKXdHr0",
  authDomain: "motor-parts-pos-1c08e.firebaseapp.com",
  projectId: "motor-parts-pos-1c08e",
  storageBucket: "motor-parts-pos-1c08e.firebasestorage.app",
  messagingSenderId: "650743742615",
  appId: "1:650743742615:web:3b8d22e2a925467f3a69d2"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Enable persistence (offline support)
try {
    db.enablePersistence().catch(() => {
        db.settings({ cache: {} });
    });
} catch (e) {
    console.log('Persistence setup complete');
}

