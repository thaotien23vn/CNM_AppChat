import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { db } from '../Firebase/Firebase';
import { getAuth } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import Icon from 'react-native-vector-icons/FontAwesome';

export default function AddFriendScreen() {
  const [email, setEmail] = useState('');
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const addFriend = async () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      Alert.alert('Lỗi', 'Vui lòng nhập đúng định dạng email.');
      return;
    }

    try {
      const usersRef = collection(db, 'Users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Alert.alert('Không tìm thấy', 'Email chưa được đăng ký Zala.');
        return;
      }

      const targetUser = querySnapshot.docs[0].data();
      const targetUserId = targetUser.user_id;
      console.log(targetUser)
      console.log(targetUserId)

      if (targetUserId === currentUser.uid) {
        Alert.alert('Lỗi', 'Không thể kết bạn với chính mình.');
        return;
      }

      const requestRef = collection(db, 'friend_requests');
      const checkExist = query(requestRef,
        where('from', '==', currentUser.uid),
        where('to', '==', targetUserId),
        where('status', '==', 'pending')
      );
      const existing = await getDocs(checkExist);
      if (!existing.empty) {
        Alert.alert('Thông báo', 'Bạn đã gửi lời mời đến người này rồi.');
        return;
      }

      await addDoc(requestRef, {
        from: currentUser.uid,
        to: targetUserId,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      Alert.alert('Thành công', 'Lời mời kết bạn đã được gửi!');
      setEmail('');
    } catch (error) {
      console.error(error);
      Alert.alert('Lỗi', 'Đã xảy ra lỗi. Vui lòng thử lại.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}>
        <View style={styles.headerContainer}>
          <Icon name="user-plus" size={50} color="#3f15d6" style={styles.headerIcon} />
          <Text style={styles.title}>Thêm bạn mới</Text>
          <Text style={styles.subtitle}>Kết nối với bạn bè qua email</Text>
        </View>
        
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Icon name="envelope" size={20} color="#838383" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Nhập email người bạn muốn kết bạn"
              placeholderTextColor="#A0A0A0"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          
          <TouchableOpacity style={styles.addButton} onPress={addFriend}>
            <Text style={styles.addButtonText}>Thêm bạn</Text>
            <Icon name="arrow-right" size={16} color="#FFFFFF" style={styles.buttonIcon} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA'
  },
  container: { 
    flex: 1, 
    justifyContent: 'flex-start', 
    alignItems: 'center', 
    backgroundColor: '#F8F9FA',
    padding: 20
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  headerIcon: {
    marginBottom: 15,
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center'
  },
  formContainer: {
    width: '100%',
    marginBottom: 30
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 5,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputIcon: {
    marginRight: 10
  },
  input: { 
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333333'
  },
  addButton: { 
    flexDirection: 'row',
    height: 56,
    backgroundColor: '#3f15d6', 
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6442FC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  addButtonText: { 
    color: '#fff', 
    fontWeight: 'bold',
    fontSize: 18
  },
  buttonIcon: {
    marginLeft: 10
  },
});
