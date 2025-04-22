import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Linking } from 'react-native';
import { Text, ActivityIndicator, IconButton } from 'react-native-paper';
import Icon from 'react-native-vector-icons/FontAwesome';
import Video from 'react-native-video';

const RenderFileMessage = ({ message, handleOpenFile }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Ensure we have a valid message
  if (!message) {
    return null;
  }
  
  // Check if there's a file URL or file name
  if (!message.url && !message.content) {
    return null;
  }

  // Handle sending status
  const isSending = message.status === 'sending';
  
  // Format the URL correctly
  const getFormattedUrl = (url) => {
    if (!url) return null;
    
    return url.startsWith('http') 
      ? url 
      : `http://localhost:4000${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // Check if temp file
  const isTempFile = (url) => {
    return url && url.startsWith('temp_file_');
  };

  // Video player component
  const VideoComponent = () => {
    if (!message.url || isSending || isTempFile(message.url)) {
      return (
        <View style={styles.videoPlaceholder}>
          <Icon name="video-camera" size={40} color="#FFFFFF" />
          {isSending && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator animating={true} color="#FFFFFF" size="large" />
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={styles.videoContainer}>
        <Video
          source={{ uri: getFormattedUrl(message.url) }}
          style={styles.video}
          controls={true}
          resizeMode="contain"
          onLoadStart={() => setIsLoading(true)}
          onLoad={() => setIsLoading(false)}
          onError={(e) => {
            console.error('Video loading error:', e);
            setError(true);
            setIsLoading(false);
          }}
        />
        
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator animating={true} color="#FFFFFF" size="large" />
          </View>
        )}
        
        {error && (
          <View style={styles.errorContainer}>
            <Icon name="exclamation-triangle" size={30} color="#FFFFFF" />
            <Text style={styles.errorText}>Không thể tải video</Text>
          </View>
        )}
        
        {/* Download button */}
        <IconButton
          icon="download"
          iconColor="#FFFFFF"
          style={styles.downloadButton}
          size={20}
          onPress={() => handleOpenFile(message.url, message.content, message.fileType)}
        />
      </View>
    );
  };

  // Image component
  const ImageComponent = () => {
    if (!message.url || isSending) {
      return (
        <View style={styles.imagePlaceholder}>
          <Icon name="image" size={40} color="#FFFFFF" />
          {isSending && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator animating={true} color="#FFFFFF" size="large" />
            </View>
          )}
        </View>
      );
    }

    return (
      <TouchableOpacity 
        style={styles.imageContainer}
        onPress={() => Linking.openURL(getFormattedUrl(message.url))}
      >
        <Image
          source={{ uri: getFormattedUrl(message.url) }}
          style={styles.image}
          onLoadStart={() => setIsLoading(true)}
          onLoad={() => setIsLoading(false)}
          onError={() => setError(true)}
        />
        
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator animating={true} color="#FFFFFF" size="large" />
          </View>
        )}
        
        {error && (
          <View style={styles.errorContainer}>
            <Icon name="exclamation-triangle" size={30} color="#FFFFFF" />
            <Text style={styles.errorText}>Không thể tải hình ảnh</Text>
          </View>
        )}
        
        {/* Download button */}
        <IconButton
          icon="download"
          iconColor="#FFFFFF"
          style={styles.downloadButton}
          size={20}
          onPress={() => handleOpenFile(message.url, message.content, message.fileType)}
        />
      </TouchableOpacity>
    );
  };

  // Audio component
  const AudioComponent = () => {
    return (
      <View style={styles.audioContainer}>
        <View style={styles.audioIconContainer}>
          <Icon name="music" size={30} color="#9c27b0" />
        </View>
        <View style={styles.audioDetails}>
          <Text variant="bodyMedium" style={styles.audioTitle}>
            {message.content || "Audio"}
          </Text>
          <Text variant="bodySmall" style={styles.audioStatus}>
            {isSending ? "Đang tải..." : "Nhấn để phát audio"}
          </Text>
        </View>
        {!isSending && (
          <IconButton
            icon="download"
            iconColor="#9c27b0"
            style={styles.audioButton}
            size={18}
            onPress={() => handleOpenFile(message.url, message.content, message.fileType)}
          />
        )}
      </View>
    );
  };

  // Render based on file type
  switch (message.type) {
    case 'video':
      return <VideoComponent />;
    
    case 'image':
      return <ImageComponent />;
      
    case 'audio':
      return <AudioComponent />;
    
    case 'file':
    default:
      // Default file rendering
      return (
        <TouchableOpacity 
          style={styles.fileContainer}
          onPress={() => message.url && !isSending && Linking.openURL(getFormattedUrl(message.url))}
        >
          <Icon name="file" size={24} color="#3f15d6" />
          <Text variant="bodyMedium" style={styles.fileName} numberOfLines={1}>
            {message.content || "File"}
          </Text>
          {isSending ? (
            <ActivityIndicator animating={true} color="#3f15d6" size="small" />
          ) : (
            <IconButton
              icon="download"
              iconColor="#3f15d6"
              style={styles.fileDownloadButton}
              size={18}
              onPress={() => handleOpenFile(message.url, message.content, message.fileType)}
            />
          )}
        </TouchableOpacity>
      );
  }
};

const styles = StyleSheet.create({
  // Video styles
  videoContainer: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#3f15d6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  
  // Image styles
  imageContainer: {
    position: 'relative',
    maxWidth: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: 250,
    height: 250,
    borderRadius: 8,
  },
  imagePlaceholder: {
    width: 250,
    height: 180,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  
  // Audio styles
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f0ff',
    padding: 12,
    borderRadius: 8,
    width: '100%',
    maxWidth: 350,
  },
  audioIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0e6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  audioDetails: {
    flex: 1,
  },
  audioTitle: {
    fontWeight: 'bold',
    color: '#333',
  },
  audioStatus: {
    color: '#666',
  },
  audioButton: {
    backgroundColor: '#f0e6ff',
    margin: 0,
  },
  
  // Common styles
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 14,
  },
  downloadButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    margin: 0,
  },
  
  // File styles
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    borderRadius: 10,
    padding: 12,
    paddingRight: 8,
  },
  fileName: {
    flex: 1,
    marginLeft: 10,
    color: '#333',
  },
  fileDownloadButton: {
    backgroundColor: '#e4e6eb',
    margin: 0,
  },
});

export default RenderFileMessage; 