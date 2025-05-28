import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform
} from 'react-native';
import { getAuth } from 'firebase/auth';
import { db } from '../Firebase/Firebase';
import { collection, addDoc, onSnapshot, query, where, orderBy } from 'firebase/firestore';

export default function ChatGroup({ route }) {
  const { groupId, groupName } = route.params;
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef(null);

  useEffect(() => {
    const q = query(
      collection(db, 'Messages'),
      where('con_id', '==', groupId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(fetched);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => unsubscribe();
  }, [groupId]);

  const sendMessage = async () => {
    if (inputText.trim()) {
      await addDoc(collection(db, 'Messages'), {
        con_id: groupId,
        sender_id: currentUser.uid,
        content: inputText,
        type: 'text',
        createdAt: Date.now(),
      });
      setInputText('');
    }
  };

  const renderItem = ({ item }) => (
    <View style={[
      styles.messageContainer,
      item.sender_id === currentUser.uid ? styles.myMessage : styles.otherMessage
    ]}>
      <Text style={styles.messageText}>{item.content}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>{groupName || 'Nhóm Chat'}</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Nhập tin nhắn..."
          />
          <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
            <Text style={styles.sendButtonText}>Gửi</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 16, backgroundColor: '#27548A' },
  headerText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  list: { padding: 10 },
  messageContainer: { marginVertical: 6, padding: 10, borderRadius: 8, maxWidth: '75%' },
  myMessage: { alignSelf: 'flex-end', backgroundColor: '#DCF8C6' },
  otherMessage: { alignSelf: 'flex-start', backgroundColor: '#EEE' },
  messageText: { fontSize: 16 },
  inputContainer: {
    flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: '#ddd', backgroundColor: '#fff'
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 20, paddingHorizontal: 15
  },
  sendButton: {
    backgroundColor: '#27548A', paddingHorizontal: 20, justifyContent: 'center', borderRadius: 20, marginLeft: 8
  },
  sendButtonText: { color: '#fff', fontWeight: 'bold' }
});
