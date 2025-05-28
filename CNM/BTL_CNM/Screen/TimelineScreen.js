import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  FlatList,
  Dimensions
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Dữ liệu giả cho bài viết
const DUMMY_POSTS = [
  {
    id: '1',
    user: {
      name: 'Sài Gòn Của Tôi',
      avatar: 'https://i.pinimg.com/474x/d6/a9/8d/d6a98db26ae6b40fe1d1f831888232be.jpg',
      verified: true
    },
    content: 'Rạng rỡ Việt Nam, vẻ đẹp của độc lập tự do',
    image: 'https://scontent.fsgn2-10.fna.fbcdn.net/v/t39.30808-6/491824800_721056593585430_7084106927219503992_n.jpg?stp=cp6_dst-jpg_tt6&_nc_cat=1&ccb=1-7&_nc_sid=833d8c&_nc_eui2=AeEJXLeS8wrmmxuhecc9t4US3vyJtJmN3BLe_Im0mY3cEqCoRnqzw0giGL9Yz7LKZwMs98Yu4kRQ55yiIYc5gGNb&_nc_ohc=8xnBVOtCK1AQ7kNvwGlHj0X&_nc_oc=Adn-FrYDzWPop_yA9mo19m8SMGRqqAHqsRCn6s7iCXOWQcwJBjVnPVS2L_oKHmssGHERTYGC72aDjuXJUFktIsJ2&_nc_zt=23&_nc_ht=scontent.fsgn2-10.fna&_nc_gid=Qe5_tLiN7AYnfsloX510WA&oh=00_AfEwzq_QE9fVWhFtEd5I5YVCklT2IuwV-ygHqNBvaV2-8A&oe=6809B9C3',
    timestamp: '2 giờ trước',
    stats: {
      likes: 22186,
      comments: 247,
      shares: 2500
    }
  },
  {
    id: '2',
    user: {
      name: 'Du Lịch Việt',
      avatar: 'https://statics.vinpearl.com/international-travel-0_1684821084.jpg',
      verified: true
    },
    content: 'Ngắm hoàng hôn trên bãi biển Vũng Tàu tuyệt đẹp. Vũng Tàu đẹp nhất là khi chiều xuống, bãi biển vắng người và không khí trong lành 🌊🌅',
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS02rXjplndw-SzAt6q1q3MqspJScTtlMDGPg&s',
    timestamp: '5 giờ trước',
    stats: {
      likes: 15421,
      comments: 183,
      shares: 1204
    }
  },
  {
    id: '3',
    user: {
      name: 'Tin Tức 24h',
      avatar: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTd-9Tn0h0-BC0ukbSuK0PnemtSH1MZJFIc6w&s',
      verified: false
    },
    content: 'Hòa cùng không khí vui tươi, phấn khởi của đất nước đón chào Ngày “Non sông thống nhất” các đơn vị nghệ thuật thuộc Bộ VHTTDL tổ chức chuỗi chương trình nghệ thuật đặc biệt chào mừng 50 năm Ngày Giải phóng miền Nam, thống nhất đất nước với nhiều tiết mục, chương trình, vở diễn nghệ thuật hấp dẫn, thể hiện ý nghĩa, tầm vóc vĩ đại, giá trị to lớn của Đại thắng mùa Xuân năm 1975.',
    image: 'https://resource.kinhtedothi.vn/resources2025/1/users/186/14-fftq20250411113725-1744721829.jpg',
    timestamp: '1 ngày trước',
    stats: {
      likes: 8765,
      comments: 342,
      shares: 521
    }
  }
];

export default function TimelineScreen() {
  const [activeTab, setActiveTab] = useState('featured');
  const [likedPosts, setLikedPosts] = useState({});

  const toggleLike = (postId) => {
    setLikedPosts(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

  const renderPost = ({ item }) => (
    <View style={styles.postContainer}>
      <View style={styles.postHeader}>
        <View style={styles.userInfo}>
          <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
          <View>
            <View style={styles.nameContainer}>
              <Text style={styles.userName}>{item.user.name}</Text>
              {item.user.verified && (
                <Icon name="check-circle" size={16} color="#1DA1F2" style={styles.verifiedIcon} />
              )}
            </View>
            <Text style={styles.timestamp}>{item.timestamp}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.moreButton}>
          <Icon name="ellipsis-h" size={16} color="#666" />
        </TouchableOpacity>
      </View>

      <Text style={styles.postContent}>{item.content}</Text>

      <Image source={{ uri: item.image }} style={styles.postImage} />

      <View style={styles.statsContainer}>
        <View style={styles.reactions}>
          <View style={styles.reactionIcons}>
            <Icon name="thumbs-up" size={14} color="#fff" style={styles.reactionIcon} />
          </View>
          <Text style={styles.statsText}>{item.stats.likes.toLocaleString()}</Text>
        </View>
        <View style={styles.otherStats}>
          <Text style={styles.statsText}>{item.stats.comments} bình luận</Text>
          <Text style={styles.statsText}>{item.stats.shares} lượt chia sẻ</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => toggleLike(item.id)}
        >
          <Icon 
            name="thumbs-up" 
            size={18} 
            color={likedPosts[item.id] ? '#1877F2' : '#65676B'} 
          />
          <Text style={[styles.actionText, likedPosts[item.id] && styles.actionTextActive]}>Thích</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Icon name="comment" size={18} color="#65676B" />
          <Text style={styles.actionText}>Bình luận</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Icon name="share" size={18} color="#65676B" />
          <Text style={styles.actionText}>Chia sẻ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'featured' && styles.activeTab]}
          onPress={() => setActiveTab('featured')}
        >
          <Text style={[styles.tabText, activeTab === 'featured' && styles.activeTabText]}>
            Dành cho bạn
          </Text>
          {activeTab === 'featured' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'following' && styles.activeTab]}
          onPress={() => setActiveTab('following')}
        >
          <Text style={[styles.tabText, activeTab === 'following' && styles.activeTabText]}>
            Đang theo dõi
          </Text>
          {activeTab === 'following' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>
      </View>

      <FlatList
        data={DUMMY_POSTS}
        renderItem={renderPost}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.feed}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F0F2F5',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E6EB',
    backgroundColor: '#FFFFFF',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  activeTab: {
    borderBottomColor: '#27548A',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#65676B',
  },
  activeTabText: {
    color: '#27548A',
    fontWeight: 'bold',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    width: '50%',
    backgroundColor: '#27548A',
  },
  feed: {
    paddingBottom: 20,
  },
  postContainer: {
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E6EB',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#050505',
    marginRight: 4,
  },
  verifiedIcon: {
    marginTop: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#65676B',
  },
  moreButton: {
    padding: 8,
  },
  postContent: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    fontSize: 15,
    color: '#050505',
  },
  postImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
    resizeMode: 'cover',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  reactions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionIcons: {
    backgroundColor: '#1877F2',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },
  reactionIcon: {
    marginTop: 1,
  },
  otherStats: {
    flexDirection: 'row',
  },
  statsText: {
    fontSize: 13,
    color: '#65676B',
    marginHorizontal: 5,
  },
  divider: {
    height: 1,
    backgroundColor: '#E4E6EB',
    marginHorizontal: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 30,
    borderRadius: 5,
  },
  actionText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '500',
    color: '#65676B',
  },
  actionTextActive: {
    color: '#1877F2',
  }
});