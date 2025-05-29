import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Feather'; // Feather tương ứng với lucide-react
import { format } from 'date-fns'; // hoặc bạn truyền `formatDate` từ props
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const PostCard = ({ post, onLike, formatDate, onDelete }) => {
  return (
    <View style={styles.card}>
      <LinearGradient
        colors={['#ffffff', '#f8fafc']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarWrapper}>
            {post.authorAvatar ? (
              <Image source={{ uri: post.authorAvatar }} style={styles.avatar} />
            ) : (
              <View style={styles.defaultAvatar}>
                <Icon name="user" size={20} color="#6366f1" />
              </View>
            )}
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.authorName}>
              {post.authorName || 'Người dùng'}
            </Text>
            <View style={styles.dateRow}>
              <Icon name="clock" size={12} color="#94a3b8" style={{ marginRight: 4 }} />
              <Text style={styles.dateText}>{formatDate(post.createdAt)}</Text>
            </View>
          </View>
          {post.isAuthor && (
            <TouchableOpacity onPress={() => onDelete(post)} style={styles.deleteButton}>
              <Icon name="trash-2" size={18} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>

        {/* Title and Content */}
        <View style={styles.content}>
          <Text style={styles.title}>{post.title}</Text>
          <Text style={styles.body}>{post.content}</Text>
        </View>

        {/* Media */}
        {post.mediaUrl && (
          <View style={styles.media}>
            {post.mediaType === 'image' ? (
              <Image 
                source={{ uri: post.mediaUrl }} 
                style={styles.mediaImage}
                resizeMode="cover"
              />
            ) : post.mediaType === 'video' ? (
              <View style={styles.videoPlaceholder}>
                <Icon name="video" size={32} color="#94a3b8" />
                <Text style={styles.videoText}>Video không hỗ trợ</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.likeButton,
              post.likedByCurrentUser ? styles.liked : styles.notLiked,
            ]}
            onPress={() => onLike(post.id, post.likedByCurrentUser)}
          >
            <Icon
              name={post.likedByCurrentUser ? "heart" : "heart"}
              size={18}
              color={post.likedByCurrentUser ? '#ef4444' : '#94a3b8'}
              style={post.likedByCurrentUser ? styles.likedIcon : null}
            />
            <Text style={[
              styles.likeText,
              post.likedByCurrentUser ? styles.likedText : null
            ]}>
              {post.likedByCurrentUser ? 'Đã thích' : 'Thích'}
            </Text>
          </TouchableOpacity>
          <View style={styles.likesCount}>
            <Icon name="heart" size={14} color="#ef4444" style={{ marginRight: 4 }} />
            <Text style={styles.likesText}>{post.likes}</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  gradient: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  defaultAvatar: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  content: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#334155',
  },
  media: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mediaImage: {
    width: width - 64,
    height: 200,
    borderRadius: 12,
  },
  videoPlaceholder: {
    width: width - 64,
    height: 200,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoText: {
    marginTop: 8,
    color: '#94a3b8',
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  liked: {
    backgroundColor: '#fee2e2',
  },
  notLiked: {
    backgroundColor: '#f8fafc',
  },
  likedIcon: {
    transform: [{ scale: 1.1 }],
  },
  likeText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  likedText: {
    color: '#ef4444',
  },
  likesCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  likesText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
});

export default PostCard;
