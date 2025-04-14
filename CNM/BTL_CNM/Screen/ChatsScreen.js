import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, StyleSheet } from 'react-native';
import { db } from '../Firebase/Firebase';
import { collection, addDoc, onSnapshot, query, where, getDocs, setDoc } from 'firebase/firestore';
import { launchImageLibrary } from 'react-native-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import uuid from 'react-native-uuid';

export default function ChatsScreen({ route }) {
  const { currentUserId, chatWithUserId } = route?.params || {};
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [conversationId, setConversationId] = useState(null);

  useEffect(() => {
    const findOrCreateConversation = async () => {
      if (!currentUserId || !chatWithUserId) return;

      const q = query(collection(db, 'UserConversation'), where('user_id', '==', currentUserId));
      const snapshot = await getDocs(q);
      let found = null;

      for (const docSnap of snapshot.docs) {
        const con_id = docSnap.data().con_id;
        const checkQ = query(
          collection(db, 'UserConversation'),
          where('con_id', '==', con_id),
          where('user_id', '==', chatWithUserId)
        );
        const checkSnap = await getDocs(checkQ);
        if (!checkSnap.empty) {
          found = con_id;
          break;
        }
      }

      if (!found) {
        const newConId = `con_${uuid.v4()}`;
        await addDoc(collection(db, 'UserConversation'), { con_id: newConId, user_id: currentUserId });
        await addDoc(collection(db, 'UserConversation'), { con_id: newConId, user_id: chatWithUserId });
        await setDoc(doc(db, 'Conversations', newConId), {
          con_id: newConId,
          admin: currentUserId,
          is_group: false,
          members: [currentUserId, chatWithUserId],
          time: Date.now()
        });
        setConversationId(newConId);
      } else {
        setConversationId(found);
      }
    };
    findOrCreateConversation();
  }, [currentUserId, chatWithUserId]);

  useEffect(() => {
    if (!conversationId) return;
    const q = query(collection(db, 'Messages'), where('con_id', '==', conversationId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sorted = msgs.sort((a, b) => a.createdAt - b.createdAt);
      setMessages(sorted);
    });
    return () => unsubscribe();
  }, [conversationId]);

  const sendMessage = async () => {
    if (inputText.trim() && conversationId) {
      await addDoc(collection(db, 'Messages'), {
        con_id: conversationId,
        sender_id: currentUserId,
        content: inputText,
        type: 'text',
        createdAt: Date.now(),
        seen: false
      });
      setInputText('');
    }
  };

   const uploadImage = () => {
        launchImageLibrary({
            mediaType: 'photo',
            quality: 0.8,
            includeBase64: false,
            selectionLimit: 1,
        }, async (response) => {
            try {
                if (response.didCancel) {
                    console.log('User cancelled image picker');
                    return;
                }

                if (response.errorCode) {
                    console.log('ImagePicker Error: ', response.errorMessage);
                    return;
                }

                if (!response.assets || response.assets.length === 0) {
                    console.log('No assets selected');
                    return;
                }

                const asset = response.assets[0];
                if (!conversationId) {
                    console.log('No conversation ID available');
                    return;
                }

                setIsUploading(true);

                const type = 'image';
                const fileName = `${uuid.v4()}-${asset.fileName || 'image.jpg'}`;
                const fileRef = ref(getStorage(), `data/${currentUserId}/${fileName}`);

                const responseBlob = await fetch(asset.uri);
                const blob = await responseBlob.blob();

                // Tải lên hình ảnh lên Firebase Storage
                await uploadBytes(fileRef, blob);
                const downloadURL = await getDownloadURL(fileRef);

                // Thêm tin nhắn hình ảnh vào Firestore
                await addDoc(collection(db, MESSAGE_COLLECTION), {
                    con_id: conversationId,
                    sender_id: currentUserId,
                    receiver_id: chatWithUserId,
                    content: asset.fileName || '',
                    type,
                    url: downloadURL,
                    createdAt: Date.now(),
                    timestamp: Date.now(),
                    isRevoked: false,
                    seen: false
                });

                console.log('File uploaded successfully');
            } catch (error) {
                console.error('Error uploading file:', error);
                Alert.alert('Error', 'Could not upload file. Please try again.');
            } finally {
                setIsUploading(false);
            }
        });
    };
  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[
            styles.messageContainer,
            item.sender_id === currentUserId ? styles.userMessage : styles.friendMessage
          ]}>
            {item.type === 'image' ? (
              <Image source={{ uri: item.url }} style={styles.image} />
            ) : (
              <Text style={styles.messageText}>{item.content}</Text>
            )}
          </View>
        )}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message"
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={uploadImage} style={styles.sendButton}>
          <Text style={styles.sendButtonText}>Image</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  messageContainer: {
    margin: 10,
    padding: 10,
    borderRadius: 10,
    maxWidth: '80%'
  },
  userMessage: {
    backgroundColor: '#DCF8C6',
    alignSelf: 'flex-end'
  },
  friendMessage: {
    backgroundColor: '#ECECEC',
    alignSelf: 'flex-start'
  },
  messageText: {
    fontSize: 16
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 10
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#ddd'
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 15,
    height: 40
  },
  sendButton: {
    marginLeft: 10,
    justifyContent: 'center'
  },
  sendButtonText: {
    color: '#007AFF',
    fontWeight: 'bold'
  }
});