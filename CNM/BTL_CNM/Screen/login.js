import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ImageBackground, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const auth = getAuth();
  const { setUser } = useUser(); // ✅ lấy hàm setUser từ UserContext

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    try {
      console.log('Đang đăng nhập với email:', email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      if (!user || !user.uid) {
        Alert.alert('Lỗi', 'Không thể lấy thông tin người dùng');
        return;
      }

      console.log('Đăng nhập thành công, UID:', user.uid);
      
      // 🔥 Lấy dữ liệu user từ Firestore
      try {
        console.log(user.uid);
        const userDoc = await getDoc(doc(db, 'Users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('Dữ liệu người dùng:', userData);
          setUser(userData); // ✅ Cập nhật vào UserContext
        } else {
          console.log('Không tìm thấy dữ liệu người dùng trong Firestore');
          // Tạo dữ liệu người dùng cơ bản nếu không tồn tại
          setUser({
            id: user.uid,
            email: user.email,
            name: user.displayName || email.split('@')[0],
            avatarUrl: user.photoURL || 'https://img-cdn.2game.vn/pictures/2game/2019/10/09/2game-natra-ma-dong-h5-logo-1.png'
          });
        }
        
        navigation.navigate('MainApp'); // ✅ Điều hướng sang màn hình chính
      } catch (firestoreError) {
        console.error('Lỗi khi truy cập Firestore:', firestoreError);
        Alert.alert('Lỗi', 'Không thể lấy thông tin người dùng từ cơ sở dữ liệu');
      }
    } catch (error) {
      console.error('Lỗi đăng nhập:', error);
      
      let errorMessage = 'Đăng nhập thất bại';
      if (error.code === 'auth/invalid-email') {
        errorMessage = 'Email không hợp lệ';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'Không tìm thấy tài khoản với email này';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Mật khẩu không chính xác';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau';
      }
      
      Alert.alert('Lỗi', errorMessage);
    }
  };

  return (
    <LinearGradient
      colors={['#93C5FD', '#3b5998', '#192f6a']}
      style={styles.mainLogin}
    >
      <View style={styles.overlay}>
        <Text style={styles.title}>ZaLo</Text>
        <View style={styles.cardLogin}>
          <Text style={styles.loginTitle}>Đăng Nhập</Text>
          <View style={styles.inputContainer}>
            <TextInput 
              style={styles.input} 
              placeholder="Nhập email" 
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View style={styles.inputContainer}>
            <TextInput 
              style={styles.input} 
              placeholder="Nhập mật khẩu" 
              placeholderTextColor="#666"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>
          <TouchableOpacity onPress={handleLogin} style={styles.btnLogin}>
            <LinearGradient
              colors={['#4c669f', '#3b5998', '#192f6a']}
              style={styles.btnGradient}
            >
              <Text style={styles.btnText}>ĐĂNG NHẬP</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotPasswordBtn}>
            <Text style={styles.link}>Quên mật khẩu?</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.orText}>HOẶC</Text>
            <View style={styles.line} />
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.registerBtn}>
            <Text style={styles.registerText}>Đăng ký tài khoản mới</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  mainLogin: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 40,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  cardLogin: {
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
  loginTitle: {
    textAlign: 'center',
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    height: 55,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  btnLogin: {
    marginTop: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  btnGradient: {
    padding: 15,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  forgotPasswordBtn: {
    marginTop: 20,
    alignItems: 'center',
  },
  link: {
    color: '#4c669f',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  orText: {
    marginHorizontal: 10,
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  registerBtn: {
    alignItems: 'center',
  },
  registerText: {
    color: '#4c669f',
    fontSize: 16,
    fontWeight: 'bold',
  },
});