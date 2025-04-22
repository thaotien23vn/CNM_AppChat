import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  Animated,
  Linking,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Menu, Provider, IconButton } from 'react-native-paper';
import { useUser } from './UserContext';
import Icon from 'react-native-vector-icons/FontAwesome';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import { Picker } from 'emoji-mart-native';
import AttachmentMenu from '../components/AttachmentMenu';
import * as ImagePicker from 'expo-image-picker';
import { db } from '../Firebase/Firebase';
import { collection, addDoc, onSnapshot, query, where, orderBy, getDoc, doc, updateDoc, getDocs, limit, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import moment from 'moment';
import 'moment/locale/en-gb';  // Import English locale
import uuid from 'react-native-uuid';
import VideoPlayer from '../components/RenderFileMessage';
import { pickDocument } from '../utils/platformUtils';
import { conversationApi } from '../Firebase/FirebaseApi';

// Set moment to use English locale
moment.locale('en-gb');

const MESSAGE_COLLECTION = 'Messages';

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

export default function ChatGroup({ route, navigation }) {
  const { user } = useUser();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [groupInfo, setGroupInfo] = useState(null);
  const [members, setMembers] = useState([]);
  const flatListRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Biến cho việc xử lý tệp và phương tiện
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  
  // Biến cho chức năng tương tác tin nhắn
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState([]);
  const [conversations, setConversations] = useState([]);

  // State for members modal
  const [showMembersModal, setShowMembersModal] = useState(false);

  // State for Add Members modal
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [availableFriends, setAvailableFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');

  // State cho modal xóa thành viên
  const [showRemoveMembersModal, setShowRemoveMembersModal] = useState(false);

  const { groupId, groupName } = route.params || {};
  const auth = getAuth();
  const currentUser = auth.currentUser;

  // Robust null/undefined checks for required data
  if (!groupId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'red', fontSize: 16 }}>Thiếu thông tin nhóm (groupId)</Text>
      </View>
    );
  }
  if (!currentUser) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'red', fontSize: 16 }}>Vui lòng đăng nhập lại</Text>
      </View>
    );
  }

  // Fetch group information
  useEffect(() => {
    const fetchGroupInfo = async () => {
      if (!groupId) return;
      
      try {
        const groupDoc = await getDoc(doc(db, 'Conversations', groupId));
        if (groupDoc.exists()) {
          const groupData = groupDoc.data();
          setGroupInfo(groupData);
          
          // Fetch group members
          const memberPromises = groupData.members.map(async (memberId) => {
            const userQuery = query(collection(db, 'Users'), where('user_id', '==', memberId));
            const userSnap = await getDocs(userQuery);
            if (!userSnap.empty) {
              return { id: memberId, ...userSnap.docs[0].data() };
            }
            return { id: memberId, name: 'Unknown User' };
          });
          
          const memberDetails = await Promise.all(memberPromises);
          setMembers(memberDetails);
          
          // Set navigation options with custom header
          navigation.setOptions({
            headerShown: false
          });
        }
      } catch (error) {
        console.error('Error fetching group info:', error);
        Alert.alert('Lỗi', 'Không thể tải thông tin nhóm');
      }
    };
    
    fetchGroupInfo();
  }, [groupId, navigation, groupName]);

  // Fetch messages
  useEffect(() => {
    if (!groupId) return;
    
    try {
      // Sử dụng truy vấn đơn giản hơn để tránh lỗi chỉ mục
      const q = query(
        collection(db, MESSAGE_COLLECTION), 
        where('con_id', '==', groupId),
        // Chỉ sử dụng orderBy nếu đã tạo chỉ mục trong Firebase console
        // orderBy('createdAt', 'asc')
        limit(100)  // Giới hạn số lượng tin nhắn
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        try {
          let fetchedMessages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Sắp xếp tin nhắn theo thời gian trên client
          fetchedMessages = fetchedMessages.sort((a, b) => a.createdAt - b.createdAt);
          
          setMessages(fetchedMessages);
          setIsLoading(false);
          
          // Mark messages as seen
          markMessagesAsSeen(fetchedMessages);
          
          // Scroll to bottom on new messages
          setTimeout(() => {
            if (flatListRef.current) {
              flatListRef.current.scrollToEnd({ animated: true });
            }
          }, 100);
        } catch (error) {
          console.error('Error processing messages:', error);
        }
      }, (error) => {
        console.error('Error in message listener:', error);
        Alert.alert(
          'Lỗi kết nối',
          'Không thể tải tin nhắn. Vui lòng kiểm tra kết nối và thử lại.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      });
      
      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up message listener:', error);
      setIsLoading(false);
    }
  }, [groupId]);

  // Đánh dấu tin nhắn đã xem
  const markMessagesAsSeen = async (msgs) => {
    if (!currentUser || !msgs.length) return;

    try {
      // Lọc tin nhắn chưa được đánh dấu là đã xem và không phải của người dùng hiện tại
      const unseenMessages = msgs.filter(
        msg => !msg.seen && msg.sender_id !== currentUser.uid
      );

      // Nếu có tin nhắn chưa xem, cập nhật trạng thái
      for (const msg of unseenMessages) {
        await updateDoc(doc(db, MESSAGE_COLLECTION, msg.id), {
          seen: true,
          seenAt: Date.now()
        });
      }
    } catch (error) {
      console.error('Error marking messages as seen:', error);
    }
  };

  const sendMessage = async () => {
    if (inputText.trim() && groupId && currentUser) {
      try {
        await addDoc(collection(db, MESSAGE_COLLECTION), {
          con_id: groupId,
          sender_id: currentUser.uid,
          content: inputText,
          type: 'text',
          createdAt: Date.now(),
          timestamp: Date.now(),
          isRevoked: false,
          seen: false
        });
        
        setInputText('');
      } catch (error) {
        console.error('Error sending message:', error);
        Alert.alert('Lỗi', 'Không thể gửi tin nhắn. Vui lòng thử lại.');
      }
    }
  };

  const handleEmojiClick = (emoji) => {
    if (emoji?.native) {
      setInputText(prev => prev + emoji.native);
      setShowEmojiPicker(false);
    }
  };

  // Hàm theo dõi tiến trình tải lên
  const handleProgress = (progress) => {
    setUploadProgress(progress);
  };

  // Hàm bắt đầu tải lên video/file
  const handleUploadStart = () => {
    setIsUploading(true);
  };

  // Hàm kết thúc tải lên video/file
  const handleUploadEnd = () => {
    setIsUploading(false);
    setUploadProgress(0);
  };

  // Hàm tải lên hình ảnh
  const uploadImage = async () => {
    if (!groupId) {
      Alert.alert('Lỗi', 'Không thể xác định nhóm chat.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        handleUploadStart();
        const asset = result.assets[0];
        const uri = asset.uri;
        
        // Tạo tên file duy nhất
        const filename = uri.substring(uri.lastIndexOf('/') + 1);
        const fileExtension = filename.split('.').pop();
        const uniqueFilename = `${uuid.v4()}.${fileExtension}`;
        
        // Tải hình ảnh lên Firebase Storage
        const storage = getStorage();
        const storageRef = ref(storage, `group_images/${uniqueFilename}`);
        
        // Chuyển đổi URI thành blob
        const response = await fetch(uri);
        const blob = await response.blob();
        
        // Tải lên Firebase Storage
        const uploadTask = uploadBytes(storageRef, blob);
        await uploadTask;
        
        // Lấy URL tải xuống
        const downloadURL = await getDownloadURL(storageRef);
        
        // Lưu thông tin tin nhắn vào Firestore
        await addDoc(collection(db, MESSAGE_COLLECTION), {
          con_id: groupId,
          sender_id: currentUser.uid,
          content: filename,
          type: 'image',
          url: downloadURL,
          createdAt: Date.now(),
          timestamp: Date.now(),
          isRevoked: false,
          seen: false
        });
        
        setShowAttachmentMenu(false);
        console.log('Hình ảnh đã được tải lên thành công');
      }
    } catch (error) {
      console.error('Lỗi khi tải lên hình ảnh:', error);
      Alert.alert('Lỗi', 'Không thể tải lên hình ảnh. Vui lòng thử lại.');
    } finally {
      handleUploadEnd();
    }
  };

  // Hàm tải lên video
  const handleVideoPickerUpload = async () => {
    if (!groupId) {
      Alert.alert('Lỗi', 'Không thể xác định nhóm chat.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        handleUploadStart();
        const asset = result.assets[0];
        await processAndUploadVideo(asset);
        setShowAttachmentMenu(false);
      }
    } catch (error) {
      console.error('Lỗi khi chọn video:', error);
      Alert.alert('Lỗi', 'Không thể tải lên video. Vui lòng thử lại.');
      handleUploadEnd();
    }
  };

  // Hàm xử lý và tải lên video
  const processAndUploadVideo = async (asset) => {
    try {
      const uri = asset.uri;
      const filename = uri.substring(uri.lastIndexOf('/') + 1);
      const fileExtension = filename.split('.').pop();
      const uniqueFilename = `${uuid.v4()}.${fileExtension}`;
      
      // Tải video lên Firebase Storage
      const storage = getStorage();
      const storageRef = ref(storage, `group_videos/${uniqueFilename}`);
      
      // Chuyển đổi URI thành blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Tải lên Firebase Storage
      const uploadTask = uploadBytes(storageRef, blob);
      await uploadTask;
      
      // Lấy URL tải xuống
      const downloadURL = await getDownloadURL(storageRef);
      
      // Lưu thông tin tin nhắn vào Firestore
      await addDoc(collection(db, MESSAGE_COLLECTION), {
        con_id: groupId,
        sender_id: currentUser.uid,
        content: filename,
        type: 'video',
        url: downloadURL,
        createdAt: Date.now(),
        timestamp: Date.now(),
        isRevoked: false,
        seen: false
      });
      
      console.log('Video đã được tải lên thành công');
    } catch (error) {
      console.error('Lỗi khi tải lên video:', error);
      Alert.alert('Lỗi', 'Không thể tải lên video. Vui lòng thử lại.');
    } finally {
      handleUploadEnd();
    }
  };

  // Hàm tải lên tệp
  const handleFilePickerUpload = async () => {
    if (!groupId) {
      Alert.alert('Lỗi', 'Không thể xác định nhóm chat.');
      return;
    }

    try {
      // Sử dụng trình chọn tài liệu an toàn cho nền tảng
      const result = await pickDocument();

      if (result.canceled) {
        console.log('User cancelled file picker');
        return;
      }

      if (!result.assets || result.assets.length === 0) {
        console.log('No file selected');
        return;
      }

      const asset = result.assets[0];
      
      // Kiểm tra kích thước tệp (giới hạn 20MB)
      if (asset.size > 20 * 1024 * 1024) {
        Alert.alert('File quá lớn', 'Vui lòng chọn file nhỏ hơn 20MB.');
        return;
      }

      setIsUploading(true);
      handleUploadStart();
      
      // Giả lập cập nhật tiến trình
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress = Math.min(95, progress + 5);
        handleProgress(progress);
      }, 500);

      // Xác định phần mở rộng tệp
      const fileExtension = asset.name.split('.').pop() || '';
      const fileName = `${uuid.v4()}-${asset.name}`;
      const fileRef = ref(getStorage(), `group_files/${currentUser.uid}/${fileName}`);

      const responseBlob = await fetch(asset.uri);
      const blob = await responseBlob.blob();

      // Tải tệp lên Firebase Storage
      await uploadBytes(fileRef, blob);
      clearInterval(progressInterval);
      handleProgress(100);

      const downloadURL = await getDownloadURL(fileRef);

      // Thêm tin nhắn tệp vào Firestore
      await addDoc(collection(db, MESSAGE_COLLECTION), {
        con_id: groupId,
        sender_id: currentUser.uid,
        content: asset.name,
        type: 'file',
        url: downloadURL,
        createdAt: Date.now(),
        timestamp: Date.now(),
        isRevoked: false,
        seen: false
      });

      setShowAttachmentMenu(false);
      console.log('File uploaded successfully');
    } catch (error) {
      console.error('Error uploading file:', error);
      Alert.alert('Lỗi', 'Không thể tải lên file. Vui lòng thử lại.');
    } finally {
      setIsUploading(false);
      handleUploadEnd();
    }
  };

  // Hàm mở trình phát video
  const openVideoPlayer = (message) => {
    setSelectedVideo(message);
    setShowVideoPlayer(true);
  };
  
  // Hàm đóng trình phát video
  const closeVideoPlayer = () => {
    setShowVideoPlayer(false);
    setSelectedVideo(null);
  };

  // Hàm xóa tin nhắn
  const handleDeleteMessage = async (messageId) => {
    try {
      // Lấy dữ liệu tin nhắn hiện tại
      const messageDoc = await getDoc(doc(db, MESSAGE_COLLECTION, messageId));

      if (!messageDoc.exists()) {
        console.error('Không tìm thấy tin nhắn để xóa');
        Alert.alert('Lỗi', 'Không thể xóa tin nhắn. Vui lòng thử lại.');
        return;
      }

      const messageData = messageDoc.data();

      // Kiểm tra xem đã có mảng deletedFor chưa
      const deletedFor = messageData.deletedFor || [];

      // Kiểm tra xem người dùng hiện tại đã xóa tin nhắn này chưa
      if (deletedFor.includes(currentUser.uid)) {
        console.log('Tin nhắn này đã bị xóa từ trước');
        return;
      }

      // Thêm currentUserId vào mảng deletedFor
      deletedFor.push(currentUser.uid);

      // Cập nhật tin nhắn với mảng deletedFor mới
      await updateDoc(doc(db, MESSAGE_COLLECTION, messageId), {
        deletedFor: deletedFor,
        lastDeletedAt: new Date().getTime()
      });

      console.log('Đã xóa tin nhắn cho người dùng hiện tại');
    } catch (error) {
      console.error('Error deleting message:', error);
      Alert.alert('Lỗi', 'Không thể xóa tin nhắn. Vui lòng thử lại.');
    }
  };

  // Hàm thu hồi tin nhắn (chỉ thu hồi được tin nhắn của mình)
  const handleRevokeMessage = async (messageId) => {
    try {
      // Lấy dữ liệu tin nhắn hiện tại
      const messageDoc = await getDoc(doc(db, MESSAGE_COLLECTION, messageId));

      if (!messageDoc.exists()) {
        console.error('Không tìm thấy tin nhắn để thu hồi');
        Alert.alert('Lỗi', 'Không thể thu hồi tin nhắn. Vui lòng thử lại.');
        return;
      }

      // Kiểm tra xem người gửi có phải là người hiện tại không
      const messageData = messageDoc.data();
      if (messageData.sender_id !== currentUser.uid) {
        Alert.alert('Lỗi', 'Bạn chỉ có thể thu hồi tin nhắn của mình.');
        return;
      }

      // Cập nhật trạng thái tin nhắn thành đã thu hồi
      await updateDoc(doc(db, MESSAGE_COLLECTION, messageId), {
        revoked: true,
        revokedAt: new Date().getTime()
      });

      console.log('Đã thu hồi tin nhắn thành công');
    } catch (error) {
      console.error('Error revoking message:', error);
      Alert.alert('Lỗi', 'Không thể thu hồi tin nhắn. Vui lòng thử lại.');
    }
  };

  // Lấy danh sách tất cả các cuộc trò chuyện cho tính năng chuyển tiếp
  useEffect(() => {
    if (!currentUser || !currentUser.uid) return;
    
    const fetchConversations = async () => {
      try {
        const userConversationsQuery = query(
          collection(db, 'UserConversation'), 
          where('user_id', '==', currentUser.uid)
        );
        const userConversationsSnapshot = await getDocs(userConversationsQuery);
        
        const conversationsData = [];
        for (const docSnap of userConversationsSnapshot.docs) {
          const conId = docSnap.data().con_id;
          const conversationDoc = await getDoc(doc(db, 'Conversations', conId));
          
          if (conversationDoc.exists()) {
            const conData = conversationDoc.data();
            conversationsData.push({
              ...conData,
              con_id: conId
            });
          }
        }
        
        setConversations(conversationsData);
      } catch (error) {
        console.error('Error fetching conversations:', error);
      }
    };
    
    fetchConversations();
  }, [currentUser]);

  // Hàm mở modal chuyển tiếp tin nhắn
  const openForwardModal = useCallback((message) => {
    setForwardMessage(message);
    setShowForwardModal(true);
    setSelectedConversations([]);
  }, []);

  // Hàm xử lý trả lời tin nhắn
  const handleReplyToMessage = (message) => {
    setReplyToMessage(message);
    setShowMoreOptions(false);
  };

  // Hàm chọn/bỏ chọn cuộc trò chuyện để chuyển tiếp
  const toggleConversationSelection = useCallback((conversation) => {
    setSelectedConversations(prev => {
      const isSelected = prev.some(c => c.con_id === conversation.con_id);
      return isSelected
        ? prev.filter(c => c.con_id !== conversation.con_id)
        : [...prev, conversation];
    });
  }, []);

  // Hàm thực hiện việc chuyển tiếp tin nhắn
  const handleSendForwardMessage = useCallback(async () => {
    if (!forwardMessage || !selectedConversations.length) return;

    try {
      // Chuẩn bị dữ liệu tin nhắn dựa trên loại tin nhắn
      const messageData = {
        sender_id: currentUser.uid,
        content: forwardMessage.content,
        type: forwardMessage.type,
        createdAt: Date.now(),
        timestamp: Date.now(),
        isRevoked: false,
        seen: false
      };

      // Thêm URL nếu là hình ảnh, video hoặc file
      if (forwardMessage.type === 'image' || forwardMessage.type === 'video' || forwardMessage.type === 'file') {
        messageData.url = forwardMessage.url;
      }

      // Gửi tin nhắn đến tất cả các cuộc trò chuyện đã chọn
      await Promise.all(
        selectedConversations.map(conv =>
          addDoc(collection(db, MESSAGE_COLLECTION), {
            ...messageData,
            con_id: conv.con_id
          })
        )
      );
      setShowForwardModal(false);
      setForwardMessage(null);
      setSelectedConversations([]);
      Alert.alert('Thành công', 'Tin nhắn đã được chuyển tiếp');
    } catch (error) {
      console.error('Lỗi khi chuyển tiếp tin nhắn:', error);
      Alert.alert('Lỗi', 'Không thể chuyển tiếp tin nhắn. Vui lòng thử lại.');
    }
  }, [forwardMessage, selectedConversations, currentUser]);

    // Hàm lấy tên thành viên
  const getMemberName = (senderId) => {
    if (senderId === 'system') return 'Hệ thống';
    
    const member = members.find(m => m.id === senderId);
    return member ? (member.fullName || member.name || member.email) : 'Unknown';
  };

  // Hàm hiển thị từng tin nhắn
  const renderMessage = ({ item }) => {
    const isCurrentUser = item.sender_id === currentUser?.uid;
    const isSystem = item.sender_id === 'system';
    const senderName = isCurrentUser ? 'Bạn' : getMemberName(item.sender_id);
    
    // Format the timestamp to 12-hour format
    let timestamp = new Date(item.timestamp);
    let hours = timestamp.getHours();
    let minutes = timestamp.getMinutes();
    let ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? '0'+minutes : minutes;
    const time = hours + ':' + minutes + ' ' + ampm;

    if (isSystem) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.content}</Text>
          <View style={styles.statusContainer}>
            <Text style={styles.timestampText}>{time}</Text>
          </View>
        </View>
      );
    }

    // Nếu tin nhắn đã bị xóa bởi người dùng hiện tại, không hiển thị
    if (item.deletedFor?.includes(currentUser.uid)) {
      return null;
    }

    return (
      <View style={[styles.messageContainer, isCurrentUser ? styles.userMessageContainer : styles.friendMessageContainer]}>
        {!isCurrentUser && (
          <View style={styles.avatarContainer}>
            <Icon name="user-circle" size={36} color="#514869" />
            <Text style={styles.senderName} numberOfLines={1}>{senderName}</Text>
          </View>
        )}
        
        <View style={styles.messageContentContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            onLongPress={safeHandlePress(() => {
              setSelectedMessage(item);
              setShowMoreOptions(true);
            })}
          >
            <View style={[styles.messageBubble, isCurrentUser ? styles.userBubble : styles.friendBubble]}>
              {item.replyTo && (
                <View style={styles.replyContainer}>
                  <View style={styles.replyBar} />
                  <View style={styles.replyContent}>
                    <Text style={styles.replySender}>
                      {item.replyTo.sender_id === currentUser.uid ? "Bạn" : getMemberName(item.replyTo.sender_id)}
                    </Text>
                    {item.replyTo.type === 'text' ? (
                      <Text style={styles.replyText} numberOfLines={1}>
                        {item.replyTo.content}
                      </Text>
                    ) : item.replyTo.type === 'image' ? (
                      <Text style={styles.replyText}>Hình ảnh</Text>
                    ) : item.replyTo.type === 'video' ? (
                      <Text style={styles.replyText}>Video</Text>
                    ) : (
                      <Text style={styles.replyText}>Tệp đính kèm</Text>
                    )}
                  </View>
                </View>
              )}
              
              {item.revoked ? (
                <Text style={styles.revokedMessageText}>Tin nhắn đã bị thu hồi</Text>
              ) : (
                <>
                  {item.type === 'image' && <Image source={{ uri: item.url }} style={styles.image} />}
                  
                  {item.type === 'video' && (
                    <TouchableOpacity 
                      style={styles.videoContainer} 
                      onPress={safeHandlePress(() => openVideoPlayer(item))}
                    >
                      <View style={styles.videoPlaceholder}>
                        <Icon name="video-camera" size={40} color="#FFFFFF" />
                      </View>
                      <View style={styles.videoPlayButton}>
                        <Icon name="play" size={30} color="#FFFFFF" />
                      </View>
                      <Text style={styles.videoName} numberOfLines={1}>{item.content}</Text>
                      <Text style={styles.fileTypeLabel}>Video</Text>
                    </TouchableOpacity>
                  )}
                  
                  {item.type === 'file' && (
                      <View style={styles.fileContainer}>
                          <Icon name="file" size={24} color="#3f15d6" />
                            <Text style={styles.fileName} numberOfLines={1}>
                                  {item.content}
                            </Text>
                          <TouchableOpacity 
                              style={styles.downloadButton}
                                onPress={() => {
                                  // Xử lý tải xuống/xem tệp
                                  Linking.openURL(item.url);
                                   }}
                                      >
                                    <Icon name="download" size={18} color="#3f15d6" />
                          </TouchableOpacity>
                      </View>
                  )}
                  
                  {item.type === 'text' && <Text style={[styles.messageText, isCurrentUser && styles.userMessageText]}>{item.content}</Text>}
                </>
              )}
            </View>
          </TouchableOpacity>
          
          {/* Trạng thái bên dưới bong bóng tin nhắn */}
          {!item.revoked && !item.deletedFor?.includes(currentUser.uid) && (
            <View style={styles.statusContainer}>
              <Text style={styles.timestampText}>{time}</Text>
              {isCurrentUser && (
                <View style={styles.seenStatusContainer}>
                  {item.seen ? (
                    <FontAwesome5 name="check-double" size={14} color="#4080ff" />
                  ) : (
                    <FontAwesome5 name="check" size={14} color="#8e8e93" />
                  )}
                </View>
              )}
            </View>
          )}
        </View>

        {isCurrentUser && (
          <View style={styles.avatarContainer}>
            <Icon name="user-circle" size={36} color="#27548A" />
          </View>
        )}
      </View>
    );
  };

  // Animation update without useNativeDriver
  const fadeIn = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false, // Set to false to avoid native driver issues
    }).start();
  };

  const fadeOut = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false, // Set to false to avoid native driver issues
    }).start();
  };

  
//hàm thêm thành viên
  const handleAddMembersToGroup = useCallback(async () => {
    if (!groupId || !groupInfo || !groupInfo.is_group) return;
    
    setFriendSearch('');
    setSelectedFriends([]);
    setIsLoadingFriends(true);
    
    try {
      // Lấy danh sách thành viên hiện tại
      const existingMemberIds = groupInfo.members.map(member => 
        typeof member === 'object' ? member.user_id : member
      );
      
      // Lấy danh sách bạn bè
       const friendsQuery = query(
         collection(db, 'friend_requests'),
         where('status', '==', 'accepted'),
         where('from', '==', currentUser.uid)
       );
       const friendsQuery2 = query(
         collection(db, 'friend_requests'),
         where('status', '==', 'accepted'),
         where('to', '==', currentUser.uid)
       );
  
       const [fromSnap, toSnap] = await Promise.all([getDocs(friendsQuery), getDocs(friendsQuery2)]);
  
       const friendIds = new Set();
       fromSnap.forEach(doc => friendIds.add(doc.data().to));
       toSnap.forEach(doc => friendIds.add(doc.data().from));
  
       const allFriendsPromises = Array.from(friendIds).map(async uid => {
         const userQ = query(collection(db, 'Users'), where('user_id', '==', uid));
         const userSnap = await getDocs(userQ);
         return userSnap.docs[0]?.data();
       });
  
       const allFriends = (await Promise.all(allFriendsPromises)).filter(Boolean);
      
      // Lọc ra những bạn bè chưa có trong nhóm
      const availableFriendsToAdd = allFriends.filter(friend => 
        !existingMemberIds.includes(friend.user_id)
      );
      
      setAvailableFriends(availableFriendsToAdd);
      setShowAddMembersModal(true);
      setShowMembersModal(false); // Close view members modal if open
    } catch (error) {
      console.error('Lỗi khi lấy danh sách bạn bè:', error);
      Alert.alert('Lỗi', 'Không thể lấy danh sách bạn bè');
    }
    
    setIsLoadingFriends(false);
  }, [groupId, groupInfo, currentUser]);

  // Helper to check if a friend is selected
  const isFriendSelected = useCallback((friendId) => {
    return selectedFriends.some(friend => friend.user_id === friendId);
  }, [selectedFriends]);
  
  // Helper to toggle friend selection
  const toggleFriendSelection = useCallback((friend) => {
    setSelectedFriends(prev => {
      if (isFriendSelected(friend.user_id)) {
        return prev.filter(f => f.user_id !== friend.user_id);
      } else {
        return [...prev, friend];
      }
    });
  }, [isFriendSelected]);

  const confirmAddMembers = useCallback(async () => {
    if (!groupId || !groupInfo || !groupInfo.is_group || selectedFriends.length === 0) {
      return;
    }
    setIsAddingMembers(true);
    try {
      // Thêm từng thành viên bằng conversationApi.addMemberToGroup
      for (const friend of selectedFriends) {
        await conversationApi.addMemberToGroup(groupId, friend.user_id);
        // Gửi tin nhắn hệ thống sau khi thêm thành viên
        await addDoc(collection(db, MESSAGE_COLLECTION), {
          con_id: groupId,
          content: `${friend.fullName || friend.name || 'Một thành viên mới'} đã được thêm vào nhóm`,
          sender_id: "system",
          type: "system",
          createdAt: Date.now(),
          timestamp: Date.now(),
          isRevoked: false,
          seen: false
        });
      }
      setShowAddMembersModal(false);
      setSelectedFriends([]);
      Alert.alert('Thành công', 'Đã thêm thành viên vào nhóm');
    } catch (error) {
      console.error('Lỗi khi thêm thành viên:', error);
      Alert.alert('Lỗi', 'Không thể thêm thành viên. Vui lòng thử lại.');
    }
    setIsAddingMembers(false);
  }, [groupId, groupInfo, selectedFriends]);

 

  return (
    <Provider>
      <StatusBar barStyle="light-content" backgroundColor="#27548A" />
      <View style={styles.container}>
        {/* Custom Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerInfo}>
              <Text style={styles.groupName}>{groupInfo?.name || groupName || 'Nhóm chat'}</Text>
              <View style={styles.memberInfoContainer}>
                <Icon name="users" size={14} color="#e0e0e0" />
                <Text style={styles.memberCount}>
                  {groupInfo?.members?.length || 0} thành viên
                </Text>
              </View>
            </View>
          </View>

          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                icon="dots-vertical"
                iconColor="white"
                size={24}
                onPress={safeHandlePress(() => setMenuVisible(true))}
              />
            }
          >
            {/* Menu hiển thị chức năng của nhóm*/}
            <Menu.Item onPress={safeHandlePress(() => setShowMembersModal(true))} title="👥 Xem thành viên" />
            <Menu.Item onPress={safeHandlePress(handleAddMembersToGroup)} title="➕ Thêm thành viên" />
            <Menu.Item onPress={safeHandlePress(() => setShowRemoveMembersModal(true))} title="➖ Xóa thành viên" />
            {currentUser?.uid === groupInfo?.admin && (
              <Menu.Item onPress={safeHandlePress(deleteGroup)} title="🗑️ Xóa nhóm" titleStyle={{ color: 'red' }} />
            )}
            {currentUser?.uid === groupInfo?.admin && (
              <Menu.Item onPress={safeHandlePress(() => console.log('👑 Chuyển quyền'))} title="👑 Chuyển quyền trưởng nhóm" />
            )}
            <Menu.Item onPress={safeHandlePress(() => {
              console.log('🗑️ Đã xoá tin nhắn');
            })} title="🗑️ Xoá lịch sử trò chuyện" titleStyle={{ color: 'red' }} />
            <Menu.Item onPress={safeHandlePress(leaveGroup)} title="🚪 Rời nhóm" titleStyle={{ color: 'red' }} />
          </Menu>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#27548A" />
            <Text style={styles.loadingText}>Đang tải tin nhắn...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
          />
        )}

        {/* Hiển thị phần trả lời tin nhắn nếu có */}
        {replyToMessage && (
          <View style={styles.replyPreviewContainer}>
            <View style={styles.replyPreviewContent}>
              <View style={styles.replyPreviewBar} />
              <View style={styles.replyPreviewMessageContainer}>
                <Text style={styles.replyPreviewSender}>
                  {replyToMessage.sender_id === currentUser.uid ? "Bạn" : getMemberName(replyToMessage.sender_id)}
                </Text>
                {replyToMessage.type === 'text' ? (
                  <Text style={styles.replyPreviewText} numberOfLines={1}>
                    {replyToMessage.content}
                  </Text>
                ) : replyToMessage.type === 'image' ? (
                  <View style={styles.replyPreviewMediaContainer}>
                    <Icon name="image" size={14} color="#666" />
                    <Text style={styles.replyPreviewMediaText}>Hình ảnh</Text>
                  </View>
                ) : replyToMessage.type === 'video' ? (
                  <View style={styles.replyPreviewMediaContainer}>
                    <Icon name="video-camera" size={14} color="#666" />
                    <Text style={styles.replyPreviewMediaText}>Video</Text>
                  </View>
                ) : (
                  <View style={styles.replyPreviewMediaContainer}>
                    <Icon name="file" size={14} color="#666" />
                    <Text style={styles.replyPreviewMediaText}>Tệp đính kèm</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity 
                style={styles.replyPreviewCloseButton}
                onPress={safeHandlePress(() => setReplyToMessage(null))}
              >
                <Icon name="close" size={16} color="#666" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Input */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.inputIconButton} onPress={safeHandlePress(() => setShowEmojiPicker(!showEmojiPicker))}>
              <Icon name="smile-o" size={22} color="#27548A" />
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Nhập tin nhắn..."
              placeholderTextColor="#a0a0a0"
              multiline
            />

            <TouchableOpacity style={styles.inputIconButton} onPress={safeHandlePress(() => setShowAttachmentMenu(true))}>
              <Icon name="paperclip" size={22} color="#27548A" />
            </TouchableOpacity>

            <TouchableOpacity onPress={safeHandlePress(sendMessage)} style={styles.sendButton}>
              <Icon name="send" size={18} color="white" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Emoji */}
        {showEmojiPicker && (
          <View style={styles.emojiPickerContainer}>
            <Picker onSelect={handleEmojiClick} theme="light" />
          </View>
        )}

        {/* Attachment */}
        <AttachmentMenu
          isVisible={showAttachmentMenu}
          onClose={safeHandlePress(() => setShowAttachmentMenu(false))}
          onSelectImage={uploadImage}
          onSelectVideo={handleVideoPickerUpload}
          onSelectFile={handleFilePickerUpload}
        />

        {/* Menu tùy chọn khi nhấn giữ tin nhắn */}
        {showMoreOptions && selectedMessage && (
          <Modal
            visible={showMoreOptions}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowMoreOptions(false)}
          >
            <TouchableOpacity 
              style={styles.modalOverlay} 
              activeOpacity={1} 
              onPress={safeHandlePress(() => setShowMoreOptions(false))}
            >
              <View style={styles.moreOptionsContent}>
                <TouchableOpacity 
                  style={styles.moreOption} 
                  onPress={safeHandlePress(() => { 
                    handleReplyToMessage(selectedMessage); 
                    setShowMoreOptions(false); 
                  })}
                >
                  <Icon name="reply" size={18} color="#4CAF50" />
                  <Text style={[styles.moreOptionText, styles.replyOptionText]}>Trả Lời</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.moreOption} 
                  onPress={safeHandlePress(() => { 
                    openForwardModal(selectedMessage); 
                    setShowMoreOptions(false); 
                  })}
                >
                  <Icon name="share" size={18} color="#27548A" />
                  <Text style={[styles.moreOptionText, styles.forwardText]}>Chuyển Tiếp</Text>
                </TouchableOpacity>
                
                {selectedMessage.sender_id === currentUser.uid && (
                  <>
                    <TouchableOpacity 
                      style={styles.moreOption} 
                      onPress={safeHandlePress(() => { 
                        handleRevokeMessage(selectedMessage.id);
                        setShowMoreOptions(false); 
                      })}
                    >
                      <Icon name="undo" size={18} color="#ff3b30" />
                      <Text style={[styles.moreOptionText, styles.recallText]}>Thu Hồi</Text>
                    </TouchableOpacity>
                  </>
                )}
                
                <TouchableOpacity 
                  style={styles.moreOption} 
                  onPress={safeHandlePress(() => { 
                    handleDeleteMessage(selectedMessage.id); 
                    setShowMoreOptions(false); 
                  })}
                >
                  <Icon name="trash" size={18} color="#8e8e93" />
                  <Text style={styles.moreOptionText}>Xóa tin nhắn</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        {/* Modal chuyển tiếp tin nhắn */}
        {showForwardModal && (
          <Modal
            visible={showForwardModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowForwardModal(false)}
          >
            <View style={styles.forwardModalContainer}>
              <View style={styles.forwardModalHeader}>
                <Text style={styles.forwardModalTitle}>Chuyển tiếp tin nhắn</Text>
                <TouchableOpacity onPress={safeHandlePress(() => setShowForwardModal(false))}>
                  <Icon name="close" size={24} color="#000" />
                </TouchableOpacity>
              </View>
              
              {/* Xem trước tin nhắn đang chuyển tiếp */}
              <View style={styles.forwardPreviewContainer}>
                {forwardMessage?.type === 'image' ? (
                  <Image 
                    source={{ uri: forwardMessage.url }} 
                    style={styles.forwardImagePreview}
                  />
                ) : forwardMessage?.type === 'video' ? (
                  <View style={styles.forwardVideoPreview}>
                    <Icon name="video-camera" size={24} color="#666" />
                    <Text style={styles.forwardTextPreview} numberOfLines={2}>
                      Video: {forwardMessage?.content}
                    </Text>
                  </View>
                ) : forwardMessage?.type === 'file' ? (
                  <View style={styles.forwardFilePreview}>
                    <Icon name="file" size={24} color="#666" />
                    <Text style={styles.forwardTextPreview} numberOfLines={2}>
                      Tệp: {forwardMessage?.content}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.forwardTextPreview} numberOfLines={2}>
                    {forwardMessage?.content}
                  </Text>
                )}
              </View>
              
              <Text style={styles.forwardInstructionText}>Chọn cuộc trò chuyện để chuyển tiếp:</Text>
              
              {/* Danh sách cuộc trò chuyện */}
              <FlatList
                data={conversations}
                keyExtractor={(item) => item.con_id || Math.random().toString()}
                style={styles.conversationsList}
                renderItem={({ item }) => {
                  // Bỏ qua cuộc trò chuyện hiện tại
                  if (item.con_id === groupId) return null;
                  
                  const isSelected = selectedConversations.some(c => c.con_id === item.con_id);
                  return (
                    <TouchableOpacity 
                      style={[
                        styles.conversationItem,
                        isSelected && styles.selectedConversationItem
                      ]}
                      onPress={safeHandlePress(() => toggleConversationSelection(item))}
                      key={item.con_id}
                    >
                      <Icon name={item.is_group ? "users" : "user"} size={24} color="#514869" />
                      <Text style={styles.conversationName}>
                        {item.name || 'Chat'}
                        {item.is_group ? ' (Nhóm)' : ''}
                      </Text>
                      {isSelected && (
                        <FontAwesome5 name="check-circle" size={24} color="#27548A" />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
              
              <TouchableOpacity 
                style={[
                  styles.forwardButton,
                  selectedConversations.length === 0 && styles.disabledButton
                ]}
                disabled={selectedConversations.length === 0}
                onPress={safeHandlePress(handleSendForwardMessage)}
              >
                <Text style={styles.forwardButtonText}>
                  Chuyển tiếp đến {selectedConversations.length} cuộc trò chuyện
                </Text>
              </TouchableOpacity>
            </View>
          </Modal>
        )}

        {/* Trình phát video */}
        {showVideoPlayer && selectedVideo && (
          <Modal
            visible={showVideoPlayer}
            transparent={true}
            animationType="fade"
            onRequestClose={closeVideoPlayer}
          >
            <View style={styles.videoPlayerContainer}>
              <View style={styles.videoPlayerHeader}>
                <TouchableOpacity onPress={closeVideoPlayer} style={styles.closeVideoButton}>
                  <Icon name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <VideoPlayer 
                message={selectedVideo}
                handleOpenFile={(url) => Linking.openURL(url)}
              />
            </View>
          </Modal>
        )}

        {/* Hiển thị tiến trình tải lên */}
        {isUploading && (
          <View style={styles.progressOverlay}>
            <View style={styles.progressContainer}>
              <ActivityIndicator size="large" color="#3f15d6" />
              <Text style={styles.progressText}>Đang tải lên... {uploadProgress}%</Text>
            </View>
          </View>
        )}

        {/* Modal hiển thị danh sách thành viên (chỉ xem, không có nút xóa) */}
        <Modal
          visible={showMembersModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowMembersModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPressOut={() => setShowMembersModal(false)}
          >
            <View style={styles.membersModalContent}>
              <Text style={styles.membersModalTitle}>Danh sách thành viên</Text>
              {members.length > 0 ? (
                <FlatList
                  data={members}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => (
                    <View style={styles.memberItem}>
                      <View style={styles.avatarCircle}>
                        {item.avatar ? (
                          <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
                        ) : (
                          <Icon name="user-circle" size={30} color="#ccc" />
                        )}
                      </View>
                      <Text style={styles.memberName}>
                        {item.fullName || item.name || item.email}
                        {item.id === groupInfo?.admin && (
                          <Text style={styles.adminText}> (Trưởng nhóm)</Text>
                        )}
                      </Text>
                    </View>
                  )}
                />
              ) : (
                <Text style={styles.emptyMembersText}>Không có thành viên nào.</Text>
              )}
              <TouchableOpacity
                style={styles.closeMembersModalButton}
                onPress={() => setShowMembersModal(false)}
              >
                <Text style={styles.closeMembersModalButtonText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Modal thêm thành viên */}
        <Modal
          visible={showAddMembersModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowAddMembersModal(false)}
        >
          <View style={styles.addMembersModalContainer}>
            <View style={styles.addMembersModalHeader}>
              <Text style={styles.addMembersModalTitle}>Thêm thành viên vào nhóm</Text>
              <TouchableOpacity onPress={safeHandlePress(() => setShowAddMembersModal(false))}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.friendSearchInput}
              placeholder="Tìm bạn bè..."
              placeholderTextColor="#a0a0a0"
              value={friendSearch}
              onChangeText={setFriendSearch}
            />

            {isLoadingFriends ? (
              <ActivityIndicator size="small" color="#27548A" style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={availableFriends.filter(friend => 
                  friend.fullName?.toLowerCase().includes(friendSearch.toLowerCase()) ||
                  friend.name?.toLowerCase().includes(friendSearch.toLowerCase()) ||
                  friend.email?.toLowerCase().includes(friendSearch.toLowerCase())
                )}
                keyExtractor={(item) => item.user_id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.addMemberItem}
                    onPress={safeHandlePress(() => toggleFriendSelection(item))}
                  >
                    <View style={styles.avatarCircleSmall}>
                      {item.avatar ? (
                        <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
                      ) : (
                        <Icon name="user-circle" size={24} color="#ccc" />
                      )}
                    </View>
                    <Text style={styles.addMemberName}>{item.fullName || item.name || item.email}</Text>
                    {isFriendSelected(item.user_id) && (
                      <Ionicons name="checkbox" size={24} color="#27548A" />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.emptyFriendsText}>Không tìm thấy bạn bè phù hợp.</Text>}
              />
            )}

            <TouchableOpacity
              style={[styles.addMembersButton, selectedFriends.length === 0 && styles.disabledButton]}
              onPress={safeHandlePress(confirmAddMembers)}
              disabled={selectedFriends.length === 0 || isAddingMembers}
            >
              <Text style={styles.addMembersButtonText}>
                {isAddingMembers ? 'Đang thêm...' : `Thêm ${selectedFriends.length} thành viên`}
              </Text>
            </TouchableOpacity>
          </View>
        </Modal>

        {/* Modal xóa thành viên */}
        <Modal
          visible={showRemoveMembersModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowRemoveMembersModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPressOut={() => setShowRemoveMembersModal(false)}
          >
            <View style={styles.membersModalContent}>
              <Text style={styles.membersModalTitle}>Xóa thành viên khỏi nhóm</Text>
              {members.length > 0 ? (
                <FlatList
                  data={members}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => (
                    <View style={styles.memberItem}>
                      <View style={styles.avatarCircle}>
                        {item.avatar ? (
                          <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
                        ) : (
                          <Icon name="user-circle" size={30} color="#ccc" />
                        )}
                      </View>
                      <Text style={styles.memberName}>
                        {item.fullName || item.name || item.email}
                        {item.id === groupInfo?.admin && (
                          <Text style={styles.adminText}> (Trưởng nhóm)</Text>
                        )}
                      </Text>
                      {/* Nút xóa thành viên chỉ hiển thị cho admin, không cho phép xóa chính mình hoặc admin */}
                      {currentUser?.uid === groupInfo?.admin && item.id !== groupInfo?.admin && item.id !== currentUser?.uid && (
                        <TouchableOpacity
                          style={{ marginLeft: 8, padding: 6 }}
                          onPress={safeHandlePress(() => removeMemberFromGroup(item.id))}
                        >
                          <Icon name="user-times" size={22} color="#ff3b30" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                />
              ) : (
                <Text style={styles.emptyMembersText}>Không có thành viên nào.</Text>
              )}
              <TouchableOpacity
                style={styles.closeMembersModalButton}
                onPress={() => setShowRemoveMembersModal(false)}
              >
                <Text style={styles.closeMembersModalButtonText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {showDeleteGroupModal && (
          <Modal
            visible={showDeleteGroupModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowDeleteGroupModal(false)}
          >
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, width: 320, alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#d32f2f' }}>Xác nhận xóa nhóm</Text>
                <Text style={{ fontSize: 15, color: '#333', marginBottom: 24, textAlign: 'center' }}>
                  Bạn có chắc chắn muốn xóa nhóm này? Hành động này không thể hoàn tác!
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                  <TouchableOpacity
                    style={{ flex: 1, padding: 12, backgroundColor: '#eee', borderRadius: 8, marginRight: 8, alignItems: 'center' }}
                    onPress={() => { setShowDeleteGroupModal(false); }}
                  >
                    <Text style={{ color: '#333', fontWeight: 'bold' }}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, padding: 12, backgroundColor: '#d32f2f', borderRadius: 8, alignItems: 'center' }}
                    onPress={async () => {
                      setShowDeleteGroupModal(false);
                      console.log('Đã bấm xác nhận xóa nhóm');
                      await handleDeleteGroupConfirmed();
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Xóa</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#27548A',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    elevation: 3,
    shadowColor: '#27548A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerInfo: {
    flexDirection: 'column',
    justifyContent: 'center',
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  memberInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  memberCount: {
    fontSize: 13,
    color: '#e0e0e0',
    marginLeft: 6,
  },
  messagesList: {
    padding: 12,
    paddingBottom: 20,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingHorizontal: 10,
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  friendMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    alignItems: 'center',
    marginHorizontal: 6,
    width: 32,
  },
  senderName: {
    fontSize: 11,
    color: '#666',
    marginTop: 3,
    maxWidth: 40,
    textAlign: 'center',
  },
  messageContentContainer: {
    maxWidth: '70%',
  },
  messageBubble: {
    borderRadius: 18,
    padding: 10,
    maxWidth: '100%',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  userBubble: {
    backgroundColor: '#27548A',
    borderBottomRightRadius: 4,
    marginLeft: 5,
  },
  friendBubble: {
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
    marginRight: 5,
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  userMessageText: {
    color: 'white',
  },
  timestampText: {
    fontSize: 10,
    color: '#999',
    fontWeight: '400',
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 16,
  },
  systemMessageText: {
    fontSize: 13,
    color: '#808080',
    fontStyle: 'italic',
    backgroundColor: '#f0f0f0',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    overflow: 'hidden',
  },
  revokedMessageText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
  
  // Reply styles
  replyContainer: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    paddingLeft: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 8,
    padding: 6,
  },
  replyBar: {
    width: 3,
    backgroundColor: '#4CAF50',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  replyContent: {
    flex: 1,
  },
  replySender: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  replyText: {
    fontSize: 12,
    color: '#666',
  },
  replyPreviewContainer: {
    backgroundColor: '#f0f2f5',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 10,
  },
  replyPreviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyPreviewBar: {
    width: 4,
    height: '100%',
    backgroundColor: '#4CAF50',
    marginRight: 10,
    borderRadius: 2,
  },
  replyPreviewMessageContainer: {
    flex: 1,
  },
  replyPreviewSender: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  replyPreviewText: {
    fontSize: 12,
    color: '#666',
  },
  replyPreviewMediaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyPreviewMediaText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },
  replyPreviewCloseButton: {
    padding: 8,
  },
  
  // More options modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreOptionsContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '80%',
    padding: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  moreOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  moreOptionText: {
    fontSize: 16,
    marginLeft: 15,
    color: '#333',
  },
  replyOptionText: {
    color: '#4CAF50',
  },
  forwardText: {
    color: '#27548A',
  },
  recallText: {
    color: '#ff3b30',
  },
  
  // Forward modal styles
  forwardModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  forwardModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    backgroundColor: '#f9f9f9',
  },
  forwardModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  forwardPreviewContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    backgroundColor: '#f9f9f9',
  },
  forwardImagePreview: {
    width: 180,
    height: 180,
    borderRadius: 12,
    alignSelf: 'center',
  },
  forwardVideoPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f2f2f2',
    borderRadius: 12,
    marginVertical: 8,
  },
  forwardFilePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f2f2f2',
    borderRadius: 12,
    marginVertical: 8,
  },
  forwardTextPreview: {
    fontSize: 16,
    color: '#333',
    padding: 8,
    backgroundColor: '#f2f2f2',
    borderRadius: 12,
    marginVertical: 8,
  },
  forwardInstructionText: {
    fontSize: 14,
    color: '#666',
    marginVertical: 12,
    marginHorizontal: 16,
  },
  conversationsList: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedConversationItem: {
    backgroundColor: 'rgba(63, 21, 214, 0.1)',
  },
  conversationName: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
    color: '#333',
  },
  forwardButton: {
    backgroundColor: '#27548A',
    padding: 15,
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#27548A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  forwardButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#d3d3d3',
  },
  
  // Video player modal styles
  videoPlayerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoPlayerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 12,
    marginTop: Platform.OS === 'ios' ? 40 : 12,
  },
  closeVideoButton: {
    padding: 10,
  },
  
  // Input styles
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  inputIconButton: {
    padding: 6,
  },
  input: {
    flex: 1,
    height: 36,
    borderWidth: 0,
    padding: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    fontSize: 14,
    borderRadius: 18,
    marginHorizontal: 8,
    color: '#333',
  },
  sendButton: {
    backgroundColor: '#27548A',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  emojiPickerContainer: {
    height: 250,
  },
  
  // Loading and progress styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#27548A',
    fontSize: 16,
  },
  progressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 220,
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
    color: '#27548A',
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 16,
  },
  videoContainer: {
    width: 200,
    height: 150,
    borderRadius: 16,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  videoPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  videoPlayButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  videoName: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    color: '#FFF',
    fontSize: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  fileTypeLabel: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    color: '#FFF',
    fontSize: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(39, 84, 138, 0.08)',
    borderRadius: 16,
    padding: 12,
    marginVertical: 2,
  },
  fileName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
    fontWeight: '500',
  },
  downloadButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(39, 84, 138, 0.1)',
  },
  bottomToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
    backgroundColor: '#fff',
  },
  toolbarButton: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  toolbarButtonText: {
    fontSize: 12,
    color: '#666',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginRight: 6,
    alignSelf: 'flex-end',
  },
  seenStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  membersModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    minWidth: 300,
    maxHeight: '70%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  membersModalTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  memberName: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
    flex: 1, // Allow name to take up space
  },
  adminText: {
    color: '#e6b800',
    fontWeight: 'bold',
    fontSize: 14, // Slightly smaller for distinction
  },
  emptyMembersText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 10,
    marginBottom: 10,
  },
  closeMembersModalButton: {
    marginTop: 20,
    alignSelf: 'flex-end', // Align to the right
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  closeMembersModalButtonText: {
    color: '#27548A',
    fontWeight: 'bold',
    fontSize: 15,
  },
  addMembersModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 40 : 16,
  },
  addMembersModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  addMembersModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  friendSearchInput: {
    fontSize: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 12,
    color: '#333',
  },
  addMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarCircleSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: 12,
  },
  addMemberName: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  emptyFriendsText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
  },
  addMembersButton: {
    backgroundColor: '#27548A',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  addMembersButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});