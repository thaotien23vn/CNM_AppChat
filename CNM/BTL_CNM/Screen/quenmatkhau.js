import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import Icon from 'react-native-vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Lỗi', 'Vui lòng nhập email.');
      return;
    }
    // đặt lại mật khẩu 
    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Thành công', 'Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Lỗi', error.message);
    }
  };

  return (
    <LinearGradient
      colors={['#93C5FD', '#3b5998', '#192f6a']}
      style={styles.container}
    >
      <View style={styles.overlay}>
        <Text style={styles.appTitle}>VibeChat</Text>
        <View style={styles.formCard}>
          <View style={styles.header}>
            <Text style={styles.title}>Quên mật khẩu</Text>
            <Text style={styles.subtitle}>
              Vui lòng nhập email đã đăng ký để nhận link đặt lại mật khẩu
            </Text>
          </View>
          
          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Icon name="envelope" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Nhập email của bạn"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#aaa"
              />
            </View>
            
            <TouchableOpacity onPress={handleForgotPassword} style={styles.button}>
              <LinearGradient
                colors={['#4c669f', '#3b5998', '#192f6a']}
                style={styles.btnGradient}
              >
                <Text style={styles.buttonText}>GỬI LINK ĐẶT LẠI MẬT KHẨU</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          
          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.linkContainer} 
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-left" size={18} color="#3f15d6" />
              <Text style={styles.link}>Quay lại đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  appTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 40,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  formCard: {
    width: '100%',
    maxWidth: 400,
    padding: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  formContainer: {
    width: '100%',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    marginBottom: 25,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#e1e4e8',
    height: 55,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#333',
  },
  button: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  btnGradient: {
    padding: 15,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
  footer: {
    marginTop: 30,
    alignItems: 'center',
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  link: {
    color: '#3f15d6',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
});