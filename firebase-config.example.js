// Firebase Configuration - Replace with your own config
// Get your config from Firebase Console > Project Settings > General > Your apps > Web app
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Enable persistence (offline support)
db.enablePersistence()
  .then(() => console.log('Firebase persistence enabled'))
  .catch((err) => console.error('Persistence error:', err));