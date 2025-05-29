import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Cấu hình Firebase của bạn
const firebaseConfig = {
    apiKey: "AIzaSyAML1yicU7JuwWQu18HZJlaldYrrUKkRO4",
    authDomain: "webzalo.firebaseapp.com",
    databaseURL: "https://webzalo-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "webzalo",
    storageBucket: "webzalo.firebasestorage.app",
    messagingSenderId: "170726745891",
    appId: "1:170726745891:web:b5b2239ad0b83d4f630e96",
    measurementId: "G-G9CTCQEKR5"
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);

// Khởi tạo các service
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app; 