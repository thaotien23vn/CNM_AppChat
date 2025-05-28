import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, SafeAreaView, ActivityIndicator } from 'react-native';
import { db } from '../Firebase/Firebase';
import { getAuth } from 'firebase/auth';
import { user } from './UserContext';
import Icon from 'react-native-vector-icons/FontAwesome';
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
  const [loading, setLoading] = useState(true);
  const auth = getAuth();
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;

    const fetchRequests = async () => {
      setLoading(true);
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
      } finally {
        setLoading(false);
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
      <View style={styles.cardHeader}>
        <View style={styles.avatarContainer}>
          <Icon name="user-circle" size={40} color="#3f15d6" />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>Người dùng</Text>
          <Text style={styles.userEmail}>{item.from}</Text>
        </View>
      </View>
      
      <View style={styles.divider} />
      
      <Text style={styles.requestMessage}>
        <Icon name="envelope" size={14} color="#666" /> Đã gửi lời mời kết bạn đến bạn
      </Text>
      
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => acceptRequest(item)} style={styles.accept}>
          <Icon name="check" size={16} color="#fff" style={styles.actionIcon} />
          <Text style={styles.btnText}>Chấp nhận</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => rejectRequest(item)} style={styles.reject}>
          <Icon name="times" size={16} color="#fff" style={styles.actionIcon} />
          <Text style={styles.btnText}>Từ chối</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Icon name="users" size={60} color="#d1d1d1" />
      <Text style={styles.empty}>Không có lời mời kết bạn nào.</Text>
      <Text style={styles.emptySubtitle}>Hãy mời bạn bè tham gia ứng dụng nhé!</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerSection}>
          <Text style={styles.header}>Lời mời kết bạn</Text>
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{requests.length}</Text>
          </View>
        </View>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3f15d6" />
            <Text style={styles.loadingText}>Đang tải lời mời...</Text>
          </View>
        ) : (
          <FlatList
            data={requests}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            ListEmptyComponent={renderEmptyComponent}
            contentContainerStyle={requests.length === 0 ? {flex: 1, justifyContent: 'center'} : {paddingBottom: 20}}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  container: { 
    flex: 1, 
    padding: 16, 
    backgroundColor: '#F8F9FA' 
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  header: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#333333',
  },
  badgeContainer: {
    backgroundColor: '#3f15d6',
    height: 24,
    width: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#e9e9e9',
    marginVertical: 12,
  },
  requestMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  actions: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
  },
  actionIcon: {
    marginRight: 8,
  },
  accept: {
    flexDirection: 'row',
    backgroundColor: '#3f15d6',
    padding: 12,
    borderRadius: 10,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3f15d6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  reject: {
    flexDirection: 'row',
    backgroundColor: '#FF3B30',
    padding: 12,
    borderRadius: 10,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  btnText: { 
    color: '#fff', 
    fontWeight: 'bold',
    fontSize: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  empty: { 
    textAlign: 'center', 
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptySubtitle: {
    textAlign: 'center',
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  }
});
