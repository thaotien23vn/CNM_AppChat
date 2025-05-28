import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import axios from 'axios'; // Dùng để gửi OTP qua email

const generateUniqueCode = () => {
  const digits = new Set();
  while (digits.size < 6) {
    digits.add(Math.floor(Math.random() * 10));
  }
  return Array.from(digits).join('');
};

export default function OtpScreen({ navigation, route }) {
  const { email } = route.params; // Nhận email từ Register
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    const code = generateUniqueCode();
    setGeneratedOtp(code);
    sendOtpEmail(email, code);

    setIsExpired(false);
    setCountdown(60);

    const timer = setTimeout(() => {
      setIsExpired(true);
    }, 60000);

    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev === 1) clearInterval(countdownInterval);
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(countdownInterval);
    };
  }, []);

  const sendOtpEmail = async (email, code) => {
    try {
      await axios.post('http://192.168.8.83:3000/send-otp', { email, code }); // ⚠️ sửa lại đường dẫn API thật
      Alert.alert('Thành công', 'Mã OTP đã được gửi qua email.');
    } catch (error) {
      console.error(error);
      Alert.alert('Lỗi', 'Không thể gửi mã OTP. Vui lòng thử lại.');
    }
  };

  const handleResendOtp = () => {
    const newCode = generateUniqueCode();
    setGeneratedOtp(newCode);
    sendOtpEmail(email, newCode);
    setIsExpired(false);
    setCountdown(60);
  };

  const handleVerifyOtp = () => {
    if (isExpired) {
      Alert.alert('Lỗi', 'Mã OTP đã hết hạn.');
      return;
    }
    if (otp === generatedOtp) {
      Alert.alert('Thành công', 'Xác minh thành công!');
      navigation.replace('MainApp');
    } else {
      Alert.alert('Lỗi', 'Mã OTP không chính xác.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Xác minh OTP</Text>
      <Text style={styles.subText}>Mã đã gửi đến email: {email}</Text>

      <TextInput
        style={styles.input}
        placeholder="Nhập mã OTP"
        value={otp}
        onChangeText={setOtp}
        keyboardType="numeric"
        maxLength={6}
      />

      <TouchableOpacity style={styles.btnVerify} onPress={handleVerifyOtp}>
        <Text style={styles.btnText}>Xác nhận OTP</Text>
      </TouchableOpacity>

      <Text style={styles.countdown}>
        {isExpired ? 'Mã đã hết hạn.' : `Mã sẽ hết hạn sau: ${countdown}s`}
      </Text>

      <TouchableOpacity
        style={[styles.btnResend, isExpired ? {} : { backgroundColor: '#aaa' }]}
        onPress={handleResendOtp}
        disabled={!isExpired}
      >
        <Text style={styles.btnText}>Gửi lại mã OTP</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  subText: { fontSize: 16, color: '#555', marginBottom: 20 },
  input: {
    width: '80%',
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    backgroundColor: '#fff',
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 4,
  },
  btnVerify: {
    backgroundColor: '#27548A',
    padding: 15,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
    marginBottom: 10,
  },
  btnResend: {
    backgroundColor: '#6D28D9',
    padding: 12,
    borderRadius: 8,
    width: '80%',
    alignItems: 'center',
    marginTop: 10,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  countdown: { marginTop: 10, color: '#888', fontSize: 14 },
});
