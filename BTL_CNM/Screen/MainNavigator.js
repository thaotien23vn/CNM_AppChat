import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from './UserContext';

// Import các màn hình chính
import ChatsScreen from './ChatsScreen';
import ContactsScreen from './ContactsScreen';
import TimelineScreen from './TimelineScreen';
import ProfileScreen from './ProfileScreen';
import AddFriendScreen from './AddFriendScreen';
import EditProfileScreen from './EditProfile';
import FriendRequestsScreen from './FriendRequestsScreen';
import CreateGroup from './CreateGroup';
import ChatGroup from './ChatGroup';
import GroupsScreen from './GroupsScreen';
import CloudScreen from './CloudScreen';

const Tab = createBottomTabNavigator();

export default function MainNavigator() {
  const { user, isEditing } = useUser();
  const [isEditingState, setIsEditingState] = useState(false);

  const EditProfileWrapper = (props) => (
    <EditProfileScreen {...props} setIsEditing={setIsEditingState} />
  );

  const ProfileWrapper = (props) => (
    <ProfileScreen {...props} setIsEditing={setIsEditingState} />
  );

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case 'Contacts':
              iconName = focused ? 'people' : 'people-outline';
              break;
            case 'Groups':
              iconName = focused ? 'people-circle' : 'people-circle-outline';
              break;
            case 'AddFriend':
              iconName = focused ? 'person-add' : 'person-add-outline';
              break;
            case 'Timeline':
              iconName = focused ? 'compass' : 'compass-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            case 'Cloud':
              iconName = focused ? 'cloud' : 'cloud-outline';
              break;
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#27548A',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
        },
        headerStyle: {
          backgroundColor: '#27548A',
        },
        headerTintColor: '#FFFFFF',
      })}
    >
      <Tab.Screen name="Chats" component={ChatsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="AddFriend" component={AddFriendScreen} options={{ title: 'Kết bạn' , tabBarVisible: false, tabBarButton: () => null }} />
      <Tab.Screen name="Contacts" component={ContactsScreen} options={{ title: 'Bạn bè' }} />
      <Tab.Screen name="Groups" component={GroupsScreen} options={{ title: 'Nhóm' }} />
      <Tab.Screen name="Cloud" component={CloudScreen} options={{
        title: 'Cloud lưu trữ',
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={focused ? 'cloud' : 'cloud-outline'} size={size} color={color} />
        ),
      }} />
      <Tab.Screen name="Timeline" component={TimelineScreen} options={{ title: 'Khám Phá' }} />
      <Tab.Screen name="Profile" component={ProfileWrapper} options={{ title: 'Cá nhân', tabBarStyle: { display: isEditingState ? 'none' : 'flex' } }} />
      <Tab.Screen name="EditProfile" component={EditProfileWrapper} options={{ title: 'Chỉnh Sửa', tabBarVisible: false, tabBarButton: () => null }} />
      <Tab.Screen name="FriendRequests" component={FriendRequestsScreen} options={{title: 'Lời mời kết bạn ', tabBarVisible:false, tabBarButton: ()=> null}} />
      <Tab.Screen 
        name="CreateGroup" 
        component={CreateGroup} 
        options={{ 
          title: 'Tạo nhóm',
          tabBarVisible: false,
          tabBarButton: () => null 
        }} 
      />
      <Tab.Screen 
        name="ChatGroup" 
        component={ChatGroup} 
        options={{ 
          title: 'Nhóm chat',
          tabBarVisible: false,
          tabBarButton: () => null 
        }} 
      />
    </Tab.Navigator>
  );
}
