import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, enableIndexedDbPersistence, collection, doc, setDoc, writeBatch, onSnapshot, serverTimestamp, getDoc, getDocs, query, where, orderBy, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

let firebaseConfig = {
    apiKey: "AIzaSyDzFpffymwAdYQUPcTD5nO4G-VZLSZ0ARg",
    authDomain: "task-tracker-99af4.firebaseapp.com",
    projectId: "task-tracker-99af4",
    storageBucket: "task-tracker-99af4.firebasestorage.app",
    messagingSenderId: "604212921594",
    appId: "1:604212921594:web:c5ba2b450932c740ef7543",
    measurementId: "G-KX5CKT3K4Q"
};

const envAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
let useEnvFirebase = false;

if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    try {
        if (typeof __firebase_config === 'string') {
            firebaseConfig = JSON.parse(__firebase_config);
        } else if (typeof __firebase_config === 'object') {
            firebaseConfig = __firebase_config;
        }
        useEnvFirebase = true;
    } catch (e) {
        console.error("Failed to parse env firebase config", e);
    }
}

let isFirebaseAvailable = false;
let db = null;
let auth = null;

try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    isFirebaseAvailable = true;

    enableIndexedDbPersistence(db).catch(err => {
        if (err && err.code === 'failed-precondition') {
            console.warn('오프라인 persistence는 여러 탭에서 동시에 활성화할 수 없습니다. 현재 탭은 온라인 모드로 동작합니다.');
        } else if (err && err.code === 'unimplemented') {
            console.warn('현재 브라우저는 Firestore 오프라인 persistence를 지원하지 않습니다.');
        } else {
            console.warn("오프라인 모드 활성화 실패:", err && err.code ? err.code : err);
        }
    });
} catch (e) {
    console.warn("Firebase 초기화 우회 가동.", e);
}

window.isFirebaseAvailable = isFirebaseAvailable;
window.db = db;
window.auth = auth;
window.fs = { collection, doc, setDoc, writeBatch, onSnapshot, serverTimestamp, getDoc, getDocs, query, where, orderBy, deleteDoc, updateDoc };
window.signInAnonymously = signInAnonymously;
window.onAuthStateChanged = onAuthStateChanged;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.signOut = signOut;
window.updateProfile = updateProfile;

window.getTasksCollection = function () {
    if (isFirebaseAvailable && db) {
        if (useEnvFirebase) {
            return collection(db, 'artifacts', envAppId, 'public', 'data', 'tasks');
        } else {
            return collection(db, 'tasks');
        }
    }
    return null;
};

window.getTrackersCollection = function () {
    if (isFirebaseAvailable && db) {
        if (useEnvFirebase) {
            return collection(db, 'artifacts', envAppId, 'public', 'data', 'trackers');
        } else {
            return collection(db, 'trackers');
        }
    }
    return null;
};

window.getUsersCollection = function () {
    if (isFirebaseAvailable && db) {
        if (useEnvFirebase) {
            return collection(db, 'artifacts', envAppId, 'public', 'data', 'users');
        } else {
            return collection(db, 'users');
        }
    }
    return null;
};

window.getActivityLogsCollection = function () {
    if (isFirebaseAvailable && db) {
        if (useEnvFirebase) {
            return collection(db, 'artifacts', envAppId, 'public', 'data', 'activity_logs');
        } else {
            return collection(db, 'activity_logs');
        }
    }
    return null;
};

window.getProgressNotesCollection = function () {
    if (isFirebaseAvailable && db) {
        if (useEnvFirebase) {
            return collection(db, 'artifacts', envAppId, 'public', 'data', 'progress_notes');
        } else {
            return collection(db, 'progress_notes');
        }
    }
    return null;
};

// Execute checkAuth explicitly if it was waiting
if (typeof checkAuth === 'function') {
    checkAuth();
}
