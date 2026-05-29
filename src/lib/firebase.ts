import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyChRbeI9lV93f9EC8bjEoUkEG8jop7md70",
  authDomain: "st-points.firebaseapp.com",
  projectId: "st-points",
  storageBucket: "st-points.firebasestorage.app",
  messagingSenderId: "887283109588",
  appId: "1:887283109588:web:f65f14288b548140007541",
  measurementId: "G-JQ5YS8EHLS"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
