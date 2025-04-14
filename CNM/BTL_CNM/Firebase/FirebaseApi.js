// Firebase imports
import { db, storage } from '../Firebase/Firebase';
import {
  collection,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Gửi tin nhắn văn bản
export const messageApi = {
  sendMessage: async (data) => {
    try {
      const messageData = {
        ...data,
        createdAt: Date.now(),
        timestamp: Date.now()
      };

      const messageRef = await addDoc(collection(db, 'Messages'), messageData);
      return messageRef.id;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }
};

// Gửi ảnh
export const imageMessageApi = {
  sendImageMessage: async (file, userId, conversationId) => {
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const storageRef = ref(storage, `images/${userId}/${fileName}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      const messageData = {
        con_id: conversationId,
        sender_id: userId,
        content: file.name,
        type: 'image',
        url: downloadURL,
        createdAt: Date.now(),
        seen: false
      };

      const messageRef = await addDoc(collection(db, 'Messages'), messageData);
      return messageRef.id;
    } catch (error) {
      console.error('Lỗi khi gửi ảnh:', error);
      throw error;
    }
  }
};

// Gửi video
export const videoMessageApi = {
  sendVideoMessage: async (file, userId, conversationId) => {
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const storageRef = ref(storage, `videos/${userId}/${fileName}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      const messageData = {
        con_id: conversationId,
        sender_id: userId,
        content: file.name,
        type: 'video',
        url: downloadURL,
        createdAt: Date.now(),
        seen: false
      };

      const messageRef = await addDoc(collection(db, 'Messages'), messageData);
      return messageRef.id;
    } catch (error) {
      console.error('Lỗi khi gửi video:', error);
      throw error;
    }
  }
};

// Gửi lời mời kết bạn
export const friendApi = {
  sendFriendRequest: async (fromUserId, toUserId) => {
    try {
      const requestRef = collection(db, 'friend_requests');
      const docRef = await addDoc(requestRef, {
        from: fromUserId,
        to: toUserId,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      return docRef.id;
    } catch (error) {
      console.error('Lỗi khi gửi lời mời kết bạn:', error);
      throw error;
    }
  }
};
