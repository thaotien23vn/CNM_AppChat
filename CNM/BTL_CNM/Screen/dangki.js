import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const auth = getAuth();

  const handleRegister = async () => {
    if (!name.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập họ tên.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu và xác nhận mật khẩu không khớp.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      Alert.alert('Lỗi', 'Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await sendEmailVerification(user);

      await setDoc(doc(db, 'Users', user.uid), {
        user_id: user.uid,
        email: user.email,
        fullName: name,
        img: '',
        status: 'offline',
        lastSeen: new Date()
      });

      Alert.alert('Thành công', 'Email xác minh đã được gửi!');
      navigation.navigate('Otp', { email });

    } catch (error) {
      console.error(error);
      Alert.alert('Lỗi', error.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.mainRegister}>
      <LinearGradient
        colors={['#4c669f', '#3b5998', '#192f6a']}
        style={styles.headerGradient}
      >
        <Text style={styles.title}>ZaLo</Text>
        <Text style={styles.subtitle}>Tạo tài khoản mới</Text>
      </LinearGradient>

      <View style={styles.cardRegister}>
        <View style={styles.inputGroup}>
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={20} color="#4c669f" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Nhập họ tên"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={20} color="#4c669f" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Nhập email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color="#4c669f" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Nhập mật khẩu"
              placeholderTextColor="#999"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.inputWrapper}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#4c669f" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Xác nhận mật khẩu"
              placeholderTextColor="#999"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.btnRegister} onPress={handleRegister}>
          <LinearGradient
            colors={['#4c669f', '#3b5998', '#192f6a']}
            style={styles.btnGradient}
          >
            <Text style={styles.btnText}>ĐĂNG KÝ</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.loginLink}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginText}>Đã có tài khoản? Đăng nhập ngay</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mainRegister: {
    flexGrow: 1,
    backgroundColor: '#f5f5f5',
  },
  headerGradient: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 15,
  },
  cardRegister: {
    width: '90%',
    alignSelf: 'center',
    marginTop: -15,
    padding: 20,
    backgroundColor: '#ffffff',
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
  inputGroup: {
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
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
  btnRegister: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  btnGradient: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  loginLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  loginText: {
    color: '#4c669f',
    fontSize: 14,
    fontWeight: '600',
  },
});
