import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator, ScrollView, RefreshControl, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useUser } from './UserContext'; // Import UserContext
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth, db } from '../Firebase/Firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function ProfileScreen({ navigation }) {
  const { user, setUser, isLoading, setIsLoading } = useUser(); // Sử dụng thông tin từ UserContext
  const [refreshing, setRefreshing] = useState(false);

  // Hàm làm mới dữ liệu người dùng
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    setIsLoading(true); // Set loading true khi bắt đầu fetch dữ liệu
    try {
      const userId = auth.currentUser ? auth.currentUser.uid : null;
      if (userId) {
        const userDocRef = doc(db, 'Users', userId);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
          const userData = docSnap.data();
          setUser({
            ...userData,
            id: userId // Cập nhật lại ID người dùng vào context
          });
        }
      }
    } catch (error) {
      console.error('Lỗi khi lấy thông tin người dùng:', error);
    } finally {
      setIsLoading(false); // Kết thúc loading khi lấy dữ liệu xong
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUserData(); // Gọi khi mở màn hình hoặc khi reload
    const unsubscribe = navigation.addListener('focus', () => {
      fetchUserData(); // Gọi khi màn hình focus lại
    });

    return unsubscribe; // Dọn dẹp listener khi component bị unmount
  }, [navigation]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.navigate('Login');
    } catch (error) {
      console.error('Lỗi khi đăng xuất:', error);
    }
  };  
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4c669f" />
        <Text style={styles.loadingText}>Đang tải thông tin người dùng...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4c669f']} />}
    >
      <LinearGradient
        colors={['#4c669f', '#3b5998', '#192f6a']}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <Image style={styles.avatar} source={{ uri: user?.img || 'https://www.kindpng.com/picc/m/22-223863_no-avatar-png-circle-transparent-png.png' }} />
          <Text style={styles.name}>{user?.fullName || 'Người dùng'}</Text>
          <Text style={styles.email}>{user?.email || 'Chưa có email'}</Text>
        </View>
      </LinearGradient>
      
      <View style={styles.profileContainer}>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color="#4c669f" style={styles.inputIcon} />
            <Text style={styles.infoLabel}>Số điện thoại:</Text>
            <Text style={styles.infoText}>{user?.phone || 'Chưa cập nhật'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color="#4c669f" style={styles.inputIcon} />
            <Text style={styles.infoLabel}>Địa chỉ:</Text>
            <Text style={styles.infoText}>{user?.address || 'Chưa cập nhật'}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('EditProfile')}>
          <LinearGradient colors={['#4c669f', '#3b5998', '#192f6a']} style={styles.buttonGradient}>
            <Ionicons name="create-outline" size={20} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Chỉnh sửa thông tin</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LinearGradient colors={['#ff6b6b', '#ee5253']} style={styles.buttonGradient}>
            <Ionicons name="log-out-outline" size={20} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Đăng Xuất</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerGradient: {
    paddingVertical: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    alignItems: 'center',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#fff',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  email: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 10,
  },
  profileContainer: {
    flex: 1,
    marginTop: -20,
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  inputIcon: {
    marginRight: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    width: 100,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  editButton: {
    marginBottom: 15,
    borderRadius: 12,
    overflow: 'hidden',
  },
  logoutButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});