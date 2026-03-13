import { Video, VideoStatus, VideoUploadResponse, AnalysisResponse, PersonalityResponse, VideoAnalysis, AIPersonality, PersonalityStatus, User } from '../types';
import { analyzeVideoWithNova } from './novaService';

const VIDEOS_DB_KEY = 'teach_clone_videos_db';
const ANALYSIS_DB_KEY = 'teach_clone_analysis_db';
const PERSONALITY_DB_KEY = 'teach_clone_personalities_db';
const USERS_DB_KEY = 'teach_clone_users_db';
const VIDEO_BLOB_DB_NAME = 'teach_clone_video_blobs';
const VIDEO_BLOB_STORE = 'videos';

const getVideosDB = (): Video[] => JSON.parse(localStorage.getItem(VIDEOS_DB_KEY) || '[]');
const saveVideosDB = (data: Video[]) => localStorage.setItem(VIDEOS_DB_KEY, JSON.stringify(data));
const getAnalysisDB = (): VideoAnalysis[] => JSON.parse(localStorage.getItem(ANALYSIS_DB_KEY) || '[]');
const saveAnalysisDB = (data: VideoAnalysis[]) => localStorage.setItem(ANALYSIS_DB_KEY, JSON.stringify(data));
const getPersonalitiesDB = (): AIPersonality[] => JSON.parse(localStorage.getItem(PERSONALITY_DB_KEY) || '[]');
const savePersonalitiesDB = (data: AIPersonality[]) => localStorage.setItem(PERSONALITY_DB_KEY, JSON.stringify(data));
const getUsersDB = (): User[] => JSON.parse(localStorage.getItem(USERS_DB_KEY) || '[]');

const openBlobDB = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(VIDEO_BLOB_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(VIDEO_BLOB_STORE)) db.createObjectStore(VIDEO_BLOB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const saveBlobToDB = async (videoId: number, blob: Blob): Promise<void> => {
  const db = await openBlobDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(VIDEO_BLOB_STORE, 'readwrite');
    tx.objectStore(VIDEO_BLOB_STORE).put(blob, String(videoId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const getBlobFromDB = async (videoId: number): Promise<Blob | null> => {
  const db = await openBlobDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEO_BLOB_STORE, 'readonly');
    const request = tx.objectStore(VIDEO_BLOB_STORE).get(String(videoId));
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

const getUserById = (id: number): User | undefined => getUsersDB().find((u) => Number(u.userId) === Number(id));

export const getTeacherVideos = (teacherId: number): Video[] => getVideosDB().filter((v) => Number(v.teacherId) === Number(teacherId)).sort((a, b) => b.videoId - a.videoId);
export const getVideoById = (videoId: number): Video | undefined => getVideosDB().find((v) => Number(v.videoId) === Number(videoId));
export const getAnalysisByVideoId = (videoId: number): VideoAnalysis | undefined => getAnalysisDB().find((a) => Number(a.videoId) === Number(videoId));
export const getPersonalityById = (personalityId: number): AIPersonality | undefined => getPersonalitiesDB().find((p) => Number(p.personalityId) === Number(personalityId));

const updateVideoStatus = (videoId: number, status: VideoStatus) => {
  const videos = getVideosDB();
  const idx = videos.findIndex((v) => Number(v.videoId) === Number(videoId));
  if (idx !== -1) {
    videos[idx].uploadStatus = status;
    saveVideosDB(videos);
  }
};

export const uploadVideo = async (
  teacherId: number,
  title: string,
  subject: string,
  gradeLevel: string,
  file: File
): Promise<VideoUploadResponse> => {
  const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
  if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|avi|mov|mkv|webm)$/i)) {
    return { success: false, message: 'Invalid file type. Allowed: mp4, avi, mov, mkv, webm' };
  }

  const MAX_SIZE = 100 * 1024 * 1024;
  if (file.size > MAX_SIZE) return { success: false, message: 'File too large. Maximum 100MB allowed.' };

  await new Promise((resolve) => setTimeout(resolve, Math.max(1500, (file.size / (1024 * 1024)) * 300)));

  try {
    const videos = getVideosDB();
    const newVideoId = videos.length > 0 ? Math.max(...videos.map((v) => v.videoId)) + 1 : 1;
    await saveBlobToDB(newVideoId, file);

    const newVideo: Video = {
      videoId: newVideoId,
      teacherId: Number(teacherId),
      title,
      subject,
      gradeLevel,
      filePath: `local_blob:${newVideoId}`,
      fileSize: file.size,
      mimeType: file.type,
      uploadStatus: VideoStatus.UPLOADED,
      uploadedAt: new Date().toISOString(),
      description: 'Uploaded via TeachNova secure demo portal',
      embeddingStatus: 'pending',
    };

    videos.push(newVideo);
    saveVideosDB(videos);

    return { success: true, message: 'Video uploaded successfully. Ready for Nova analysis.', video: newVideo };
  } catch (error) {
    console.error('Upload failed:', error);
    return { success: false, message: 'Storage error: Could not save video file locally.' };
  }
};

export const performVideoAnalysis = async (videoId: number): Promise<AnalysisResponse> => {
  const video = getVideoById(videoId);
  if (!video) return { success: false, message: 'Video not found.' };

  updateVideoStatus(videoId, VideoStatus.PROCESSING);

  try {
    const videoBlob = await getBlobFromDB(videoId);
    if (!videoBlob) throw new Error('Video file data is missing or corrupted.');

    const novaResponse = await analyzeVideoWithNova(videoBlob, {
      title: video.title,
      subject: video.subject,
      gradeLevel: video.gradeLevel,
      fileName: `${video.title}.mp4`,
    });

    if (!novaResponse.success || !novaResponse.text) throw new Error(novaResponse.error || 'Empty response from Nova');

    let jsonString = novaResponse.text.replace(/```json/g, '').replace(/```/g, '').trim();
    const startIndex = jsonString.indexOf('{');
    const endIndex = jsonString.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1) jsonString = jsonString.substring(startIndex, endIndex + 1);

    const analysisData = JSON.parse(jsonString);
    const toneDesc = typeof analysisData.tone_and_energy === 'object'
      ? `${analysisData.tone_and_energy.description} (Level: ${analysisData.tone_and_energy.level})`
      : analysisData.tone_description || 'Neutral';

    const traits = Array.isArray(analysisData.unique_traits) ? analysisData.unique_traits.join(', ') : analysisData.unique_traits;
    const phrases = Array.isArray(analysisData.common_phrases) ? analysisData.common_phrases.join(', ') : analysisData.common_phrases;
    const gender = analysisData.teacher_gender && String(analysisData.teacher_gender).toLowerCase().includes('female') ? 'Female' : 'Male';

    const analyses = getAnalysisDB();
    const newAnalysis: VideoAnalysis = {
      analysisId: analyses.length + 1,
      videoId: Number(videoId),
      teachingStyle: analysisData.teaching_style || 'Not specified',
      commonPhrases: phrases || '',
      toneDescription: toneDesc,
      languageMix: 'English Only',
      pacing: analysisData.pacing || 'Moderate',
      teachingMethodology: analysisData.teaching_methodology,
      exampleTypes: analysisData.example_types,
      keyCharacteristics: traits,
      teacherGender: gender,
      voiceCharacteristics: analysisData.voice_characteristics,
      lessonTopics: analysisData.lesson_topics || [],
      keyConcepts: analysisData.key_concepts || [],
      definitions: analysisData.definitions || [],
      workedExamples: analysisData.worked_examples || [],
      misconceptions: analysisData.misconceptions || [],
      quizQuestions: analysisData.quiz_questions || [],
      lessonSummary: analysisData.lesson_summary || '',
      analyzedAt: new Date().toISOString(),
    };

    const filteredAnalyses = analyses.filter((a) => a.videoId !== Number(videoId));
    filteredAnalyses.push(newAnalysis);
    saveAnalysisDB(filteredAnalyses);

    const videos = getVideosDB();
    const videoIdx = videos.findIndex((v) => Number(v.videoId) === Number(videoId));
    if (videoIdx !== -1) {
      videos[videoIdx].uploadStatus = VideoStatus.ANALYZED;
      videos[videoIdx].lessonSummary = newAnalysis.lessonSummary;
      videos[videoIdx].embeddingStatus = 'ready';
      saveVideosDB(videos);
    }

    return { success: true, message: 'Video analyzed successfully with Amazon Nova', analysis: newAnalysis };
  } catch (error) {
    console.error('Analysis Failed:', error);
    updateVideoStatus(videoId, VideoStatus.FAILED);
    return { success: false, message: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
};

export const generatePersonality = async (videoId: number): Promise<PersonalityResponse> => {
  const video = getVideoById(videoId);
  if (!video) return { success: false, message: 'Video not found.' };

  const analysis = getAnalysisByVideoId(videoId);
  if (!analysis) return { success: false, message: 'Video must be analyzed first.' };

  await new Promise((resolve) => setTimeout(resolve, 800));

  try {
    const teacher = getUserById(video.teacherId);
    const teacherName = teacher ? teacher.fullName : 'Teacher';

    const systemPrompt = `You are ${teacherName}, an AI teaching clone created for TeachNova.
Your tone: ${analysis.toneDescription}.
Your teaching style: ${analysis.teachingStyle}.
Your signature phrases: ${analysis.commonPhrases}.
Your pacing: ${analysis.pacing}.
Your methodology: ${analysis.teachingMethodology || 'clear guided explanation'}.
Your example style: ${analysis.exampleTypes || 'relatable classroom examples'}.
Key classroom traits: ${analysis.keyCharacteristics || 'supportive and structured'}.
Current lesson summary: ${analysis.lessonSummary || 'No summary available.'}
Key concepts from the teacher's lessons: ${(analysis.keyConcepts || []).join(', ') || 'general lesson support'}.
Common student mistakes to watch for: ${(analysis.misconceptions || []).join(', ') || 'none provided'}.

Rules:
1. Always stay in character.
2. Explain like a real teacher, not like a generic chatbot.
3. Use short, supportive English.
4. Prefer lesson-grounded answers when possible.
5. When helpful, teach step by step.`;

    const personalities = getPersonalitiesDB();
    const existingIndex = personalities.findIndex((p) => Number(p.teacherId) === Number(video.teacherId));

    let newPersonality: AIPersonality;
    if (existingIndex !== -1) {
      newPersonality = {
        ...personalities[existingIndex],
        personalityName: `${teacherName}'s TeachNova Clone`,
        systemPrompt,
        approvalStatus: PersonalityStatus.PENDING,
        isActive: false,
        createdAt: new Date().toISOString(),
      };
      personalities[existingIndex] = newPersonality;
    } else {
      newPersonality = {
        personalityId: personalities.length + 1,
        teacherId: video.teacherId,
        personalityName: `${teacherName}'s TeachNova Clone`,
        systemPrompt,
        approvalStatus: PersonalityStatus.PENDING,
        isActive: false,
        createdAt: new Date().toISOString(),
      };
      personalities.push(newPersonality);
    }

    savePersonalitiesDB(personalities);
    return { success: true, message: 'TeachNova personality generated successfully.', personality: newPersonality };
  } catch (error) {
    console.error('Personality Generation Error:', error);
    return { success: false, message: 'Failed to generate personality.' };
  }
};
