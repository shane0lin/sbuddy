import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import api from '../api/client';

interface DetectedProblem {
  problem_number: number;
  text: string;
  confidence: number;
  matches: any[];
  has_matches: boolean;
  best_match: any;
}

export default function CameraScreen({ navigation }: any) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [problems, setProblems] = useState<DetectedProblem[]>([]);

  const takePhoto = async () => {
    const result = await launchCamera({
      mediaType: 'photo',
      quality: 0.8,
      saveToPhotos: false,
    });

    if (result.assets?.[0]?.uri) {
      setImageUri(result.assets[0].uri);
      processImage(result.assets[0].uri);
    }
  };

  const selectFromGallery = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    });

    if (result.assets?.[0]?.uri) {
      setImageUri(result.assets[0].uri);
      processImage(result.assets[0].uri);
    }
  };

  const processImage = async (uri: string) => {
    setLoading(true);
    try {
      const result = await api.processMultipleProblems(uri);

      if (result.success && result.problems.length > 0) {
        setProblems(result.problems);
      } else {
        Alert.alert('No Problems Found', 'Could not detect any problems in the image.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to process image');
    } finally {
      setLoading(false);
    }
  };

  const addProblemToStudySet = async (problem: DetectedProblem) => {
    // Navigate to study set selection screen
    navigation.navigate('SelectStudySet', {
      problem: problem.best_match,
    });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan Problem</Text>
        <Text style={styles.subtitle}>
          Take a photo or select from gallery to recognize problems
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={takePhoto}>
          <Text style={styles.buttonText}>📷 Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={selectFromGallery}>
          <Text style={styles.buttonText}>🖼️ Choose from Gallery</Text>
        </TouchableOpacity>
      </View>

      {imageUri && (
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.image} />
        </View>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Processing image...</Text>
        </View>
      )}

      {!loading && problems.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>
            Found {problems.length} problem{problems.length > 1 ? 's' : ''}
          </Text>

          {problems.map((problem, index) => (
            <View key={index} style={styles.problemCard}>
              <View style={styles.problemHeader}>
                <Text style={styles.problemNumber}>Problem {problem.problem_number}</Text>
                <Text style={styles.confidence}>
                  {(problem.confidence * 100).toFixed(0)}% confident
                </Text>
              </View>

              <Text style={styles.problemText} numberOfLines={3}>
                {problem.text}
              </Text>

              {problem.has_matches && problem.best_match && (
                <View style={styles.matchContainer}>
                  <Text style={styles.matchLabel}>Best Match:</Text>
                  <Text style={styles.matchTitle}>{problem.best_match.title}</Text>
                  <Text style={styles.matchSource}>
                    {problem.best_match.exam_type} {problem.best_match.exam_year} -{' '}
                    Problem {problem.best_match.problem_number}
                  </Text>

                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => addProblemToStudySet(problem)}
                  >
                    <Text style={styles.addButtonText}>Add to Study Set</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!problem.has_matches && (
                <Text style={styles.noMatch}>No match found in repository</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    padding: 20,
  },
  image: {
    width: '100%',
    height: 300,
    borderRadius: 12,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  resultsContainer: {
    padding: 20,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  problemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  problemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  problemNumber: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  confidence: {
    fontSize: 14,
    color: '#007AFF',
  },
  problemText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },
  matchContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
  },
  matchLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  matchTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  matchSource: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  noMatch: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
});
