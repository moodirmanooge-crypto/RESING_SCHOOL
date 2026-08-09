//src/firebase/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

/* ===========================================================
   RISING STAR SCHOOL (NEW DATABASE)
   Project ID = one-click-onilne
=========================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyBXFegVGIyVk02zY6Ks3DhcoWjomNw_ht0",
  authDomain: "one-click-onilne.firebaseapp.com",
  projectId: "one-click-onilne",
  storageBucket: "one-click-onilne.firebasestorage.app",
  messagingSenderId: "988928725446",
  appId: "1:988928725446:web:64ce641d4da19b7643a2c7",
  measurementId: "G-PKTR17K6MX"
};

/* ===========================================================
   GALLAD TECH STORAGE
=========================================================== */

const galladConfig = {
  apiKey: "AIzaSyCXOp6MPnwArV0NiPPAmkBBKdvQoc0gadk",
  authDomain: "rawaan-online-shop.firebaseapp.com",
  projectId: "rawaan-online-shop",
  storageBucket: "rawaan-online-shop.firebasestorage.app",
  messagingSenderId: "492970437433",
  appId: "1:492970437433:web:17249ff78baca4e86b56e8",
};

// apiKey: "AIzaSyCXOp6MPnwArV0NiPPAmkBBKdvQoc0gadk",
const risingApp = initializeApp(firebaseConfig, "rising");
const galladApp = initializeApp(galladConfig, "gallad");

/* ===========================================================
   EXPORTS
=========================================================== */

export const db = getFirestore(risingApp);       // Firestore - one-click-onilne
export const auth = getAuth(risingApp);          // Auth - login/password - one-click-onilne
export const storage = getStorage(risingApp);    // Storage - Rising Star School (one-click-onilne)
export const functions = getFunctions(risingApp, "us-central1"); // Backend Functions

// Halkan waxaa ku jira labadii magac si uusan `SendSmsModal.jsx` u caban
export { risingApp, galladApp };
export const app = risingApp;

export default risingApp;