import React, { useState } from 'react';
import { View, TouchableOpacity, Modal, Text, StyleSheet, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useRef, useEffect } from 'react';

const AttachmentMenu = ({ isVisible, onClose, onSelectImage, onSelectVideo, onSelectFile }) => {
    const scaleAnim = useRef(new Animated.Value(0.5)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isVisible) {
            Animated.parallel([
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(scaleAnim, {
                    toValue: 0.5,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [isVisible, scaleAnim, opacityAnim]);

    return (
        <Modal
            visible={isVisible}
            transparent={true}
            animationType="none"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <Animated.View 
                    style={[
                        styles.menuContainer,
                        {
                            opacity: opacityAnim,
                            transform: [{ scale: scaleAnim }]
                        }
                    ]}
                >
                    <TouchableOpacity 
                        style={styles.menuItem} 
                        onPress={() => {
                            onClose();
                            onSelectImage();
                        }}
                    >
                        <View style={[styles.iconContainer, { backgroundColor: '#4CAF50' }]}>
                            <Icon name="image" size={22} color="#FFFFFF" />
                        </View>
                        <Text style={styles.menuText}>Hình Ảnh</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        style={styles.menuItem} 
                        onPress={() => {
                            onClose();
                            onSelectVideo();
                        }}
                    >
                        <View style={[styles.iconContainer, { backgroundColor: '#F44336' }]}>
                            <Icon name="video-camera" size={22} color="#FFFFFF" />
                        </View>
                        <Text style={styles.menuText}>Video</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        style={styles.menuItem} 
                        onPress={() => {
                            onClose();
                            onSelectFile();
                        }}
                    >
                        <View style={[styles.iconContainer, { backgroundColor: '#2196F3' }]}>
                            <Icon name="file" size={22} color="#FFFFFF" />
                        </View>
                        <Text style={styles.menuText}>Tài Liệu</Text>
                    </TouchableOpacity>
                </Animated.View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 10,
        width: '80%',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    menuText: {
        fontSize: 16,
        color: '#333333',
    }
});

export default AttachmentMenu; 