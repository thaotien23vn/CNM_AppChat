import React, { useEffect, useState, useLayoutEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { db } from '../Firebase/Firebase';
import { getAuth } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Menu, Provider, IconButton } from 'react-native-paper';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function ContactsScreen({ navigation }) {
  const [friends, setFriends] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const auth = getAuth();
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser || !currentUser.uid) {
      setIsLoading(false);
      return;
    }

    const fetchFriends = async () => {
      try {
        const q1 = query(
          collection(db, 'friend_requests'),
          where('status', '==', 'accepted'),
          where('from', '==', currentUser.uid)
        );
        const q2 = query(
          collection(db, 'friend_requests'),
          where('status', '==', 'accepted'),
          where('to', '==', currentUser.uid)
        );

        const [fromSnap, toSnap] = await Promise.all([getDocs(q1), getDocs(q2)]);

        const friendIds = new Set();
        fromSnap.forEach(doc => friendIds.add(doc.data().to));
        toSnap.forEach(doc => friendIds.add(doc.data().from));

        const userDocs = await Promise.all(
          Array.from(friendIds).map(async uid => {
            const userQ = query(collection(db, 'Users'), where('user_id', '==', uid));
            const userSnap = await getDocs(userQ);
            return userSnap.docs[0]?.data();
          })
        );

        setFriends(userDocs.filter(Boolean));
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFriends();
  }, [currentUser]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <IconButton
              icon={() => <Ionicons name="ellipsis-vertical" size={24} color="#fff" />}
              onPress={() => setMenuVisible(true)}
            />
          }>
          <Menu.Item onPress={() => { setMenuVisible(false); navigation.navigate('AddFriend'); }} title="Thêm bạn" leadingIcon="account-plus" />
          <Menu.Item onPress={() => { setMenuVisible(false); navigation.navigate('CreateGroup'); }} title="Tạo nhóm" leadingIcon="account-multiple-plus" />
          <Menu.Item onPress={() => { setMenuVisible(false); navigation.navigate('FriendRequests'); }} title="Lời mời kết bạn" leadingIcon="account-arrow-right" />
          <Menu.Item onPress={() => setMenuVisible(false)} title="Tạo cuộc gọi nhóm" leadingIcon="video" />
          <Menu.Item onPress={() => setMenuVisible(false)} title="Thiết bị đăng nhập" leadingIcon="monitor" />
        </Menu>
      ),
    });
  }, [navigation, menuVisible]);

  const handleSelectUser = (friend) => {
    navigation.navigate('Chats', {
      currentUserId: currentUser.uid,
      chatWithUserId: friend.user_id,
    });
  };

  return (
    <Provider>
      <View style={styles.container}>
        <Text style={styles.title}>Bạn bè của bạn:</Text>
        {!isLoading && (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.user_id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.userItem} onPress={() => handleSelectUser(item)}>
                <Text style={styles.userText}>{item.fullName || item.name}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={{ color: '#888' }}>Bạn chưa có bạn bè nào!</Text>}
          />
        )}
      </View>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f1f1',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  userItem: {
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 10,
  },
  userText: {
    fontSize: 18,
    color: '#333',
  },
});