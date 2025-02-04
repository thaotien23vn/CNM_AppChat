import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function TimelineScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Khám Phá Nội Dung Mới</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f1f1',
    padding: 20,
  },
  text: {
    fontSize: 20,
    color: '#2f2841',
  },
});