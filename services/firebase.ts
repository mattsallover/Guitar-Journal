
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

// IMPORTANT: Replace this with your own Firebase project's configuration
// You can find this in your Firebase project settings.
const firebaseConfig = {
  apiKey: "AIzaSyA8SNcI-GTvACbPZXROb_Kn2PhHNP5hBK4",
  authDomain: "guitar-journal-78a67.firebaseapp.com",
  projectId: "guitar-journal-78a67",
  storageBucket: "guitar-journal-78a67.appspot.com",
  messagingSenderId: "508797898397",
  appId: "1:508797898397:web:7b4848839715de23ba8e74"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

export { auth, db, storage };
