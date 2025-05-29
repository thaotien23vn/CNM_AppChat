import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Image, ScrollView, FlatList, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useAuth } from '../AuthContext/AuthContext';
import { db, storage } from '../Firebase/Firebase';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  where, 
  getDocs,
  updateDoc,
  doc,
  arrayUnion,
  arrayRemove,
  limit,
  deleteDoc
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import PostCard from '../components/PostCard';

const TimelineScreen = () => {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostTitle, setNewPostTitle] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userInfo, setUserInfo] = useState({});
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mediaType, setMediaType] = useState('');
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [postToDelete, setPostToDelete] = useState(null);
  const [mediaSource, setMediaSource] = useState('upload'); // 'upload' or 'ai'
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    const postsQuery = query(
      collection(db, 'Posts'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        likedByCurrentUser: doc.data().likedBy?.includes(currentUser.uid) || false,
        isAuthor: doc.data().authorId === currentUser.uid
      }));
      setPosts(postsData);
    });
    return () => unsubscribe();
  }, [currentUser.uid]);

  useEffect(() => {
    const fetchTrendingPosts = async () => {
      try {
        const trendingQuery = query(
          collection(db, 'Posts'),
          orderBy('likes', 'desc'),
          limit(3)
        );
        const snapshot = await getDocs(trendingQuery);
        const trendingData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setTrendingPosts(trendingData);
      } catch (error) {
        console.error('Error fetching trending posts:', error);
      }
    };
    fetchTrendingPosts();
  }, []);

  useEffect(() => {
    if (currentUser) {
      const userRef = collection(db, 'Users');
      const q = query(userRef, where('user_id', '==', currentUser.uid));
      getDocs(q).then(snapshot => {
        if (!snapshot.empty) {
          setUserInfo(snapshot.docs[0].data());
        }
      }).catch(error => {
        console.error('Error fetching user info:', error);
      });
    }
  }, [currentUser]);

  const handleCreatePost = async () => {
    if (!newPostTitle.trim() || !newPostContent.trim()) {
      Alert.alert('Vui lòng nhập tiêu đề và nội dung');
      return;
    }
    setIsSubmitting(true);
    try {
      const postData = {
        title: newPostTitle,
        content: newPostContent,
        authorId: currentUser.uid,
        authorName: userInfo.fullName,
        authorEmail: userInfo.email,
        authorAvatar: userInfo.img || '',
        createdAt: serverTimestamp(),
        likes: 0,
        likedBy: [],
        mediaUrl: '',
        mediaType: ''
      };
      if (mediaFile) {
        // Nếu là ảnh/video, upload lên storage
        const fileName = `posts/${currentUser.uid}_${Date.now()}`;
        const storageRef = ref(storage, fileName);
        const uploadTask = uploadBytesResumable(storageRef, mediaFile);
        await new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => {
              console.error('Upload error:', error);
              Alert.alert('Lỗi khi tải media');
              reject(error);
            },
            async () => {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              postData.mediaUrl = downloadUrl;
              postData.mediaType = mediaType;
              resolve();
            }
          );
        });
      }
      await addDoc(collection(db, 'Posts'), postData);
      setNewPostTitle('');
      setNewPostContent('');
      setMediaFile(null);
      setMediaPreview('');
      setMediaType('');
      setUploadProgress(0);
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Lỗi khi tạo bài viết');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Chọn media (ảnh/video) từ thiết bị
  // const pickMedia = async () => {
  //   let result = await ImagePicker.launchImageLibraryAsync({
  //     mediaTypes: ImagePicker.MediaTypeOptions.All,
  //     allowsEditing: true,
  //     quality: 1,
  //   });
  //   if (!result.cancelled) {
  //     setMediaFile(result.assets[0]);
  //     setMediaPreview(result.assets[0].uri);
  //     setMediaType(result.assets[0].type);
  //   }
  // };

  const handleRemoveMedia = () => {
    setMediaFile(null);
    setMediaPreview('');
    setMediaType('');
  };

  const handleLikePost = async (postId, isLiked) => {
    try {
      const postRef = doc(db, 'Posts', postId);
      if (isLiked) {
        await updateDoc(postRef, {
          likes: posts.find(p => p.id === postId).likes - 1,
          likedBy: arrayRemove(currentUser.uid)
        });
      } else {
        await updateDoc(postRef, {
          likes: posts.find(p => p.id === postId).likes + 1,
          likedBy: arrayUnion(currentUser.uid)
        });
      }
    } catch (error) {
      console.error('Error updating like:', error);
    }
  };

  const handleDeletePost = (post) => {
    setPostToDelete(post);
    setShowDeleteModal(true);
  };

  const confirmDeletePost = async () => {
    if (!postToDelete) return;
    try {
      if (postToDelete.authorId !== currentUser.uid) {
        Alert.alert('Bạn không có quyền xoá bài viết này');
        return;
      }
      await deleteDoc(doc(db, 'Posts', postToDelete.id));
      setShowDeleteModal(false);
      setPostToDelete(null);
    } catch (error) {
      console.error('Error deleting post:', error);
      Alert.alert('Lỗi khi xoá bài viết');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // SidebarContent có thể render dưới dạng ScrollView hoặc View
  const SidebarContent = () => (
    <View style={styles.sidebarContainer}>
      <View style={styles.trendingBox}>
        <View style={styles.trendingHeader}>
          <Icon name="trending-up" size={18} color="#ec4899" style={{ marginRight: 8 }} />
          <Text style={styles.trendingTitle}>Bài viết nổi bật</Text>
        </View>
        {trendingPosts.length > 0 ? (
          trendingPosts.map(post => (
            <View key={post.id} style={styles.trendingPost}>
              <Text style={styles.trendingPostTitle}>{post.title}</Text>
              <View style={styles.trendingPostInfo}>
                <Text style={styles.trendingPostAuthor}>Bởi: {post.authorName || 'Người dùng'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="heart" size={12} color="#ef4444" style={{ marginRight: 2 }} />
                  <Text style={styles.trendingPostLikes}>{post.likes}</Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.trendingEmpty}>Chưa có bài viết nổi bật</Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>VibeChat</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
          <Icon name="plus-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.createBtnText}>Tạo bài viết</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scrollArea}>
        {posts.length === 0 ? (
          <View style={styles.noPostBox}>
            <Text style={styles.noPostText}>Chưa có bài viết nào</Text>
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <PostCard 
                post={item} 
                onLike={handleLikePost}
                onDelete={handleDeletePost}
                formatDate={formatDate}
              />
            )}
            contentContainerStyle={{ paddingBottom: 16 }}
          />
        )}
        <SidebarContent />
      </ScrollView>
      {/* Modal tạo bài post */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bài viết mới</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Icon name="x" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              <Text style={styles.inputLabel}>Tiêu đề bài viết</Text>
              <TextInput
                value={newPostTitle}
                onChangeText={setNewPostTitle}
                style={styles.input}
                placeholder="Nhập tiêu đề bài viết"
              />
              <Text style={styles.inputLabel}>Nội dung bài viết</Text>
              <TextInput
                value={newPostContent}
                onChangeText={setNewPostContent}
                style={[styles.input, { minHeight: 80 }]}
                placeholder="Nhập nội dung bài viết"
                multiline
              />
              {/* Media upload section: tuỳ chọn, có thể dùng ImagePicker */}
              {/* <TouchableOpacity style={styles.mediaBtn} onPress={pickMedia}>
                <Icon name="image" size={18} color="#6366f1" />
                <Text style={styles.mediaBtnText}>{t('uploadMedia')}</Text>
              </TouchableOpacity> */}
              {mediaPreview ? (
                <View style={styles.mediaPreviewBox}>
                  {mediaType === 'image' ? (
                    <Image source={{ uri: mediaPreview }} style={styles.mediaPreviewImg} />
                  ) : (
                    <Text style={styles.mediaPreviewText}>[Video preview không hỗ trợ]</Text>
                  )}
                  <TouchableOpacity style={styles.removeMediaBtn} onPress={handleRemoveMedia}>
                    <Icon name="trash-2" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ) : null}
              {isSubmitting && (
                <View style={styles.progressBox}>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{Math.round(uploadProgress)}%</Text>
                </View>
              )}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreateModal(false)} disabled={isSubmitting}>
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.publishBtn} onPress={handleCreatePost} disabled={isSubmitting}>
                <Text style={styles.publishBtnText}>{isSubmitting ? 'Đang đăng...' : 'Đăng'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Modal xác nhận xoá */}
      <Modal
        visible={showDeleteModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Xác nhận xoá</Text>
            <Text style={styles.deleteConfirmText}>Bạn có chắc muốn xoá bài viết này?</Text>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDeleteModal(false)}>
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={confirmDeletePost}>
                <Text style={styles.deleteBtnText}>Xoá</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8fafc' 
  },
  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#6366f1',
    letterSpacing: -0.5,
  },
  createBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#6366f1', 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    borderRadius: 12,
    shadowColor: '#6366f1',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  createBtnText: { 
    color: '#fff', 
    fontWeight: '600', 
    fontSize: 15,
    marginLeft: 6,
  },
  scrollArea: { 
    flex: 1, 
    padding: 16,
  },
  noPostBox: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 24, 
    alignItems: 'center', 
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  noPostText: { 
    color: '#64748b', 
    fontSize: 16,
    fontWeight: '500',
  },
  sidebarContainer: { 
    marginTop: 24,
  },
  trendingBox: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 20, 
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  trendingHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12,
  },
  trendingTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#0f172a',
    marginLeft: 8,
  },
  trendingPost: { 
    borderBottomWidth: 1, 
    borderBottomColor: '#e2e8f0', 
    paddingBottom: 12, 
    marginBottom: 12,
  },
  trendingPostTitle: { 
    fontWeight: '600', 
    color: '#1e293b',
    fontSize: 15,
    marginBottom: 4,
  },
  trendingPostInfo: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
  },
  trendingPostAuthor: { 
    fontSize: 13, 
    color: '#64748b', 
    fontStyle: 'italic',
  },
  trendingPostLikes: { 
    fontSize: 13, 
    color: '#ef4444',
    fontWeight: '500',
  },
  trendingEmpty: { 
    color: '#64748b', 
    textAlign: 'center', 
    paddingVertical: 12,
    fontSize: 14,
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  modalBox: { 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    padding: 24, 
    width: '90%', 
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16,
  },
  modalTitle: { 
    fontSize: 22, 
    fontWeight: '700', 
    color: '#0f172a',
  },
  inputLabel: { 
    fontSize: 15, 
    color: '#334155', 
    marginTop: 12, 
    marginBottom: 6,
    fontWeight: '500',
  },
  input: { 
    backgroundColor: '#f8fafc', 
    borderRadius: 12, 
    padding: 12, 
    fontSize: 16, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#e2e8f0',
    color: '#1e293b',
  },
  mediaBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginVertical: 12,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mediaBtnText: { 
    marginLeft: 8, 
    color: '#6366f1', 
    fontWeight: '600',
    fontSize: 15,
  },
  mediaPreviewBox: { 
    marginTop: 12, 
    alignItems: 'center', 
    position: 'relative',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
  },
  mediaPreviewImg: { 
    width: 200, 
    height: 200, 
    borderRadius: 12, 
    resizeMode: 'cover',
  },
  mediaPreviewText: { 
    color: '#64748b', 
    fontStyle: 'italic',
    marginTop: 8,
  },
  removeMediaBtn: { 
    position: 'absolute', 
    top: 8, 
    right: 8, 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    padding: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  progressBox: { 
    marginTop: 12,
  },
  progressBarBg: { 
    backgroundColor: '#e2e8f0', 
    borderRadius: 8, 
    height: 8, 
    width: '100%',
  },
  progressBar: { 
    backgroundColor: '#6366f1', 
    height: 8, 
    borderRadius: 8,
  },
  progressText: { 
    color: '#64748b', 
    fontSize: 13, 
    textAlign: 'right', 
    marginTop: 4,
    fontWeight: '500',
  },
  modalFooter: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    marginTop: 20,
  },
  cancelBtn: { 
    backgroundColor: '#f1f5f9', 
    borderRadius: 12, 
    paddingVertical: 10, 
    paddingHorizontal: 20, 
    marginRight: 12,
  },
  cancelBtnText: { 
    color: '#64748b', 
    fontWeight: '600',
    fontSize: 15,
  },
  publishBtn: { 
    backgroundColor: '#6366f1', 
    borderRadius: 12, 
    paddingVertical: 10, 
    paddingHorizontal: 20,
    shadowColor: '#6366f1',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  publishBtnText: { 
    color: '#fff', 
    fontWeight: '600',
    fontSize: 15,
  },
  deleteBtn: { 
    backgroundColor: '#ef4444', 
    borderRadius: 12, 
    paddingVertical: 10, 
    paddingHorizontal: 20,
    shadowColor: '#ef4444',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  deleteBtnText: { 
    color: '#fff', 
    fontWeight: '600',
    fontSize: 15,
  },
  deleteConfirmText: { 
    color: '#64748b', 
    fontSize: 16, 
    marginVertical: 20,
    lineHeight: 24,
  },
});

export default TimelineScreen; 