import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useUser } from './UserContext';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db, storage } from '../Firebase/Firebase';
import uuid from 'react-native-uuid';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function EditProfile({ navigation }) {
  const { user, setUser, setIsEditing } = useUser();
  const [isLoading, setIsLoading] = useState(true);

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>Đang tải thông tin người dùng...</Text>
      </View>
    );
  }

  const [name, setName] = useState(user.fullName || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [address, setAddress] = useState(user.address || '');
  const [avatarUrl, setAvatarUrl] = useState(user.img || 'https://www.kindpng.com/picc/m/22-223863_no-avatar-png-circle-transparent-png.png');
  const [errors, setErrors] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  
  // Hàm trợ giúp để lấy ID người dùng từ các thuộc tính khác nhau
  const getUserId = () => {
    console.log('Thông tin người dùng hiện tại:', JSON.stringify(user, null, 2));
    if (!user) return null;
    
    // Thử lấy ID từ các thuộc tính khác nhau
    const possibleId = user.id || user.uid || user._id;
    
    if (possibleId) {
      console.log('Tìm thấy ID người dùng:', possibleId);
      return possibleId;
    }
    
    // Nếu không thể tìm thấy ID và có email, sử dụng email làm ID thay thế
    if (user.email) {
      const emailBasedId = user.email.replace(/[^a-zA-Z0-9]/g, '_');
      console.log('Sử dụng ID từ email:', emailBasedId);
      return emailBasedId;
    }
    
    console.log('Không tìm thấy ID người dùng trong đối tượng người dùng');
    return null;
  };

  // Lấy dữ liệu người dùng từ Firebase khi component được mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userId = getUserId();
        if (userId) {
          console.log('Đang lấy dữ liệu người dùng với ID:', userId);
          const userDocRef = doc(db, 'Users', userId); 
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('Dữ liệu người dùng đã được lấy:', userData);
            setName(userData.name || '');
            setEmail(userData.email || '');
            setPhone(userData.phone || '');
            setAddress(userData.address || '');
            setAvatarUrl(userData.img || 'https://www.kindpng.com/picc/m/22-223863_no-avatar-png-circle-transparent-png.png');
          } else {
            console.log('Tài liệu người dùng không tồn tại trong Firestore');
          }
        } else {
          console.log('Không có ID người dùng:', user);
        }
      } catch (error) {
        console.error('Lỗi khi lấy dữ liệu người dùng:', error);
        Alert.alert('Lỗi', 'Không thể tải thông tin người dùng');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserData();
  }, [user]);

  const validateForm = () => {
    let isValid = true;
    const newErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Vui lòng nhập họ tên';
      isValid = false;
    }

    if (!email.trim()) {
      newErrors.email = 'Vui lòng nhập email';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email không hợp lệ';
      isValid = false;
    }

    if (!phone.trim()) {
      newErrors.phone = 'Vui lòng nhập số điện thoại';
      isValid = false;
    } else if (!/^[0-9]{10,11}$/.test(phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Số điện thoại không hợp lệ';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const pickImage = async () => {
    try {
      // Kiểm tra kích thước file tối đa (5MB)
      const MAX_FILE_SIZE = 5 * 1024 * 1024;
      
      // Yêu cầu quyền truy cập thư viện ảnh
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Lỗi', 'Cần quyền truy cập thư viện ảnh để thực hiện chức năng này');
        return;
      }

      // Mở thư viện ảnh để chọn
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });
      
      console.log('Kết quả chọn ảnh:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploading(true);
        try {
          const selectedAsset = result.assets[0];
          console.log('Tài sản đã chọn:', selectedAsset);
          
          // Kiểm tra kích thước file nếu có thông tin
          if (selectedAsset.fileSize && selectedAsset.fileSize > MAX_FILE_SIZE) {
            throw new Error('Ảnh không được lớn hơn 5MB');
          }

          // Kiểm tra xem storage đã được khởi tạo chưa
          if (!storage) {
            throw new Error('Firebase Storage chưa được khởi tạo');
          }

          // Tạo blob từ URI
          const response = await fetch(selectedAsset.uri);
          const blob = await response.blob();
          
          // Kiểm tra kích thước blob
          if (blob.size > MAX_FILE_SIZE) {
            throw new Error('Ảnh không được lớn hơn 5MB');
          }
          
          // Tạo tên file duy nhất với uuid và user ID
          const userIdForFile = getUserId();
          const fileName = `avatar_${userIdForFile || uuid.v4()}_${Date.now()}.jpg`;
          const storageRef = ref(storage, `avatars/${fileName}`);
          
          // Tải ảnh lên Firebase Storage
          console.log('Đang tải lên Firebase...');
          const uploadResult = await uploadBytes(storageRef, blob);
          console.log('Tải lên thành công:', uploadResult);
          
          // Lấy URL download
          const downloadURL = await getDownloadURL(storageRef);
          console.log('URL tải xuống:', downloadURL);
          
          // Cập nhật state với URL mới
          setAvatarUrl(downloadURL);
          
          // Cập nhật ảnh đại diện trong Firebase
          if (userIdForFile) {
            const userDocRef = doc(db, 'Users', userIdForFile); // Đã thay đổi 'users' thành 'Users' để khớp với login.js
            await updateDoc(userDocRef, { img: downloadURL });
          }
          
          Alert.alert('Thành công', 'Ảnh đại diện đã được cập nhật');
        } catch (uploadError) {
          console.error('Lỗi tải lên:', uploadError);
          Alert.alert('Lỗi upload', 'Không thể tải ảnh lên Firebase: ' + uploadError.message);
          // Fallback: Sử dụng URI cục bộ nếu không upload được
          const selectedAsset = result.assets[0];
          setAvatarUrl(selectedAsset.uri);
        } finally {
          setIsUploading(false);
        }
      }
    } catch (error) {
      console.error('Lỗi khi chọn ảnh:', error);
      Alert.alert('Lỗi', 'Không thể chọn ảnh: ' + error.message);
      setIsUploading(false);
    }
  };

  const updateUserInFirebase = async (userData) => {
    try {
      // Lấy ID người dùng hoặc tạo một ID tạm thời nếu không có
      let userId = getUserId();
      
      // Nếu vẫn không có ID, tạo một ID tạm thời
      if (!userId) {
        userId = 'user_' + new Date().getTime();
        console.log('Tạo ID người dùng tạm thời:', userId);
        
        // Cập nhật đối tượng người dùng với ID này để sử dụng sau
        if (user) {
          setUser({ ...user, id: userId });
        }
      }
      
      console.log('Đang cập nhật dữ liệu người dùng với ID:', userId);
      const userDocRef = doc(db, 'Users', userId); // Đã thay đổi 'users' thành 'Users' để khớp với login.js
      
      // Kiểm tra nếu tài liệu đã tồn tại
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        console.log('Đang cập nhật tài liệu người dùng hiện tại');
        // Cập nhật tài liệu đã tồn tại
        await updateDoc(userDocRef, userData);
      } else {
        console.log('Đang tạo tài liệu người dùng mới');
        // Tạo tài liệu mới
        await setDoc(userDocRef, userData);
      }
      
      return true;
    } catch (error) {
      console.error('Lỗi khi cập nhật người dùng trong Firebase:', error);
      return false;
    }
  };

  const handleSave = async () => {
    if (validateForm()) {
      setIsLoading(true);
      
      // Lấy hoặc tạo ID người dùng
      const userId = getUserId() || ('user_' + new Date().getTime());
      
      // Chuẩn bị dữ liệu người dùng để cập nhật
      const userData = {
        name,
        email,
        phone,
        address,
        img: avatarUrl,
        updatedAt: new Date().toISOString(),
        id: userId // Đảm bảo ID có mặt trong dữ liệu
      };
      
      // Cập nhật trong Firebase
      const success = await updateUserInFirebase(userData);
      
      if (success) {
        // Cập nhật state địa phương
        setUser({
          ...user,
          ...userData
        });
        
        setIsEditing(false);
        Alert.alert('Thành công', 'Thông tin đã được cập nhật');
        navigation.goBack();
      } else {
        Alert.alert('Lỗi', 'Không thể cập nhật thông tin. Vui lòng thử lại sau.');
      }
      
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.avatarContainer}>
          <Image
            style={styles.avatar}
            source={{ uri: avatarUrl }}
          />
          {isUploading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#4c669f" />
              <Text style={styles.loadingText}>Đang tải ảnh lên...</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.changeAvatarButton} onPress={pickImage}>
              <LinearGradient
                colors={['#4c669f', '#3b5998']}
                style={styles.changeAvatarGradient}
              >
                <Ionicons name="camera-outline" size={20} color="#fff" />
                <Text style={styles.changeAvatarText}>Đổi ảnh đại diện</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Họ tên</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color="#4c669f" style={styles.inputIcon} />
              <TextInput 
                style={[styles.input, errors.name && styles.inputError]} 
                placeholder="Nhập họ tên của bạn"
                placeholderTextColor="#999"
                value={name} 
                onChangeText={setName} 
              />
            </View>
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#4c669f" style={styles.inputIcon} />
              <TextInput 
                style={[styles.input, errors.email && styles.inputError]} 
                placeholder="Nhập địa chỉ email"
                placeholderTextColor="#999"
                value={email} 
                onChangeText={setEmail} 
                keyboardType="email-address" 
              />
            </View>
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Số điện thoại</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="call-outline" size={20} color="#4c669f" style={styles.inputIcon} />
              <TextInput 
                style={[styles.input, errors.phone && styles.inputError]} 
                placeholder="Nhập số điện thoại"
                placeholderTextColor="#999"
                value={phone} 
                onChangeText={setPhone} 
                keyboardType="phone-pad" 
              />
            </View>
            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Địa chỉ</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="location-outline" size={20} color="#4c669f" style={styles.inputIcon} />
              <TextInput 
                style={[styles.input, { height: 80 }]} 
                placeholder="Nhập địa chỉ của bạn"
                placeholderTextColor="#999"
                value={address} 
                onChangeText={setAddress} 
                multiline={true}
                numberOfLines={3}
              />
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <LinearGradient
                colors={['#4c669f', '#3b5998', '#192f6a']}
                style={styles.saveGradient}
              >
                <Text style={styles.saveButtonText}>Lưu thay đổi</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 30,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  changeAvatarButton: {
    marginTop: 15,
    overflow: 'hidden',
    borderRadius: 25,
  },
  changeAvatarGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  changeAvatarText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  formContainer: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 15,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333',
  },
  inputError: {
    borderColor: '#ff6b6b',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    marginTop: 5,
    marginLeft: 5,
  },
  loadingContainer: {
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingText: {
    color: '#4c669f',
    marginLeft: 10,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  cancelButton: {
    flex: 1,
    marginRight: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  saveButton: {
    flex: 1,
    marginLeft: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveGradient: {
    paddingVertical: 15,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
