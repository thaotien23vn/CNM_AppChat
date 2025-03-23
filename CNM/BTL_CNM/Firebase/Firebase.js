import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Cấu hình Firebase của bạn
const firebaseConfig = {
   };

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);

// Khởi tạo các service
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app; 