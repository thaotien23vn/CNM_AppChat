import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Image, Animated, Alert, Modal, ActivityIndicator, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/FontAwesome';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../Firebase/Firebase';
import { collection, addDoc, onSnapshot, query, doc, setDoc, getDocs, where, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import uuid from 'react-native-uuid';
import moment from 'moment';
import { Picker } from 'emoji-mart-native';
import * as ImagePicker from 'expo-image-picker';
import FilePicker from '../components/FilePicker';
import AttachmentMenu from '../components/AttachmentMenu';
import VideoPlayer from '../components/RenderFileMessage';
import { pickDocument } from '../utils/platformUtils';
import RenderFileMessage from '../components/RenderFileMessage';

const MESSAGE_COLLECTION = 'Messages';

export default function ChatsScreen({ route }) {
    const { currentUserId, chatWithUserId } = route?.params || {};
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [conversationId, setConversationId] = useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [forwardMessage, setForwardMessage] = useState(null);
    const [showMoreOptions, setShowMoreOptions] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [selectedConversations, setSelectedConversations] = useState([]);
    const [conversations, setConversations] = useState([]);
    const flatListRef = useRef(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [showVideoPlayer, setShowVideoPlayer] = useState(false);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [selectedVideoUrl, setSelectedVideoUrl] = useState(null);
    const [replyToMessage, setReplyToMessage] = useState(null);
    const [chatUser, setChatUser] = useState(null);
    const [currentUserInfo, setCurrentUserInfo] = useState(null);
    const [userCache, setUserCache] = useState({});

    // Hàm theo dõi tiến trình tải lên
    const handleProgress = (progress) => {
        setUploadProgress(progress);
    };

    // Hàm bắt đầu tải lên video
    const handleVideoUploadStart = () => {
        setIsUploading(true);
    };

    // Hàm kết thúc tải lên video
    const handleVideoUploadEnd = () => {
        setIsUploading(false);
        setUploadProgress(0);
    };

    // Hàm bắt đầu tải lên tệp
    const handleFileUploadStart = () => {
        setIsUploading(true);
    };

    // Hàm kết thúc tải lên tệp
    const handleFileUploadEnd = () => {
        setIsUploading(false);
        setUploadProgress(0);
    };
    useEffect(() => {
      const findOrCreateConversation = async () => {
          // Kiểm tra xem hai ID người dùng đã được định nghĩa chưa trước khi tiếp tục
          if (!currentUserId || !chatWithUserId) {
              console.log('Missing user IDs, cannot create conversation');
              return;
          }
          
          // Tìm kiếm cuộc trò chuyện hiện có giữa hai người dùng
          const q = query(collection(db, 'UserConversation'), where('user_id', '==', currentUserId));
          const snapshot = await getDocs(q);
          let found = null;
          for (const docSnap of snapshot.docs) {
              const con_id = docSnap.data().con_id;
              const checkQ = query(collection(db, 'UserConversation'), where('con_id', '==', con_id), where('user_id', '==', chatWithUserId));
              const checkSnap = await getDocs(checkQ);
              if (!checkSnap.empty) {
                  found = con_id;
                  break;
              }
          }
          // Nếu không tìm thấy cuộc trò chuyện, tạo mới
          if (!found) {
              const newConId = `con_${uuid.v4()}`;
              await addDoc(collection(db, 'UserConversation'), { con_id: newConId, user_id: currentUserId });
              await addDoc(collection(db, 'UserConversation'), { con_id: newConId, user_id: chatWithUserId });
              await setDoc(doc(db, 'Conversations', newConId), {
                  con_id: newConId,
                  admin: currentUserId,
                  is_group: false,
                  members: [currentUserId, chatWithUserId],
                  mess_info: [],
                  name: '',
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
      // Lắng nghe sự thay đổi tin nhắn từ Firestore
      const q = query(collection(db, MESSAGE_COLLECTION), where('con_id', '==', conversationId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // Sắp xếp tin nhắn theo thời gian tạo
          const sorted = msgs.sort((a, b) => a.createdAt - b.createdAt);
          setMessages(sorted);
          
          // Đánh dấu tin nhắn từ người dùng khác là đã xem
          markMessagesAsSeen(sorted);
          
          // Hiệu ứng mờ dần cho mỗi tin nhắn mới
          Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
          setTimeout(() => {
              if (flatListRef.current) {
                  flatListRef.current.scrollToEnd({ animated: true });
              }
          }, 100);
      });
      return () => unsubscribe();
  }, [conversationId]);

  // Hàm đánh dấu các tin nhắn là đã xem
  const markMessagesAsSeen = async (messages) => {
      if (!conversationId || !currentUserId || !chatWithUserId) return;
      
      // Lấy các tin nhắn từ người dùng khác mà chưa được xem
      const unseenMessages = messages.filter(
          msg => msg.sender_id === chatWithUserId && !msg.seen
      );
      
      // Cập nhật từng tin nhắn để đánh dấu là đã xem
      for (const message of unseenMessages) {
          try {
              await updateDoc(doc(db, MESSAGE_COLLECTION, message.id), {
                  seen: true,
                  seenAt: Date.now(),
                  seenBy: currentUserId
              });
          } catch (error) {
              console.error('Error marking message as seen:', error);
          }
      }
  };

  // Hàm gửi tin nhắn văn bản
  const sendMessage = async () => {
      if (inputText.trim() && conversationId) {
          const messageData = {
              con_id: conversationId,
              sender_id: currentUserId,
              content: inputText,
              type: 'text',
              createdAt: Date.now(),
              timestamp: Date.now(),
              isRevoked: false,
              seen: false
          };
          
          // Thêm thông tin trả lời nếu đang trả lời một tin nhắn
          if (replyToMessage) {
              messageData.replyTo = {
                  id: replyToMessage.id,
                  content: replyToMessage.content,
                  type: replyToMessage.type,
                  sender_id: replyToMessage.sender_id
              };
          }
          
          await addDoc(collection(db, MESSAGE_COLLECTION), messageData);
          setInputText('');
          setReplyToMessage(null); // Xóa tin nhắn trả lời sau khi gửi
      }
  };
    // Hàm bắt/tắt menu đính kèm
    const toggleAttachmentMenu = () => {
        setShowAttachmentMenu(!showAttachmentMenu);
    };

    // Hàm tải lên hình ảnh
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

    // Hàm xử lý khi chọn emoji để thêm vào tin nhắn
    const handleEmojiClick = (emoji) => {
        if (emoji?.native) {
            setInputText(prev => prev + emoji.native);
            setShowEmojiPicker(false);
        }
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
            if (deletedFor.includes(currentUserId)) {
                console.log('Tin nhắn này đã bị xóa từ trước');
                return;
            }

            // Thêm currentUserId vào mảng deletedFor
            deletedFor.push(currentUserId);

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
            if (messageData.sender_id !== currentUserId) {
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
        if (!currentUserId) return;
        
        const fetchConversations = async () => {
            try {
                const userConversationsQuery = query(
                    collection(db, 'UserConversation'), 
                    where('user_id', '==', currentUserId)
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
    }, [currentUserId]);

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
                sender_id: currentUserId,
                content: forwardMessage.content,
                type: forwardMessage.type === 'image' || forwardMessage.type === 'video'
                    ? forwardMessage.type
                    : 'text',
                createdAt: Date.now(),
                timestamp: Date.now(),
                isRevoked: false,
                seen: false
            };

            // Thêm URL nếu là hình ảnh hoặc video
            if (forwardMessage.type === 'image' || forwardMessage.type === 'video') {
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
    }, [forwardMessage, selectedConversations, currentUserId]);

    // Hàm tải lên video
    const handleVideoPickerUpload = async () => {
        if (!conversationId) {
            Alert.alert('Lỗi', 'Không thể xác định cuộc trò chuyện.');
            return;
        }

        try {
            // Thông báo cho người dùng biết đang bắt đầu quá trình
            console.log('Starting video upload process');
            
            // Kiểm tra quyền truy cập thư viện ảnh/video
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Cần quyền truy cập', 'Ứng dụng cần quyền truy cập thư viện ảnh/video để tải lên video.');
                console.log('Permission denied for media library');
                return;
            }
            
            console.log('Media library permission granted');

            const options = {
                mediaType: 'video',
                quality: 0.8,
                selectionLimit: 1,
                includeBase64: false,
            };

            console.log('Setting upload state and showing progress indicator');
            handleVideoUploadStart();

            console.log('Launching image library with options:', options);
            
            // Sử dụng cách thay thế nếu launchImageLibrary không hoạt động
            try {
                // Thử với ImagePicker của Expo trước
                console.log('Trying with Expo ImagePicker');
                const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                    quality: 0.8,
                    allowsMultipleSelection: false
                });
                
                console.log('Expo ImagePicker result:', result);
                
                if (result.canceled) {
                    console.log('User cancelled video picker (Expo)');
                    handleVideoUploadEnd();
                    return;
                }
                
                if (!result.assets || result.assets.length === 0) {
                    console.log('No video selected (Expo)');
                    handleVideoUploadEnd();
                    return;
                }
                
                const asset = result.assets[0];
                await processAndUploadVideo(asset);
                
            } catch (expoError) {
                console.error('Error with Expo ImagePicker, falling back to react-native-image-picker:', expoError);
                
                // Fall back to react-native-image-picker
                try {
                    const result = await new Promise((resolve) => {
                        launchImageLibrary(options, (response) => {
                            console.log('Image library response:', response);
                            resolve(response);
                        });
                    });
                    
                    if (result.didCancel) {
                        console.log('User cancelled video picker');
                        handleVideoUploadEnd();
                        return;
                    }
                    
                    if (!result.assets || result.assets.length === 0) {
                        console.log('No video selected');
                        handleVideoUploadEnd();
                        return;
                    }
                    
                    const asset = result.assets[0];
                    await processAndUploadVideo(asset);
                    
                } catch (rnImagePickerError) {
                    console.error('Error with react-native-image-picker:', rnImagePickerError);
                    Alert.alert('Lỗi', 'Không thể chọn video. Vui lòng thử lại.');
                    handleVideoUploadEnd();
                }
            }
        } catch (error) {
            console.error('Error in handleVideoPickerUpload:', error);
            Alert.alert('Lỗi', 'Không thể chọn video. Vui lòng thử lại.');
            handleVideoUploadEnd();
        }
    };
    
    // Hàm xử lý và tải lên video sau khi đã chọn
    const processAndUploadVideo = async (asset) => {
        try {
            console.log('Processing selected video:', asset);
            
            // Kiểm tra kích thước tệp (giới hạn 50MB cho video)
            const maxSize = 50 * 1024 * 1024;
            const fileSize = asset.fileSize || asset.size || 0;
            
            console.log('File size:', fileSize);
            
            if (fileSize > maxSize) {
                Alert.alert(
                    'File quá lớn', 
                    'Vui lòng chọn video nhỏ hơn 50MB.'
                );
                handleVideoUploadEnd();
                return;
            }
            
            // Cập nhật giao diện tiến trình
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress = Math.min(95, progress + 5);
                handleProgress(progress);
            }, 500);

            try {
                // Lấy thông tin tệp
                const uri = asset.uri;
                console.log('Video URI:', uri);
                
                const fileName = asset.fileName || `video_${Date.now()}.mp4`;
                const fileExtension = fileName.split('.').pop().toLowerCase() || 'mp4';
                const storagePath = `video_${Date.now()}_${uuid.v4()}.${fileExtension}`;
                
                const storageRef = ref(getStorage(), `videos/${currentUserId}/${storagePath}`);
                console.log('Uploading to path:', `videos/${currentUserId}/${storagePath}`);

                // Lấy tệp dưới dạng blob
                console.log('Fetching video as blob...');
                const response = await fetch(uri);
                const blob = await response.blob();
                console.log('Blob created, size:', blob.size);

                // Tải lên Firebase Storage
                console.log('Starting upload to Firebase Storage...');
                await uploadBytes(storageRef, blob);
                console.log('Upload complete, getting download URL');
                
                clearInterval(progressInterval);
                handleProgress(100);
                
                // Lấy URL tải xuống
                const downloadURL = await getDownloadURL(storageRef);
                console.log('Download URL:', downloadURL);

                // Thêm tin nhắn vào Firestore
                const messageData = {
                    con_id: conversationId,
                    sender_id: currentUserId,
                    receiver_id: chatWithUserId,
                    content: fileName,
                    type: 'video',
                    url: downloadURL,
                    width: asset.width || 0,
                    height: asset.height || 0,
                    duration: asset.duration || 0,
                    createdAt: Date.now(),
                    timestamp: Date.now(),
                    isRevoked: false,
                    seen: false
                };
                
                console.log('Adding message to Firestore:', messageData);
                await addDoc(collection(db, MESSAGE_COLLECTION), messageData);

                console.log('Video uploaded successfully');
                Alert.alert('Thành công', 'Video đã được gửi thành công.');
            } catch (uploadError) {
                console.error('Error in upload process:', uploadError);
                Alert.alert('Lỗi', 'Không thể tải lên video. Lỗi: ' + uploadError.message);
            } finally {
                clearInterval(progressInterval);
                handleVideoUploadEnd();
            }
        } catch (error) {
            console.error('Error processing video:', error);
            Alert.alert('Lỗi', 'Không thể xử lý video. Vui lòng thử lại.');
            handleVideoUploadEnd();
        }
    };

    // Hàm xử lý tải lên tệp đính kèm
    const handleFilePickerUpload = async () => {
      if (!conversationId) {
          Alert.alert('Lỗi', 'Không thể xác định cuộc trò chuyện.');
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
          handleFileUploadStart();
          
          // Giả lập cập nhật tiến trình
          let progress = 0;
          const progressInterval = setInterval(() => {
              progress = Math.min(95, progress + 5);
              handleProgress(progress);
          }, 500);

          // Xác định phần mở rộng tệp
          const fileExtension = asset.name.split('.').pop() || '';
          const fileName = `${uuid.v4()}-${asset.name}`;
          const fileRef = ref(getStorage(), `files/${currentUserId}/${fileName}`);

          const responseBlob = await fetch(asset.uri);
          const blob = await responseBlob.blob();

          // Tải tệp lên Firebase Storage
          await uploadBytes(fileRef, blob);
          clearInterval(progressInterval);
          handleProgress(100);

          const downloadURL = await getDownloadURL(fileRef);

          // Thêm tin nhắn tệp vào Firestore
          await addDoc(collection(db, MESSAGE_COLLECTION), {
              con_id: conversationId,
              sender_id: currentUserId,
              receiver_id: chatWithUserId,
              content: asset.name,
              type: 'file',
              url: downloadURL,
              createdAt: Date.now(),
              timestamp: Date.now(),
              isRevoked: false,
              seen: false
          });

          console.log('File uploaded successfully');
      } catch (error) {
          console.error('Error uploading file:', error);
          Alert.alert('Lỗi', 'Không thể tải lên file. Vui lòng thử lại.');
      } finally {
          setIsUploading(false);
          handleFileUploadEnd();
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

    // Fetch user info for all senders when messages change
    useEffect(() => {
      const fetchAllSenders = async () => {
          const senderIds = [...new Set(messages.map(m => m.sender_id))];
          const missingIds = senderIds.filter(id => !userCache[id]);
          if (missingIds.length === 0) return;
          const newCache = { ...userCache };
          for (const id of missingIds) {
              try {
                  const userDoc = await getDoc(doc(db, 'Users', id));
                  if (userDoc.exists()) newCache[id] = userDoc.data();
              } catch (e) {}
          }
          setUserCache(newCache);
      };
      fetchAllSenders();
      // eslint-disable-next-line
  }, [messages]);
   
    // Hàm hiển thị từng tin nhắn
    const renderMessage = ({ item }) => {
      const isCurrentUser = item.sender_id === currentUserId;
      const senderInfo = userCache[item.sender_id] || {};
      const time = moment(item.createdAt).format('hh:mm A');

      // Bỏ qua tin nhắn đã bị xóa bởi người dùng hiện tại
      if (item.deletedFor?.includes(currentUserId)) {
          return null;
      }

      // Hiển thị tin nhắn hệ thống
      if (item.type === 'system') {
          // Chọn icon theo action
          let icon = null;
          if (item.action === 'add') icon = <Ionicons name="person-add" size={16} color="#4caf50" style={{ marginRight: 6 }} />;
          else if (item.action === 'remove' || item.action === 'leave') icon = <Ionicons name="person-remove" size={16} color="#f44336" style={{ marginRight: 6 }} />;
          else if (item.action === 'update') icon = <Ionicons name="sync" size={16} color="#2196f3" style={{ marginRight: 6 }} />;
          else if (item.action === 'disband') icon = <Ionicons name="warning" size={16} color="#ff9800" style={{ marginRight: 6 }} />;
          // ... các action khác nếu muốn
          return (
              <View style={styles.systemMessageContainer}>
                  <View style={styles.systemMessageBox}>
                      {icon}
                      <Text style={styles.systemMessageText}>{item.content}</Text>
                  </View>
              </View>
          );
      }

        return (
            <View style={[styles.messageRow, isCurrentUser ? styles.userMessageRow : styles.friendMessageRow]}>
                {/* Avatar và thông tin người gửi (chỉ hiển thị cho tin nhắn của người khác) */}
                {!isCurrentUser && (
                    <View style={styles.senderInfoContainer}>
                        <Image
                            source={{ uri: senderInfo?.img || senderInfo?.avatar || 'https://www.kindpng.com/picc/m/22-223863_no-avatar-png-circle-transparent-png.png' }}
                            style={styles.messageAvatar}
                        />
                    </View>
                )}

                {/* Nội dung tin nhắn, timestamp và trạng thái đã xem */}
                <View style={styles.messageContentAndTimeContainer}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onLongPress={() => {
                            setSelectedMessage(item);
                            setShowMoreOptions(true);
                        }}
                    >
                        <View style={[styles.messageBubbleNew, isCurrentUser ? styles.userBubbleNew : styles.friendBubbleNew]}>
                            {item.replyTo && (
                                <View style={styles.replyContainer}>
                                    <View style={styles.replyBar} />
                                    <View style={styles.replyContent}>
                                        <Text style={styles.replySender}>
                                            {item.replyTo.sender_id === currentUserId ? "Bạn" : userCache[item.replyTo.sender_id]?.fullName || 'Người gửi'}
                                        </Text>
                                        {item.replyTo.type === 'text' ? (
                                            <Text style={styles.replyText} numberOfLines={1}>
                                                {item.replyTo.content}
                                            </Text>
                                        ) : (
                                            <Text style={styles.replyText}>[{item.replyTo.type}]</Text>
                                        )}
                                    </View>
                                </View>
                            )}

                            {item.revoked ? (
                                <Text style={styles.revokedMessageText}>Tin nhắn đã bị thu hồi</Text>
                            ) : (
                                <>
                                    {(item.type === 'image' || item.type === 'video' || item.type === 'audio' || item.type === 'file') ? (
                                        <RenderFileMessage message={item} />
                                    ) : (
                                        item.type === 'text' && item.content && <Text style={[styles.messageText, isCurrentUser && styles.userMessageText]}>{item.content}</Text>
                                    )}
                                </>
                            )}
                        </View>
                    </TouchableOpacity>

                    {/* Timestamp và trạng thái đã xem */}
                    {!item.revoked && !item.deletedFor?.includes(currentUserId) && (
                        <View style={[styles.timestampStatusContainer, isCurrentUser ? styles.userTimestampStatusContainer : styles.friendTimestampStatusContainer]}>
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

                {/* Avatar người dùng hiện tại (chỉ hiển thị cho tin nhắn của mình) */}
                {isCurrentUser && (
                    <View style={styles.senderInfoContainer}>
                        <Image
                            source={{ uri: currentUserInfo?.img || currentUserInfo?.avatar || 'https://www.kindpng.com/picc/m/22-223863_no-avatar-png-circle-transparent-png.png' }}
                            style={styles.messageAvatar}
                        />
                        {/* Không hiển thị tên hoặc trạng thái online của mình ở đây */}
                    </View>
                )}
            </View>
        );
    };

    useEffect(() => {
        const fetchUserInfo = async () => {
            if (currentUserId) {
                const userDoc = await getDoc(doc(db, 'Users', currentUserId));
                setCurrentUserInfo(userDoc.exists() ? userDoc.data() : null);
            }
            if (chatWithUserId) {
                const userDoc = await getDoc(doc(db, 'Users', chatWithUserId));
                setChatUser(userDoc.exists() ? userDoc.data() : null);
            }
        };
        fetchUserInfo();
    }, [currentUserId, chatWithUserId]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Image
                    source={{ uri: chatUser?.img || chatUser?.avatar || 'https://www.kindpng.com/picc/m/22-223863_no-avatar-png-circle-transparent-png.png' }}
                    style={styles.headerAvatar}
                />
                <View style={styles.headerInfo}>
                    <Text style={styles.headerName}>{chatUser?.fullName || chatUser?.name || chatUser?.email || 'Người dùng'}</Text>
                    <Text style={[styles.headerStatus, { color: chatUser?.status === 'online' ? '#4caf50' : '#888' }]}> 
                        {chatUser?.status === 'online' ? 'Đang hoạt động' : 'Offline'}
                    </Text>
                </View>
            </View>
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.messagesList}
            />
            
            {isUploading && (
                <View style={styles.progressOverlay}>
                    <View style={styles.progressContainer}>
                        <ActivityIndicator size="large" color="#3f15d6" />
                        <Text style={styles.progressText}>Uploading... {uploadProgress}%</Text>
                    </View>
                </View>
            )}
            
            <View style={styles.bottomContainer}>
                {replyToMessage && (
                    <View style={styles.replyPreviewContainer}>
                        <View style={styles.replyPreviewContent}>
                            <View style={styles.replyPreviewBar} />
                            <View style={styles.replyPreviewMessageContainer}>
                                <Text style={styles.replyPreviewSender}>
                                    {replyToMessage.sender_id === currentUserId ? "Bạn" : "Người gửi"}
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
                                onPress={() => setReplyToMessage(null)}
                            >
                                <Icon name="close" size={16} color="#666" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                
                <View style={styles.inputContainer}>
                    <TouchableOpacity onPress={() => setShowEmojiPicker(!showEmojiPicker)} style={styles.emojiButton}>
                        <Icon name="smile-o" size={22} color="#3f15d6" />
                    </TouchableOpacity>
                    <TextInput
                        style={styles.input}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Type a message"
                        placeholderTextColor="#a0a0a0"
                    />
                    <TouchableOpacity onPress={toggleAttachmentMenu} style={styles.attachmentButton}>
                        <Icon name="ellipsis-h" size={22} color="#3f15d6" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
                        <Text style={styles.sendButtonText}>Send</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <AttachmentMenu 
                isVisible={showAttachmentMenu}
                onClose={() => setShowAttachmentMenu(false)}
                onSelectImage={uploadImage}
                onSelectVideo={handleVideoPickerUpload}
                onSelectFile={handleFilePickerUpload}
            />

            {showEmojiPicker && (
                <View style={styles.emojiPickerContainer}>
                    <Picker onSelect={handleEmojiClick} theme="light" />
                </View>
            )}
            {showMoreOptions && selectedMessage && (
                <Modal
                    visible={showMoreOptions}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowMoreOptions(false)}
                >
                    <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMoreOptions(false)}>
                        <View style={styles.moreOptionsContent}>
                            <TouchableOpacity style={styles.moreOption} onPress={() => { 
                                handleReplyToMessage(selectedMessage); 
                                setShowMoreOptions(false); 
                            }}>
                                <Icon name="reply" size={18} color="#4CAF50" />
                                <Text style={[styles.moreOptionText, styles.replyOptionText]}>Trả Lời</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.moreOption} onPress={() => { 
                                openForwardModal(selectedMessage); 
                                setShowMoreOptions(false); 
                            }}>
                                <Icon name="share" size={18} color="#3f15d6" />
                                <Text style={[styles.moreOptionText, styles.forwardText]}>Chuyển Tiếp</Text>
                            </TouchableOpacity>
                            {selectedMessage.sender_id === currentUserId && (
                                <>
                                    <TouchableOpacity style={styles.moreOption} onPress={() => { handleRevokeMessage(selectedMessage.id); setShowMoreOptions(false); }}>
                                        <Icon name="undo" size={18} color="#ff3b30" />
                                        <Text style={[styles.moreOptionText, styles.recallText]}>Thu Hồi</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.moreOption} onPress={() => { handleDeleteMessage(selectedMessage.id); setShowMoreOptions(false); }}>
                                        <Icon name="trash" size={18} color="#8e8e93" />
                                        <Text style={styles.moreOptionText}>Xóa tin nhắn</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                            {selectedMessage.sender_id !== currentUserId && (
                                <TouchableOpacity style={styles.moreOption} onPress={() => { handleDeleteMessage(selectedMessage.id); setShowMoreOptions(false); }}>
                                    <Icon name="trash" size={18} color="#8e8e93" />
                                    <Text style={styles.moreOptionText}>Xóa tin nhắn</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </TouchableOpacity>
                </Modal>
            )}

            {/* Forward Modal */}
            {showForwardModal && (
                <Modal
                    visible={showForwardModal}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setShowForwardModal(false)}
                >
                    <View style={styles.forwardModalContainer}>
                        <View style={styles.forwardModalHeader}>
                            <Text style={styles.forwardModalTitle}>Forward Message</Text>
                            <TouchableOpacity onPress={() => setShowForwardModal(false)}>
                                <Icon name="close" size={24} color="#000" />
                            </TouchableOpacity>
                        </View>
                        
                        {/* Preview of message being forwarded */}
                        <View style={styles.forwardPreviewContainer}>
                            {forwardMessage?.type === 'image' ? (
                                <Image source={{ uri: forwardMessage.url }} style={styles.forwardImagePreview} />
                            ) : (
                                <Text style={styles.forwardTextPreview} numberOfLines={2}>
                                    {forwardMessage?.content}
                                </Text>
                            )}
                        </View>
                        
                        <Text style={styles.forwardInstructionText}>Select conversations to forward to:</Text>
                        
                        {/* List of conversations */}
                        <FlatList
                            data={conversations}
                            keyExtractor={(item) => item.con_id}
                            style={styles.conversationsList}
                            renderItem={({ item }) => {
                                // Skip current conversation
                                if (item.con_id === conversationId) return null;
                                
                                const isSelected = selectedConversations.some(c => c.con_id === item.con_id);
                                return (
                                    <TouchableOpacity 
                                        style={[
                                            styles.conversationItem,
                                            isSelected && styles.selectedConversationItem
                                        ]}
                                        onPress={() => toggleConversationSelection(item)}
                                    >
                                        <Icon name={item.is_group ? "users" : "user"} size={24} color="#514869" />
                                        <Text style={styles.conversationName}>
                                            {item.name || 'Chat'}
                                            {item.is_group ? ' (Group)' : ''}
                                        </Text>
                                        {isSelected && (
                                            <Icon name="check-circle" size={24} color="#3f15d6" />
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
                            onPress={handleSendForwardMessage}
                        >
                            <Text style={styles.forwardButtonText}>
                                Forward to {selectedConversations.length} conversation{selectedConversations.length !== 1 ? 's' : ''}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Modal>
            )}

            {/* Video Player */}
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
        </View>
    );
}
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f7fa' 
  },
  messagesList: {
    paddingVertical: 16,
    paddingBottom: 80,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingHorizontal: 8,
    alignItems: 'flex-end', // Căn chỉnh bong bóng và avatar thẳng hàng dưới cùng
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  friendMessageRow: {
    justifyContent: 'flex-start',
  },
  senderInfoContainer: {
    alignItems: 'center',
    marginHorizontal: 4, // Khoảng cách giữa avatar và bong bóng
    width: 40, // Giữ kích thước cố định cho avatar + status
  },
  messageAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  senderStatus: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  messageContentAndTimeContainer: {
    flexDirection: 'column',
    maxWidth: '75%',
  },
  messageBubbleNew: {
    borderRadius: 18,
    padding: 10,
    maxWidth: '100%',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  userBubbleNew: {
    backgroundColor: '#BFEFFF', // Màu xanh nhạt cho tin nhắn của bạn
    borderBottomRightRadius: 4, // Bo góc dưới bên phải ít hơn
  },
  friendBubbleNew: {
    backgroundColor: '#CAE1FF', // Màu xanh nhạt hơn cho tin nhắn của người khác
    borderBottomLeftRadius: 4, // Bo góc dưới bên trái ít hơn
  },
  timestampStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  userTimestampStatusContainer: {
    justifyContent: 'flex-end', // Căn phải timestamp/seen status cho tin nhắn của bạn
    marginRight: 6, // Khoảng cách với bong bóng
  },
  friendTimestampStatusContainer: {
    justifyContent: 'flex-start', // Căn trái timestamp cho tin nhắn người khác
    marginLeft: 6, // Khoảng cách với bong bóng
  },
  systemMessageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 4, // Khoảng cách với timestamp (nếu hiển thị)
  },
  systemMessageText: {
    fontSize: 13,
    color: '#808080',
    fontStyle: 'italic',
  },
  systemMessageContainer: {
    marginBottom: 12,
    paddingHorizontal: 8,
    alignItems: 'center', // Căn giữa system message
  },
  replyContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  replyBar: {
    width: 2,
    height: '100%',
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  replyContent: {
    flex: 1,
  },
  replySender: {
    fontWeight: 'bold',
    fontSize: 12,
    color: '#4CAF50',
  },
  replyText: {
    fontSize: 12,
    color: '#666',
  },
  videoContainer: {
    width: 220,
    height: 150,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#3f15d6',
    opacity: 0.7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayButton: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoName: {
    position: 'absolute',
    bottom: 30,
    left: 10,
    right: 10,
    color: '#fff',
    fontSize: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 3,
    borderRadius: 3,
    textAlign: 'center',
  },
  fileTypeLabel: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#fff',
    padding: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    fontSize: 12,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    borderRadius: 10,
    padding: 12,
    paddingRight: 8,
    minWidth: 180,
    maxWidth: 250,
  },
  fileName: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#333',
  },
  downloadButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e4e6eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  replyOptionText: {
    color: '#4CAF50'
  },
  replyPreviewContainer: {
    width: '100%',
    backgroundColor: '#f0f0f0',
  },
  replyPreviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingVertical: 10,
    backgroundColor: '#eee',
  },
  replyPreviewBar: {
    width: 3,
    height: '100%',
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  replyPreviewMessageContainer: {
    flex: 1,
  },
  replyPreviewSender: {
    fontWeight: 'bold',
    fontSize: 12,
    color: '#4CAF50',
  },
  replyPreviewText: {
    fontSize: 12,
    color: '#666',
  },
  replyPreviewCloseButton: {
    padding: 4,
  },
  replyPreviewMediaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyPreviewMediaText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f8f8f8',
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontSize: 16,
  },
  sendButton: {
    height: 40,
    paddingHorizontal: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#3f15d6',
    marginLeft: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emojiButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 5,
  },
  attachmentButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  emojiPickerContainer: {
    height: 300,
    width: '100%',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  image: { 
    width: 220, 
    height: 220, 
    borderRadius: 12,
    marginBottom: 6,
  },
  modalOverlay: {
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  moreOptionsContent: {
    backgroundColor: '#222', 
    borderRadius: 12, 
    padding: 6, 
    width: 220,
    elevation: 5,
  },
  moreOption: {
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 14, 
    paddingHorizontal: 16,
  },
  moreOptionText: { 
    fontSize: 16, 
    marginLeft: 16, 
    color: '#fff' 
  },
  recallText: { 
    color: '#ff3b30' 
  },
  loadingOverlay: {
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 20,
  },
  loadingText: { 
    color: '#fff', 
    fontSize: 16, 
    marginTop: 12,
    fontWeight: '500',
  },
  forwardText: {
    color: '#3f15d6'
  },
  forwardModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 30,
  },
  forwardModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  forwardModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  forwardPreviewContainer: {
    backgroundColor: '#f5f7fa',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  forwardTextPreview: {
    fontSize: 16,
    color: '#333',
  },
  forwardImagePreview: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    resizeMode: 'contain',
  },
  forwardInstructionText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    marginTop: 8,
  },
  conversationsList: {
    flex: 1,
    marginBottom: 16,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedConversationItem: {
    backgroundColor: '#f0f5ff',
  },
  conversationName: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
    color: '#333',
  },
  forwardButton: {
    backgroundColor: '#3f15d6',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#b0b0b0',
  },
  forwardButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  progressContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  progressText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
  videoPlayerContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayerHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeVideoButton: {
    padding: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#3f15d6' },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12, borderWidth: 2, borderColor: '#fff' },
  headerInfo: { flex: 1 },
  headerName: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  headerStatus: { fontSize: 13, marginTop: 2 },
  messageText: { 
    color: '#000000', // Black text for better contrast on light backgrounds
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#000000', // Black text for better contrast on light backgrounds
    fontSize: 16,
    lineHeight: 22,
  },
  revokedMessageText: { 
    color: '#888888', 
    fontStyle: 'italic' 
  },
  timestampText: {
    fontSize: 12,
    color: '#8e8e93',
    marginRight: 4,
  },
  seenStatusContainer: {
    marginLeft: 2,
  },
  bottomContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  replyPreviewContainer: {
    width: '100%',
    backgroundColor: '#f0f0f0',
  },
  replyPreviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingVertical: 10,
    backgroundColor: '#eee',
  },
  replyPreviewBar: {
    width: 3,
    height: '100%',
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  replyPreviewMessageContainer: {
    flex: 1,
  },
  replyPreviewSender: {
    fontWeight: 'bold',
    fontSize: 12,
    color: '#4CAF50',
  },
  replyPreviewText: {
    fontSize: 12,
    color: '#666',
  },
  replyPreviewCloseButton: {
    padding: 4,
  },
  replyPreviewMediaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyPreviewMediaText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f8f8f8',
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontSize: 16,
  },
  sendButton: {
    height: 40,
    paddingHorizontal: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#3f15d6',
    marginLeft: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emojiButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 5,
  },
  attachmentButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  emojiPickerContainer: {
    height: 300,
    width: '100%',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  image: { 
    width: 220, 
    height: 220, 
    borderRadius: 12,
    marginBottom: 6,
  },
  modalOverlay: {
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  moreOptionsContent: {
    backgroundColor: '#222', 
    borderRadius: 12, 
    padding: 6, 
    width: 220,
    elevation: 5,
  },
  moreOption: {
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 14, 
    paddingHorizontal: 16,
  },
  moreOptionText: { 
    fontSize: 16, 
    marginLeft: 16, 
    color: '#fff' 
  },
  recallText: { 
    color: '#ff3b30' 
  },
  loadingOverlay: {
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 20,
  },
  loadingText: { 
    color: '#fff', 
    fontSize: 16, 
    marginTop: 12,
    fontWeight: '500',
  },
  forwardText: {
    color: '#3f15d6'
  },
  forwardModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 30,
  },
  forwardModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  forwardModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  forwardPreviewContainer: {
    backgroundColor: '#f5f7fa',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  forwardTextPreview: {
    fontSize: 16,
    color: '#333',
  },
  forwardImagePreview: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    resizeMode: 'contain',
  },
  forwardInstructionText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    marginTop: 8,
  },
  conversationsList: {
    flex: 1,
    marginBottom: 16,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedConversationItem: {
    backgroundColor: '#f0f5ff',
  },
  conversationName: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
    color: '#333',
  },
  forwardButton: {
    backgroundColor: '#3f15d6',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#b0b0b0',
  },
  forwardButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  progressContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  progressText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
  videoContainer: {
    width: 220,
    height: 150,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#3f15d6',
    opacity: 0.7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayButton: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoName: {
    position: 'absolute',
    bottom: 30,
    left: 10,
    right: 10,
    color: '#fff',
    fontSize: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 3,
    borderRadius: 3,
    textAlign: 'center',
  },
  fileTypeLabel: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#fff',
    padding: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    fontSize: 12,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    borderRadius: 10,
    padding: 12,
    paddingRight: 8,
    minWidth: 180,
    maxWidth: 250,
  },
  fileName: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#333',
  },
  downloadButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e4e6eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  replyOptionText: {
    color: '#4CAF50'
  },
  replyContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  replyBar: {
    width: 2,
    height: '100%',
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  replyContent: {
    flex: 1,
  },
  replySender: {
    fontWeight: 'bold',
    fontSize: 12,
    color: '#4CAF50',
  },
  replyText: {
    fontSize: 12,
    color: '#666',
  },
  videoPlayerContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayerHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeVideoButton: {
    padding: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#27548A' },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12, borderWidth: 2, borderColor: '#fff' },
  headerInfo: { flex: 1 },
  headerName: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  headerStatus: { fontSize: 13, marginTop: 2 },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingHorizontal: 8,
    alignItems: 'flex-end', // Căn chỉnh bong bóng và avatar thẳng hàng dưới cùng
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  friendMessageRow: {
    justifyContent: 'flex-start',
  },
  senderInfoContainer: {
    alignItems: 'center',
    marginHorizontal: 4, // Khoảng cách giữa avatar và bong bóng
    width: 40, // Giữ kích thước cố định cho avatar + status
  },
  messageAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  messageContentAndTimeContainer: {
    flexDirection: 'column',
    maxWidth: '75%',
  },
  messageBubbleNew: {
    borderRadius: 18,
    padding: 10,
    maxWidth: '100%',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  userBubbleNew: {
    backgroundColor: '#BFEFFF', // Màu xanh nhạt cho tin nhắn của bạn
    borderBottomRightRadius: 4, // Bo góc dưới bên phải ít hơn
  },
  friendBubbleNew: {
    backgroundColor: '#CAE1FF', // Màu xanh nhạt hơn cho tin nhắn của người khác
    borderBottomLeftRadius: 4, // Bo góc dưới bên trái ít hơn
  },
  timestampStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  userTimestampStatusContainer: {
    justifyContent: 'flex-end', // Căn phải timestamp/seen status cho tin nhắn của bạn
    marginRight: 6, // Khoảng cách với bong bóng
  },
  friendTimestampStatusContainer: {
    justifyContent: 'flex-start', // Căn trái timestamp cho tin nhắn người khác
    marginLeft: 6, // Khoảng cách với bong bóng
  },
  systemMessageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 4, // Khoảng cách với timestamp (nếu hiển thị)
  },
  systemMessageText: {
    fontSize: 13,
    color: '#808080',
    fontStyle: 'italic',
  },
  systemMessageContainer: {
    marginBottom: 12,
    paddingHorizontal: 8,
    alignItems: 'center', // Căn giữa system message
  },
});