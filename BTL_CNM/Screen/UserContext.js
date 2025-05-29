// Screen/UserContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, updateDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../Firebase/Firebase';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null); // ban đầu là null để dễ kiểm tra
  const [isEditing, setIsEditing] = useState(false);

  // Load dữ liệu user khi bắt đầu
  useEffect(() => {
    const loadUser = async () => {
      try {
        const savedUser = await AsyncStorage.getItem('user');
        const localUser = savedUser ? JSON.parse(savedUser) : null;

        // Nếu có user_id, load từ Firestore
        if (localUser?.user_id) {
          const userDoc = await getDoc(doc(db, "users", localUser.user_id));
          if (userDoc.exists()) {
            const firestoreUser = userDoc.data();
            const mergedUser = {
              ...firestoreUser,
              ...localUser, // Ưu tiên dữ liệu local
              img: localUser.img || firestoreUser.img || '' 
            };
            setUser(mergedUser);
            await AsyncStorage.setItem('user', JSON.stringify(mergedUser));
          }
        } else {
          setUser(localUser);
        }
      } catch (error) {
        console.error('Lỗi khi load user:', error);
      }
    };
    loadUser();
  }, []);

  // lưu dữ liệu từ user khi nó thay đổi
  const persistUser = async (newUser) => {
    try {
      // Merge với dữ liệu từ Firestore nếu có
      const mergedUser = {
        ...user,
        ...newUser,
        fullName: newUser.fullName || user?.fullName || '',
        email: newUser.email || user?.email || '',
        img: newUser.img || user?.img || '',
        phone: newUser.phone || user?.phone || '',
        address: newUser.address || user?.address || ''
      };
      
      console.log('Merged user data:', mergedUser);
      await AsyncStorage.setItem('user', JSON.stringify(mergedUser));
      setUser(mergedUser);
      
      // Đồng bộ lên Firestore
      if (newUser.user_id || user?.user_id) {
        const userId = newUser.user_id || user.user_id;
        const userDoc = doc(db, "Users", userId);
        
        // Chỉ cập nhật các trường profile
        const updateData = {
          fullName: newUser.fullName || user?.fullName || '',
          email: newUser.email || user?.email || '',
          img: newUser.img || user?.img || '',
          phone: newUser.phone || user?.phone || '',
          address: newUser.address || user?.address || ''
        };

        // Chỉ update các trường đã thay đổi
        await updateDoc(userDoc, updateData);
        console.log('Cập nhật Firestore thành công');
      }
    } catch (error) {
      console.error('Lỗi khi lưu user:', error);
    }
  };

  return (
    <UserContext.Provider value={{ user, setUser: persistUser, isEditing, setIsEditing }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);