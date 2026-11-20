/*
  1. Create a Firebase project at https://console.firebase.google.com/
  2. Register a Web App and paste its configuration below.
  3. Enable Authentication > Email/Password and create a Cloud Firestore database.
*/
const firebaseConfig = {
  apiKey: "AIzaSyBPZ4tFh70l0JKypIpFvabNfgOdYlfujSg",
  authDomain: "ecommerce-app-44b06.firebaseapp.com",
  projectId: "ecommerce-app-44b06",
  storageBucket: "ecommerce-app-44b06.firebasestorage.app",
  messagingSenderId: "173535439726",
  appId: "1:173535439726:web:9a0461762ff9deed7e2f7f",
  measurementId: "G-7N4GH1L55K"
};


let firebaseReady = false;
let auth = null;
let db = null;
try {
  if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    firebaseReady = true;
  }
} catch (error) {
  console.error("Firebase initialization failed:", error);
}
