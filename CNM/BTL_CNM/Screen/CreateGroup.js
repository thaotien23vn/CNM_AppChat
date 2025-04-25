import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from './UserContext';
import { db } from '../Firebase/Firebase';
import { getAuth } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, setDoc, doc } from 'firebase/firestore';
import uuid from 'react-native-uuid';

export default function CreateGroup({ navigation }) {
  const { user } = useUser();
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [showDirectChatModal, setShowDirectChatModal] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [creatingChat, setCreatingChat] = useState(null);
  
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const fetchFriendsList = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    setIsLoading(true);
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
      console.error('Error fetching friends:', error);
      Alert.alert('Error', 'Failed to load friends list');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    fetchFriendsList();
  }, [fetchFriendsList]);

  const isContactSelected = (userId) => {
    return selectedContacts.some(contact => contact.user_id === userId);
  };

  const toggleContact = (contact) => {
    setSelectedContacts(prev => {
      if (isContactSelected(contact.user_id)) {
        return prev.filter(c => c.user_id !== contact.user_id);
      } else {
        return [...prev, contact];
      }
    });
  };

  const createGroup = async () => {
    if (!currentUser?.uid) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    if (selectedContacts.length < 2) {
      Alert.alert('Error', 'Please select at least 2 members');
      return;
    }

    setIsCreatingGroup(true);

    try {
      const groupId = `con_${uuid.v4()}`;
      const memberIds = [currentUser.uid, ...selectedContacts.map(contact => contact.user_id)];
      
      // Tạo document trong collection Conversations
      await setDoc(doc(db, 'Conversations', groupId), {
        con_id: groupId,
        name: groupName.trim(),
        admin: currentUser.uid,
        is_group: true,
        members: memberIds,
        mess_info: [],
        time: Date.now()
      });

      // Tạo các document trong collection UserConversation cho từng thành viên
      for (const memberId of memberIds) {
        await setDoc(doc(db, 'UserConversation', `${groupId}_${memberId}`), {
          con_id: groupId,
          user_id: memberId,
          joinedAt: new Date().toISOString()
        });
      }
      
      Alert.alert('Success', 'Group created successfully');
      // Navigate to GroupsScreen thay vì ChatsScreen
      navigation.navigate('Groups');
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.groupNameInput}
        placeholder="Tên nhóm"
        value={groupName}
        onChangeText={setGroupName}
      />
      
      <View style={styles.selectedCountContainer}>
        <Text style={styles.selectedCountText}>
          Đã chọn: {selectedContacts.length}/2 thành viên (tối thiểu)
        </Text>
      </View>
      
      <Text style={styles.sectionTitle}>Chọn thành viên:</Text>
      
      {isLoading ? (
        <Text style={styles.loadingText}>Đang tải danh sách bạn bè...</Text>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.user_id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.contactItem}
              onPress={() => toggleContact(item)}
            >
              <Ionicons 
                name={isContactSelected(item.user_id) ? 'checkbox' : 'square-outline'} 
                size={24} 
                color="#27548A" 
              />
              <Text style={styles.contactName}>{item.fullName || item.name}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>Bạn chưa có bạn bè nào!</Text>}
        />
      )}
      
      <TouchableOpacity
        style={[styles.createButton, (!groupName || selectedContacts.length < 2) && styles.disabledButton]}
        onPress={createGroup}
        disabled={!groupName || selectedContacts.length < 2 || isCreatingGroup}
      >
        <Text style={styles.buttonText}>
          {isCreatingGroup ? 'Đang tạo...' : 'Tạo nhóm'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  groupNameInput: {
    fontSize: 18,
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#ddd',
    marginBottom: 16,
  },
  selectedCountContainer: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  selectedCountText: {
    fontSize: 14,
    color: '#27548A',
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  contactName: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  createButton: {
    backgroundColor: '#27548A',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
  },
});