import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { db } from '../Firebase/Firebase';
import { getAuth } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Provider } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';

// Hàm xử lý sự kiện để tương thích với web và mobile
const safeHandlePress = (callback) => {
  return (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }
    callback();
  };
};

export default function GroupsScreen({ navigation }) {
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const auth = getAuth();
  const currentUser = auth.currentUser;

  // Đưa fetchGroups ra ngoài để dùng cho useFocusEffect
    const fetchGroups = async () => {
      try {
        const q = query(
          collection(db, 'Conversations'),
          where('members', 'array-contains', currentUser.uid),
          where('is_group', '==', true)
        );
        const querySnapshot = await getDocs(q);
        const groupsData = querySnapshot.docs.map(doc => doc.data());
        setGroups(groupsData);
      } catch (error) {
        console.error('Error fetching groups:', error);
        Alert.alert('Lỗi', 'Không thể tải danh sách nhóm');
      } finally {
        setIsLoading(false);
      }
    };

  useFocusEffect(
    React.useCallback(() => {
      if (!currentUser || !currentUser.uid) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
    fetchGroups();
    }, [currentUser])
  );

  const handleSelectGroup = (group) => {
    try {
      navigation.navigate('ChatGroup', {
        groupId: group.con_id,
        groupName: group.name
      });
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Lỗi', 'Không thể mở cuộc trò chuyện nhóm');
    }
  };

  // Tính toán số thành viên (không bao gồm người dùng hiện tại)
  const getActualMembersCount = (members) => {
    if (!members || !Array.isArray(members)) return 0;
    // Nếu muốn hiển thị chính xác số thành viên khác (không tính người dùng hiện tại)
    // return members.filter(id => id !== currentUser.uid).length;
    
    // Nếu muốn hiển thị tổng số thành viên thực (bao gồm người dùng hiện tại)
    return members.length;
  };

  return (
    <Provider>
      <View style={styles.container}>
        <Text style={styles.title}>Danh sách nhóm chat:</Text>
        {!isLoading && (
          <FlatList
            data={groups}
            keyExtractor={(item) => item.con_id}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.groupItem} 
                onPress={safeHandlePress(() => handleSelectGroup(item))}
              >
                <Text style={styles.groupName}>{item.name}</Text>
                <Text style={styles.memberCount}>{getActualMembersCount(item.members)} thành viên</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>Bạn chưa tham gia nhóm nào!</Text>}
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
  groupItem: {
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 10,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  memberCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 20,
  }
}); 