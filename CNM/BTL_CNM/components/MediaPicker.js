import React, { useState } from 'react';
import { TouchableOpacity, Alert, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { pickDocument } from '../utils/platformUtils';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../Firebase/Firebase';
import uuid from 'react-native-uuid';
import { Video } from 'expo-av'; // Nếu bạn dùng expo để render video

const MESSAGE_COLLECTION = 'Messages';

const MediaPicker = ({ currentUserId, chatWithUserId, conversationId, onFileUploadStart, onFileUploadEnd, onProgress }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [videoUrl, setVideoUrl] = useState(null); // Trạng thái videoUrl khi tải lên thành công

    const uploadFile = async () => {
        if (!conversationId) {
            Alert.alert('Lỗi', 'Không thể xác định cuộc trò chuyện.');
            return;
        }

        try {
            // Use our platform-safe document picker
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

            // Check file size (limit to 20MB)
            if (asset.size > 20 * 1024 * 1024) {
                Alert.alert('File quá lớn', 'Vui lòng chọn file nhỏ hơn 20MB.');
                return;
            }

            setIsUploading(true);
            setUploadProgress(0);
            onFileUploadStart && onFileUploadStart();

            // Simulate progress updates
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress = Math.min(95, progress + 5);
                setUploadProgress(progress);
                onProgress && onProgress(progress);
            }, 500);

            // Determine file extension
            const fileExtension = asset.name.split('.').pop().toLowerCase() || '';
            const fileName = `${uuid.v4()}-${asset.name}`;
            const fileRef = ref(getStorage(), `files/${currentUserId}/${fileName}`);

            const responseBlob = await fetch(asset.uri);
            const blob = await responseBlob.blob();

            // Upload file to Firebase Storage
            await uploadBytes(fileRef, blob);
            clearInterval(progressInterval);
            setUploadProgress(100);
            onProgress && onProgress(100);

            const downloadURL = await getDownloadURL(fileRef);

            // Add file message to Firestore
            await addDoc(collection(db, MESSAGE_COLLECTION), {
                con_id: conversationId,
                sender_id: currentUserId,
                receiver_id: chatWithUserId,
                content: asset.name,
                type: 'file',
                url: downloadURL,
                fileSize: asset.size,
                fileType: asset.mimeType || `file/${fileExtension}`,
                createdAt: Date.now(),
                timestamp: Date.now(),
                isRevoked: false,
                seen: false
            });

            // Nếu là video (mp4, mp3), set videoUrl
            if (['mp4', 'mp3'].includes(fileExtension)) {
                setVideoUrl(downloadURL);
            }

            console.log('File uploaded successfully');
        } catch (error) {
            console.error('Error uploading file:', error);
            Alert.alert('Lỗi', 'Không thể tải lên file. Vui lòng thử lại.');
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
            onFileUploadEnd && onFileUploadEnd();
        }
    };

    return (
        <TouchableOpacity 
            onPress={uploadFile} 
            style={styles.uploadButton}
            disabled={isUploading}
        >
            {isUploading ? (
                <View style={styles.progressContainer}>
                    <ActivityIndicator size="small" color="#3f15d6" />
                    <Text style={styles.progressText}>{uploadProgress}%</Text>
                </View>
            ) : (
                <Icon name="file" size={22} color="#3f15d6" />
            )}
            {/* Nếu là video, render video player */}
            {videoUrl && (
                <View style={styles.videoContainer}>
                    <Video
                        source={{ uri: videoUrl }}
                        useNativeControls
                        resizeMode="contain"
                        style={styles.video}
                    />
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    uploadButton: { 
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 5,
    },
    progressContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressText: {
        fontSize: 10,
        color: '#3f15d6',
        marginTop: 2
    },
    videoContainer: {
        marginTop: 10,
        width: '100%',
        height: 200,
    },
    video: {
        width: '100%',
        height: '100%',
    }
});

export default MediaPicker;
