import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Linking } from 'react-native';

/**
 * Platform-safe document picker
 * Falls back to a simple alert on web if DocumentPicker isn't available
 */
export const pickDocument = async (options = {}) => {
  try {
    // On web, check if DocumentPicker is fully supported
    if (Platform.OS === 'web') {
      if (!DocumentPicker.getDocumentAsync) {
        // If DocumentPicker isn't available on web, we'll use the browser's file input
        return new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = options.type ? options.type.join(',') : '*/*';
          
          input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) {
              resolve({ canceled: true });
              return;
            }
            
            // Create a structure similar to Expo's DocumentPicker response
            resolve({
              canceled: false,
              assets: [{
                name: file.name,
                size: file.size,
                uri: URL.createObjectURL(file),
                mimeType: file.type,
              }]
            });
          };
          
          input.click();
        });
      }
    }
    
    // Use standard Expo DocumentPicker on supported platforms
    return await DocumentPicker.getDocumentAsync({
      type: options.type || ['*/*'],
      copyToCacheDirectory: true,
    });
  } catch (error) {
    console.error('Error picking document:', error);
    return { canceled: true, error };
  }
};

/**
 * Open a URL based on platform
 */
export const openURL = (url) => {
  if (Platform.OS === 'web') {
    window.open(url, '_blank');
  } else {
    // Use proper Linking API for native platforms
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        console.error('Cannot open URL:', url);
        alert('Cannot open this URL: ' + url);
      }
    }).catch(err => {
      console.error('Error opening URL:', err);
    });
  }
};

/**
 * Check if video features are supported on this platform
 */
export const isVideoSupported = () => {
  // Video is not fully supported in React Native Web
  return Platform.OS !== 'web';
};

/**
 * Get media picker options based on platform
 */
export const getMediaPickerOptions = () => {
  const options = {
    quality: 0.8,
    includeBase64: false,
    selectionLimit: 1,
  };
  
  // On web, we can only pick photos reliably
  if (Platform.OS === 'web') {
    options.mediaType = 'photo';
  } else {
    options.mediaType = 'mixed';  // Allow both photos and videos on native
  }
  
  return options;
}; 