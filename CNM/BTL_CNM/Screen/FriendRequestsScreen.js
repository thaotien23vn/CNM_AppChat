import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { db } from '../Firebase/Firebase';
import { getAuth } from 'firebase/auth';
import { user } from './UserContext';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
} from 'firebase/firestore';

export default function FriendRequestsScreen() {
  const [requests, setRequests] = useState([]);
  const auth = getAuth();
  const currentUser = auth.currentUser;
  useEffect(() => {
    if (!currentUser) return;

    const fetchRequests = async () => {
      
      try {
        const q = query(collection(db, 'friend_requests'), where('to', '==', currentUser.uid), where('status', '==', 'pending'));
        const snapshot = await getDocs(q);
        const result = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        
        setRequests(result);
      } catch (err) {
        console.error(err);
        Alert.alert('Lỗi', 'Không thể lấy danh sách lời mời kết bạn.');
      }
    };

    fetchRequests();
  }, []);

  const acceptRequest = async (request) => {
    try {
      // Cập nhật trạng thái friend_requests
      await updateDoc(doc(db, 'friend_requests', request.id), {
        status: 'accepted',
      });

      // Thêm vào collection `friends`
      const friendId = request.from;
      await setDoc(doc(db, 'friends', `${currentUser.uid}_${friendId}`), {
        users: [currentUser.uid, friendId],
        createdAt: new Date(),
      });
      await setDoc(doc(db, 'friends', `${friendId}_${currentUser.uid}`), {
        users: [friendId, currentUser.uid],
        createdAt: new Date(),
      });

      Alert.alert('✅ Thành công', 'Bạn đã chấp nhận lời mời!');
      setRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (error) {
      console.error(error);
      Alert.alert('Lỗi', 'Không thể chấp nhận lời mời.');
    }
  };

  const rejectRequest = async (request) => {
    try {
      await deleteDoc(doc(db, 'friend_requests', request.id));
      Alert.alert('Đã từ chối lời mời kết bạn.');
      setRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (error) {
      console.error(error);
      Alert.alert('Lỗi', 'Không thể từ chối lời mời.');
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.email}>Từ: {item.from}</Text>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => acceptRequest(item)} style={styles.accept}>
          <Text style={styles.btnText}>Chấp nhận</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => rejectRequest(item)} style={styles.reject}>
          <Text style={styles.btnText}>Từ chối</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Lời mời kết bạn</Text>
      <FlatList
        data={requests}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>Không có lời mời nào.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f1f1f1' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    elevation: 3,
  },
  email: { fontSize: 16, marginBottom: 10 },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  accept: {
    backgroundColor: '#28a745',
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  reject: {
    backgroundColor: '#dc3545',
    padding: 10,
    borderRadius: 5,
    flex: 1,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 50, color: '#888' },
});
