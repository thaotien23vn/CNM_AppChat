import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';

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
    <View style={styles.container}>
      <Text style={styles.title}>Quên mật khẩu</Text>
      <TextInput
        style={styles.input}
        placeholder="Nhập email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholderTextColor="#aaa"
      />
      <TouchableOpacity style={styles.button} onPress={handleForgotPassword}>
        <Text style={styles.buttonText}>GỬI LINK ĐẶT LẠI MẬT KHẨU</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.link}>← Quay lại đăng nhập</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
     flex: 1, 
     justifyContent: 'center',
      alignItems: 'center',
       padding: 20,
       backgroundColor: '#f1f1f1'
       },
  title: { 
    fontSize: 26,
     fontWeight: 'bold',
      marginBottom: 30,
       color: '#0078FF'
       },
  input: {
     width: '100%',
      padding: 15, 
      borderWidth: 1, 
      borderColor: '#0078FF', 
      borderRadius: 10,
       backgroundColor: '#fff',
        marginBottom: 20 
      },
  button: {
     backgroundColor: '#0078FF',
      padding: 15,
       borderRadius: 10,
        width: '100%',
         alignItems: 'center'
         },
  buttonText: {
     color: '#fff', 
     fontWeight: 'bold' 
    },
  link: {
     color: '#0078FF', 
     marginTop: 15 
    },
});
