// The only module that imports the Firebase SDK. The rest of the cloud layer imports the
// initialised handles and SDK functions from here, which keeps the SDK replaceable in tests.
import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, OAuthProvider, getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
export type { User } from "firebase/auth";
export {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
export type {
  DocumentData,
  DocumentReference,
  FieldValue,
  Query,
  SnapshotMetadata,
  Unsubscribe,
} from "firebase/firestore";

// The web apiKey is public by design; access is governed by firestore.rules.
export const firebaseConfig = {
  apiKey: "AIzaSyCUcnUeduw8MfqAYvqZst6QC5JYA1Y96DA",
  authDomain: "podmates2027.firebaseapp.com",
  projectId: "podmates2027",
  storageBucket: "podmates2027.firebasestorage.app",
  messagingSenderId: "225347429899",
  appId: "1:225347429899:web:9b26e304b5542cd580c90e",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
// Needs Yahoo switched on under Firebase > Authentication > Sign-in method.
export const yahooProvider = new OAuthProvider("yahoo.com");
