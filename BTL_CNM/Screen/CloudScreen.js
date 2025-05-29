import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image } from 'react-native';
import { IconButton, Modal, Portal, Button, ProgressBar, TextInput, Chip, FAB } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import { db } from '../Firebase/Firebase';
import { getAuth } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function CloudScreen() {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileType, setFileType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);

  // Fetch user's files
  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    const filesQuery = query(
      collection(db, 'CloudFiles'),
      where('userId', '==', currentUser.uid)
    );
    const unsubscribe = onSnapshot(filesQuery, (snapshot) => {
      const filesData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          uploadedAt: data.uploadedAt?.toDate ? data.uploadedAt.toDate() : new Date(data.uploadedAt)
        };
      });
      filesData.sort((a, b) => b.uploadedAt - a.uploadedAt);
      setFiles(filesData);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      Alert.alert('Lỗi', 'Không thể tải file');
    });
    return () => unsubscribe();
  }, [currentUser]);

  // File picker
  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const file = result.assets[0];
      if (file.size > 10 * 1024 * 1024) {
        Alert.alert('Lỗi', 'File không được vượt quá 10MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  // Upload file
  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    try {
      const storage = getStorage();
      const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
      const fileName = `cloud/${currentUser.uid}/${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, fileName);

      const response = await fetch(selectedFile.uri);
      const blob = await response.blob();

      const uploadTask = uploadBytesResumable(storageRef, blob);

      uploadTask.on('state_changed',
        (snapshot) => {
          setUploadProgress(snapshot.bytesTransferred / snapshot.totalBytes);
        },
        (error) => {
          setIsUploading(false);
          Alert.alert('Lỗi', 'Tải lên thất bại');
        },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, 'CloudFiles'), {
            userId: currentUser.uid,
            fileName: selectedFile.name,
            fileType: selectedFile.mimeType || selectedFile.type || '',
            fileSize: selectedFile.size,
            downloadUrl,
            storagePath: fileName,
            uploadedAt: serverTimestamp()
          });
          setShowUpload(false);
          setSelectedFile(null);
          setUploadProgress(0);
          setIsUploading(false);
          Alert.alert('Thành công', 'Tải lên thành công');
        }
      );
    } catch (error) {
      setIsUploading(false);
      Alert.alert('Lỗi', 'Tải lên thất bại');
    }
  };

  // Delete file
  const handleDeleteFile = async () => {
    if (!fileToDelete) return;
    try {
      const storage = getStorage();
      const storageRef = ref(storage, fileToDelete.storagePath);
      await deleteObject(storageRef);
      await deleteDoc(doc(db, 'CloudFiles', fileToDelete.id));
      setShowDelete(false);
      setFileToDelete(null);
      Alert.alert('Thành công', 'Đã xóa file');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể xóa file');
    }
  };

  // Download file
  const handleDownload = async (file) => {
    try {
      Alert.alert('Tải xuống', 'Tính năng tải file sẽ mở link trên trình duyệt.');
      // Linking.openURL(file.downloadUrl);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tải file');
    }
  };

  // Helpers
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleString('vi-VN');
  };

  // Filter files
  const filteredFiles = files.filter(file => {
    const matchesType = fileType === 'all' ||
      (fileType === 'images' && file.fileType.startsWith('image/')) ||
      (fileType === 'videos' && file.fileType.startsWith('video/')) ||
      (fileType === 'documents' && !file.fileType.startsWith('image/') && !file.fileType.startsWith('video/'));
    const matchesSearch = file.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
      </View>
      <View style={styles.filterRow}>
        <TextInput
          mode="outlined"
          placeholder="Tìm kiếm file..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />
      </View>
      <View style={styles.chipRow}>
        <Chip selected={fileType === 'all'}
          onPress={() => setFileType('all')}
          style={[styles.chip, fileType === 'all' && styles.selectedChip]}
          textStyle={fileType === 'all' ? styles.selectedChipText : styles.chipText}
        >Tất cả</Chip>
        <Chip selected={fileType === 'images'}
          onPress={() => setFileType('images')}
          style={[styles.chip, fileType === 'images' && styles.selectedChip]}
          textStyle={fileType === 'images' ? styles.selectedChipText : styles.chipText}
        >Ảnh</Chip>
        <Chip selected={fileType === 'videos'}
          onPress={() => setFileType('videos')}
          style={[styles.chip, fileType === 'videos' && styles.selectedChip]}
          textStyle={fileType === 'videos' ? styles.selectedChipText : styles.chipText}
        >Video</Chip>
        <Chip selected={fileType === 'documents'}
          onPress={() => setFileType('documents')}
          style={[styles.chip, fileType === 'documents' && styles.selectedChip]}
          textStyle={fileType === 'documents' ? styles.selectedChipText : styles.chipText}
        >Tài liệu</Chip>
      </View>
      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 40 }} />
      ) : filteredFiles.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cloud-outline" size={64} color="#bdbdbd" style={{ marginBottom: 12 }} />
          <Text style={styles.emptyText}>Chưa có file nào trong Cloud</Text>
        </View>
      ) : (
        <FlatList
          data={filteredFiles}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 80 }}
          renderItem={({ item }) => (
            <View style={styles.fileCard}>
              {item.fileType.startsWith('image/') ? (
                <Image source={{ uri: item.downloadUrl }} style={styles.fileImage} />
              ) : item.fileType.startsWith('video/') ? (
                <View style={[styles.fileImage, { backgroundColor: '#e3f2fd' }]}><Ionicons name="videocam" size={36} color="#1976d2" /></View>
              ) : (
                <View style={[styles.fileImage, { backgroundColor: '#f3e5f5' }]}><Ionicons name="document-text" size={36} color="#8e24aa" /></View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName} numberOfLines={1}>{item.fileName}</Text>
                <Text style={styles.fileInfo}>{formatFileSize(item.fileSize)} • {formatDate(item.uploadedAt)}</Text>
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  <IconButton icon="download" size={24} onPress={() => handleDownload(item)} style={styles.actionIcon} />
                  <IconButton icon="delete" size={24} onPress={() => { setFileToDelete(item); setShowDelete(true); }} style={styles.actionIcon} />
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* Floating Upload Button */}
      <FAB
        style={styles.fab}
        icon="upload"
        color="#fff"
        onPress={() => setShowUpload(true)}
        label="Tải lên"
      />

      {/* Upload Modal */}
      <Portal>
        <Modal visible={showUpload} onDismiss={() => setShowUpload(false)} contentContainerStyle={styles.modal}>
          <View style={{ alignItems: 'center' }}>
            <Ionicons name="cloud-upload" size={48} color="#3f15d6" style={{ marginBottom: 10 }} />
            <Text style={styles.modalTitle}>Tải file lên Cloud</Text>
          </View>
          <Button icon="file" mode="outlined" onPress={pickFile} style={{ marginVertical: 16, borderRadius: 12 }}>
            {selectedFile ? selectedFile.name : 'Chọn file'}
          </Button>
          {isUploading && (
            <ProgressBar progress={uploadProgress} color="#3f15d6" style={{ marginVertical: 8, borderRadius: 8 }} />
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
            <Button onPress={() => setShowUpload(false)} disabled={isUploading} style={{ borderRadius: 8 }}>Hủy</Button>
            <Button mode="contained" onPress={handleUpload} disabled={!selectedFile || isUploading} style={{ marginLeft: 12, borderRadius: 8, backgroundColor: '#3f15d6' }}>
              {isUploading ? 'Đang tải...' : 'Tải lên'}
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Delete Modal */}
      <Portal>
        <Modal visible={showDelete} onDismiss={() => setShowDelete(false)} contentContainerStyle={styles.modal}>
          <View style={{ alignItems: 'center' }}>
            <Ionicons name="trash" size={40} color="#e53935" style={{ marginBottom: 10 }} />
            <Text style={styles.modalTitle}>Xóa file</Text>
          </View>
          <Text style={{ textAlign: 'center', marginVertical: 10 }}>Bạn có chắc muốn xóa file này không?</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
            <Button onPress={() => setShowDelete(false)} style={{ borderRadius: 8 }}>Hủy</Button>
            <Button mode="contained" onPress={handleDeleteFile} style={{ marginLeft: 12, borderRadius: 8, backgroundColor: '#e53935' }}>
              Xóa
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7', padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  uploadButton: { borderRadius: 12, elevation: 2, backgroundColor: '#3f15d6' },
  filterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  searchInput: { flex: 1, marginRight: 8, borderRadius: 12, backgroundColor: '#fff' },
  chipRow: { flexDirection: 'row', marginBottom: 10 },
  chip: {
    marginRight: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e3eafc',
  },
  selectedChip: {
    backgroundColor: '#e3eafc',
    borderColor: '#3f15d6',
  },
  selectedChipText: {
    color: '#3f15d6',
    fontWeight: 'bold',
  },
  chipText: {
    color: '#333',
    fontWeight: 'bold',
  },
  fileCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 18, marginBottom: 16, padding: 14, alignItems: 'center', elevation: 4, shadowColor: '#3f15d6', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  fileImage: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#eee', marginRight: 16, justifyContent: 'center', alignItems: 'center' },
  fileName: { fontWeight: 'bold', fontSize: 17, color: '#222' },
  fileInfo: { color: '#888', fontSize: 13, marginTop: 2 },
  actionIcon: { margin: 0, padding: 0 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#bdbdbd', fontSize: 18, marginTop: 8 },
  modal: { backgroundColor: 'white', padding: 24, margin: 24, borderRadius: 16 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: '#3f15d6' },
  fab: { position: 'absolute', right: 24, bottom: 32, backgroundColor: '#3f15d6', borderRadius: 32, elevation: 6, zIndex: 10 }
}); 