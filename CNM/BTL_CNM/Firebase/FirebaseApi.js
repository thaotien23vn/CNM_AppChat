import { db, storage } from '../Firebase/Firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, orderBy, onSnapshot, serverTimestamp, setDoc, getDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const conversationApi = {

    getConversations: (userId, callback) => {

        const userConversationsQuery = query(
            collection(db, 'UserConversation'),
            where('user_id', '==', userId)
        );

        return onSnapshot(userConversationsQuery, async (snapshot) => {
            const promises = snapshot.docs.map(async (doc) => {
                const conId = doc.data().con_id;
                const ConversationDetail = query(
                    collection(db, 'Conversations'),
                    where('con_id', '==', conId)
                );
                const conversationDetailSnapshot = await getDocs(ConversationDetail);
                const details = conversationDetailSnapshot.docs.map((doc) => ({
                    ...doc.data(),
                }));
                return details[0];
            });

            try {
                const conversations = await Promise.all(promises);
                callback(conversations.filter(Boolean));
            } catch (err) {
                console.error('Lỗi khi lấy chi tiết conversations:', err);
                callback([]);
            }
        });
    },

    // Tạo cuộc trò chuyện mới
    createConversation: async (currentUserId, friendId, currentUserName, friendName) => {
        try {
            // Tạo cuộc trò chuyện mới
            const newConversationRef = await addDoc(collection(db, 'Conversations'), {
                con_id: '', // Sẽ cập nhật sau
                is_group: false,
                members: [
                    {
                        user_id: currentUserId,
                        user_name: currentUserName || ''
                    },
                    {
                        user_id: friendId,
                        user_name: friendName || ''
                    }
                ],
                mess_info: ['', ''],
                createdAt: serverTimestamp()
            });

            // Cập nhật con_id với ID của document
            const conversationId = newConversationRef.id;
            await updateDoc(newConversationRef, {
                con_id: conversationId
            });

            // Thêm liên kết UserConversation cho cả hai người dùng
            await addDoc(collection(db, 'UserConversation'), {
                user_id: currentUserId,
                con_id: conversationId,
                createdAt: serverTimestamp()
            });

            await addDoc(collection(db, 'UserConversation'), {
                user_id: friendId,
                con_id: conversationId,
                createdAt: serverTimestamp()
            });

            return conversationId;
        } catch (error) {
            console.error('Lỗi khi tạo cuộc trò chuyện:', error);
            throw error;
        }
    },

    
    // Tìm kiếm cuộc trò chuyện giữa hai người dùng
    findConversationBetweenUsers: async (currentUserId, friendId) => {
        try {
            // Kiểm tra xem đã có cuộc trò chuyện nào giữa hai người chưa
            const userConversationsQuery = query(
                collection(db, 'UserConversation'),
                where('user_id', '==', currentUserId)
            );
            const userConversationsSnapshot = await getDocs(userConversationsQuery);

            const userConIds = userConversationsSnapshot.docs.map(docItem => docItem.data().con_id);

            if (userConIds.length > 0) {
                // Tìm các cuộc trò chuyện của người bạn
                const friendConversationsQuery = query(
                    collection(db, 'UserConversation'),
                    where('user_id', '==', friendId),
                    where('con_id', 'in', userConIds)
                );
                const friendConversationsSnapshot = await getDocs(friendConversationsQuery);

                // Nếu có cuộc trò chuyện chung
                if (!friendConversationsSnapshot.empty) {
                    // Kiểm tra từng cuộc trò chuyện để tìm chat 1-1
                    for (const docSnap of friendConversationsSnapshot.docs) {
                        const conId = docSnap.data().con_id;
                        const conversationDoc = await getDoc(doc(db, 'Conversations', conId));

                        if (conversationDoc.exists()) {
                            const conversationData = conversationDoc.data();

                            // Nếu là chat 1-1 (không phải nhóm) và chỉ có 2 thành viên
                            if (!conversationData.is_group &&
                                conversationData.members &&
                                conversationData.members.length === 2) {

                                // Kiểm tra xem hai thành viên có đúng là currentUserId và friendId
                                const memberIds = conversationData.members.map(member =>
                                    typeof member === 'object' ? member.user_id : member
                                );

                                if (memberIds.includes(currentUserId) && memberIds.includes(friendId)) {
                                    return conId;
                                }
                            }
                        }
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('Lỗi khi tìm kiếm cuộc trò chuyện:', error);
            throw error;
        }
    },

        // Lấy thông tin cuộc trò chuyện theo ID
    getConversationById: async (conversationId) => {
        try {
            const conversationRef = doc(db, 'Conversations', conversationId);
            const conversationDoc = await getDoc(conversationRef);

            if (!conversationDoc.exists()) {
                console.error('Không tìm thấy cuộc trò chuyện');
                return null;
            }

            return conversationDoc.data();
        } catch (error) {
            console.error('Lỗi khi lấy thông tin cuộc trò chuyện:', error);
            return null;
        }
    }
};

// API cho Messages
export const messageApi = {
    // Gửi tin nhắn mới
    sendMessage: async (data) => {
        try {
            // Chuẩn bị dữ liệu tin nhắn
            const messageData = {
                ...data,
                createdAt: Date.now(),
                timestamp: Date.now()
            };

            // Thêm tin nhắn vào Firestore
            const messageRef = await addDoc(collection(db, 'Messages'), messageData);
            return messageRef.id;
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    },

    // Lấy tin nhắn của cuộc trò chuyện
    getMessages: (conversationId, callback) => {
        const q = query(
            collection(db, 'Messages'),
            where('con_id', '==', conversationId)
        );

        return onSnapshot(q, (snapshot) => {
            const messages = [];
            snapshot.forEach((doc) => {
                messages.push({
                    ...doc.data()
                });
            });
            // Sắp xếp tin nhắn theo createdAt tăng dần
            messages.sort((a, b) => a.createdAt - b.createdAt);
            callback(messages);
        });
    },

       // Cập nhật thông tin tin nhắn mới nhất cho cuộc trò chuyện
    updateLastMessage: async (conversationId, message, timestamp) => {
        try {
            const conversationRef = doc(db, 'Conversations', conversationId);
            await updateDoc(conversationRef, {
                mess_info: [message, timestamp]
            });
        } catch (error) {
            console.error('Lỗi khi cập nhật tin nhắn cuối cùng:', error);
            throw error;
        }
    }
};

// API cho Users
export const userApi = {
    // Kiểm tra user có tồn tại không
    checkUserExists: async (userId) => {
        const userDoc = await getDoc(doc(db, 'Users', userId));
        return userDoc.exists();
    },

    // Tạo user mới
    createUser: async (userId, userData) => {
        await setDoc(doc(db, 'Users', userId), {
            ...userData,
            createdAt: serverTimestamp()
        });
    },

    // Cập nhật thông tin người dùng
    updateUserInfo: async (userId, data) => {
        try {
            const userRef = doc(db, 'Users', userId);
            await updateDoc(userRef, {
                ...data,
                updatedAt: Date.now()
            });
        } catch (error) {
            console.error('Error updating user info:', error);
            throw error;
        }
    },

    // Lấy thông tin người dùng
    getUserInfo: async (userId) => {
        const userDoc = await getDoc(doc(db, 'Users', userId));
        if (!userDoc.exists()) return null;

        const userData = userDoc.data();
        return {
            id: userId,
            fullName: userData.fullName || '',
            email: userData.email || '',
            phoneNumber: userData.phoneNumber || '',
            img: userData.img || '',
            status: userData.status || 'offline',
            lastSeen: userData.lastSeen || new Date()
        };
    },

    updateUserAvatar: async (userId, file) => {
        try {
            const imageUrl = await storageApi.uploadImage(file, userId);

            await updateDoc(doc(db, 'Users', userId), {
                img: imageUrl,
                updatedAt: Date.now()
            });

            return imageUrl;
        } catch (error) {
            console.error('Lỗi khi cập nhật avatar:', error);
            throw error;
        }
    },

    // Tìm kiếm người dùng theo email
    findUserByEmail: async (email) => {
        try {
            const usersRef = collection(db, 'Users');
            const q = query(usersRef, where('email', '==', email));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                return null;
            }

            const userData = querySnapshot.docs[0].data();
            return {
                ...userData,
                id: querySnapshot.docs[0].id
            };
        } catch (error) {
            console.error('Lỗi khi tìm kiếm người dùng:', error);
            throw error;
        }
    },

    // Lấy danh sách bạn bè 
    getFriends: async (userId) => {
        try {
            // Lấy danh sách bạn bè từ friend_requests đã được accepted
            const q1 = query(
                collection(db, 'friend_requests'),
                where('status', '==', 'accepted'),
                where('from', '==', userId)
            );
            const q2 = query(
                collection(db, 'friend_requests'),
                where('status', '==', 'accepted'),
                where('to', '==', userId)
            );

            const [fromSnapshot, toSnapshot] = await Promise.all([
                getDocs(q1),
                getDocs(q2)
            ]);

            const friendIds = new Set();
            fromSnapshot.forEach(doc => friendIds.add(doc.data().to));
            toSnapshot.forEach(doc => friendIds.add(doc.data().from));

            if (friendIds.size === 0) {
                return [];
            }

            // Lấy thông tin của từng người bạn
            const friendsData = await Promise.all(
                Array.from(friendIds).map(async uid => {
                    const userQ = query(collection(db, 'Users'), where('user_id', '==', uid));
                    const userSnap = await getDocs(userQ);
                    return userSnap.docs[0]?.data();
                })
            );

            return friendsData.filter(Boolean);
        } catch (error) {
            console.error('Lỗi khi lấy danh sách bạn bè:', error);
            return [];
        }
    },

    
export const storageApi = {
    uploadFile: async (file, userId) => {
        // Kiểm tra kích thước file, tối đa 5MB
        const maxSizeInBytes = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSizeInBytes) {
            throw new Error('File không được vượt quá 5MB');
        }

        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;
        const storageRef = ref(storage, `data/${userId}/${fileName}`);

        // Upload file
        await uploadBytes(storageRef, file);

        // Lấy URL của file đã upload
        const downloadURL = await getDownloadURL(storageRef);
        return downloadURL;
    },

    // Giữ lại uploadImage để tương thích với code cũ
    uploadImage: async (file, userId) => {
        return storageApi.uploadFile(file, userId);
    }
};

// API cho Friend Requests
export const friendApi = {
    // Lấy danh sách lời mời kết bạn
    getFriendRequests: (userId, callback) => {
        const q = query(
            collection(db, 'friend_requests'),
            where('to', '==', userId),
            where('status', '==', 'pending')
        );

        return onSnapshot(q, async (snapshot) => {
            const result = await Promise.all(
                snapshot.docs.map(async docSnap => {
                    const userId = docSnap.data().from;
                    const userQ = query(collection(db, 'Users'), where('user_id', '==', userId));
                    const userSnap = await getDocs(userQ);
                    const userData = userSnap.docs[0]?.data();

                    return {
                        id: docSnap.id,
                        ...docSnap.data(),
                        userData: userData || null
                    };
                })
            );

            callback(result);
        });
    },

    // Lấy danh sách bạn bè
    listenForFriends: (userId, callback) => {
        // Lấy danh sách ID bạn bè từ friend_requests đã được accepted
        const q1 = query(
            collection(db, 'friend_requests'),
            where('status', '==', 'accepted'),
            where('from', '==', userId)
        );

        const q2 = query(
            collection(db, 'friend_requests'),
            where('status', '==', 'accepted'),
            where('to', '==', userId)
        );

        // Lắng nghe từ phía người gửi
        const unsubscribe1 = onSnapshot(q1, async (snapshot) => {
            const friendIds = new Set();
            snapshot.forEach(doc => friendIds.add(doc.data().to));

            // Lắng nghe từ phía người nhận
            const unsubscribe2 = onSnapshot(q2, async (snapshot) => {
                snapshot.forEach(doc => friendIds.add(doc.data().from));

                if (friendIds.size > 0) {
                    // Lấy thông tin của từng người bạn
                    const friendsData = await Promise.all(
                        Array.from(friendIds).map(async uid => {
                            const userQ = query(collection(db, 'Users'), where('user_id', '==', uid));
                            const userSnap = await getDocs(userQ);
                            return userSnap.docs[0]?.data();
                        })
                    );

                    callback(friendsData.filter(Boolean));
                } else {
                    callback([]);
                }
            });

            return () => unsubscribe2();
        });

        return () => unsubscribe1();
    },

    // Kiểm tra xem đã là bạn bè chưa
    checkIfAlreadyFriends: async (userId, targetUserId) => {
        try {
            const checkFriend1 = query(
                collection(db, 'friend_requests'),
                where('from', '==', userId),
                where('to', '==', targetUserId),
                where('status', '==', 'accepted')
            );

            const checkFriend2 = query(
                collection(db, 'friend_requests'),
                where('from', '==', targetUserId),
                where('to', '==', userId),
                where('status', '==', 'accepted')
            );

            const [friend1, friend2] = await Promise.all([
                getDocs(checkFriend1),
                getDocs(checkFriend2)
            ]);

            return !friend1.empty || !friend2.empty;
        } catch (error) {
            console.error('Lỗi khi kiểm tra trạng thái bạn bè:', error);
            throw error;
        }
    },

    // Kiểm tra xem đã gửi lời mời chưa
    checkIfRequestSent: async (fromUserId, toUserId) => {
        try {
            const requestRef = collection(db, 'friend_requests');
            const checkExist = query(requestRef,
                where('from', '==', fromUserId),
                where('to', '==', toUserId),
                where('status', '==', 'pending')
            );
            const existing = await getDocs(checkExist);
            return !existing.empty;
        } catch (error) {
            console.error('Lỗi khi kiểm tra lời mời kết bạn:', error);
            throw error;
        }
    },

    // Kiểm tra xem đã nhận lời mời chưa
    checkIfRequestReceived: async (fromUserId, toUserId) => {
        try {
            const requestRef = collection(db, 'friend_requests');
            const checkReverse = query(requestRef,
                where('from', '==', toUserId),
                where('to', '==', fromUserId),
                where('status', '==', 'pending')
            );
            const reverseRequest = await getDocs(checkReverse);

            if (!reverseRequest.empty) {
                return {
                    exists: true,
                    requestId: reverseRequest.docs[0].id
                };
            }

            return { exists: false };
        } catch (error) {
            console.error('Lỗi khi kiểm tra lời mời kết bạn đã nhận:', error);
            throw error;
        }
    },

    // Gửi lời mời kết bạn
    sendFriendRequest: async (fromUserId, toUserId) => {
        try {
            const requestRef = collection(db, 'friend_requests');
            const docRef = await addDoc(requestRef, {
                from: fromUserId,
                to: toUserId,
                status: 'pending',
                createdAt: serverTimestamp()
            });

            return docRef.id;
        } catch (error) {
            console.error('Lỗi khi gửi lời mời kết bạn:', error);
            throw error;
        }
    },

    // Chấp nhận lời mời kết bạn
    acceptFriendRequest: async (requestId) => {
        try {
            await updateDoc(doc(db, 'friend_requests', requestId), {
                status: 'accepted',
                acceptedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Lỗi khi chấp nhận lời mời kết bạn:', error);
            throw error;
        }
    },

    // Từ chối lời mời kết bạn
    rejectFriendRequest: async (requestId) => {
        try {
            await deleteDoc(doc(db, 'friend_requests', requestId));
        } catch (error) {
            console.error('Lỗi khi từ chối lời mời kết bạn:', error);
            throw error;
        }
    }
};