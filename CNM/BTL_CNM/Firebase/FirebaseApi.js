import { db, storage } from '../Firebase/Firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, orderBy, onSnapshot, serverTimestamp, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const conversationApi = {
    // Tạo cuộc trò chuyện mới
    createConversation: async (data) => {
        const docRef = await addDoc(collection(db, 'Conversations'), {
            ...data,
            createdAt: serverTimestamp()
        });
        return docRef.id;
    },

export const storageApi = {
    uploadImage: async (file, userId) => {
        // Tạo đường dẫn lưu trữ: images/userId/timestamp_filename
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;
        const storageRef = ref(storage, `images/${userId}/${fileName}`);

        // Upload file
        await uploadBytes(storageRef, file);

        // Lấy URL của ảnh đã upload
        const downloadURL = await getDownloadURL(storageRef);
        return downloadURL;
    }
}; 