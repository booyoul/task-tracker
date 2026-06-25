// --- (1) Firebase & Environment Config ---
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

        if (typeof firebase !== 'undefined') {
            try {
                if (!firebase.apps.length) {
                    firebase.initializeApp(firebaseConfig);
                }
                db = firebase.firestore();
                auth = firebase.auth();
                isFirebaseAvailable = true;
                db.enablePersistence().catch(err => { console.warn("오프라인 모드 활성화 실패:", err.code); });
            } catch (e) {
                console.warn("Firebase 초기화 우회 가동.", e);
            }
        }

        function getTasksCollection() {
            if (isFirebaseAvailable && db) {
                if (useEnvFirebase) {
                    return db.collection('artifacts').doc(envAppId).collection('public').doc('data').collection('tasks');
                } else {
                    return db.collection("tasks");
                }
            }
            return null;
        }

        function getTrackersCollection() {
            if (isFirebaseAvailable && db) {
                if (useEnvFirebase) {
                    return db.collection('artifacts').doc(envAppId).collection('public').doc('data').collection('trackers');
                } else {
                    return db.collection("trackers");
                }
            }
            return null;
        }
