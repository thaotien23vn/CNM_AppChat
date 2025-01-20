// BTL_KienTruc/App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from './Screen/login';
import RegisterScreen from './Screen/dangki';
import ForgotPasswordScreen from './Screen/quenmatkhau';
import MainNavigator from './Screen/MainNavigator';
import { AuthProvider } from './AuthContext/AuthContext'; // Import AuthProvider
import { UserProvider } from './Screen/UserContext'; // Import UserProvider
import OtpScreen from './Screen/otp'; // Import OtpScreen
import { Provider as PaperProvider } from 'react-native-paper';
const Stack = createStackNavigator();

export default function App() {
  return (
    <PaperProvider>
 <AuthProvider>
      <UserProvider>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Login">
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Đăng ký' }} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Quên mật khẩu' }} />
            <Stack.Screen name="MainApp" component={MainNavigator} options={{ headerShown: false }} />
            <Stack.Screen name="Otp" component={OtpScreen} options={{ title: 'Xác thực OTP' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </UserProvider>
    </AuthProvider>
    </PaperProvider>
   
  );
}