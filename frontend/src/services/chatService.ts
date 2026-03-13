import { Conversation, Message, AIPersonality, ChatResponse, ChatMessage, PersonalityStatus, VideoAnalysis, ChatAttachment } from '../types';
import { generateResponseWithContext } from './novaService';
import { getPersonalityById as getPersonalityServiceById, getAnalysisByVideoId, getTeacherVideos } from './videoService';

const CONVERSATION_DB_KEY = 'teach_clone_conversations_db';
const MESSAGES_DB_KEY = 'teach_clone_messages_db';
const PERSONALITY_DB_KEY = 'teach_clone_personalities_db';
const USERS_DB_KEY = 'teach_clone_users_db';

const getConversationsDB = (): Conversation[] => JSON.parse(localStorage.getItem(CONVERSATION_DB_KEY) || '[]');
const saveConversationsDB = (data: Conversation[]) => localStorage.setItem(CONVERSATION_DB_KEY, JSON.stringify(data));
const getMessagesDB = (): Message[] => JSON.parse(localStorage.getItem(MESSAGES_DB_KEY) || '[]');
const saveMessagesDB = (data: Message[]) => localStorage.setItem(MESSAGES_DB_KEY, JSON.stringify(data));
const getPersonalitiesDB = (): AIPersonality[] => JSON.parse(localStorage.getItem(PERSONALITY_DB_KEY) || '[]');
const getUsersDB = () => JSON.parse(localStorage.getItem(USERS_DB_KEY) || '[]');

const cleanAIResponse = (text: string): string => {
  if (!text) return '';
  let cleaned = text.replace(/[\*#_`~]/g, '');
  ['Thanks for the click', 'thanks for clicking', 'thank you for the click'].forEach((phrase) => {
    cleaned = cleaned.replace(new RegExp(phrase, 'gi'), '');
  });
  return cleaned.replace(/\s+/g, ' ').trim();
};

const detectTeacherGender = (personality: AIPersonality, analysis?: VideoAnalysis): 'Male' | 'Female' => {
  if (analysis?.teacherGender) {
    if (analysis.teacherGender.toLowerCase() === 'female') return 'Female';
    if (analysis.teacherGender.toLowerCase() === 'male') return 'Male';
  }

  if (analysis?.voiceCharacteristics) {
    const vc = analysis.voiceCharacteristics.toLowerCase();
    if (vc.includes('female') || vc.includes('woman')) return 'Female';
    if (vc.includes('male') || vc.includes('man')) return 'Male';
  }

  const users = getUsersDB();
  const teacher = users.find((u: any) => u.userId === personality.teacherId);
  if (!teacher) return 'Male';

  const name = String(teacher.fullName || '').toLowerCase();
  const femaleNames = ['fatima', 'ayesha', 'sarah', 'maria', 'emily', 'jessica', 'linda', 'jennifer', 'khadija', 'maryam', 'zainab', 'aisha'];
  if (femaleNames.some((fn) => name.includes(fn))) return 'Female';
  return 'Male';
};

const getVoiceSettings = (personalityId: number) => {
  const personality = getPersonalitiesDB().find((p) => p.personalityId === personalityId);
  if (!personality) return { pitch: 0, rate: 1.0, lang: 'en-US', gender: 'Male' as const, voiceName: 'en-US-Neural2-D' };

  let analysis: VideoAnalysis | undefined;
  const videos = getTeacherVideos(personality.teacherId);
  if (videos.length > 0) analysis = getAnalysisByVideoId(videos[0].videoId);

  let pitch = 0;
  let rate = 1.0;
  const gender = detectTeacherGender(personality, analysis);

  if (analysis) {
    const tone = analysis.toneDescription.toLowerCase();
    if (tone.includes('energetic') || tone.includes('enthusiastic')) pitch = 2.0;
    else if (tone.includes('calm') || tone.includes('serious')) pitch = -2.0;

    const pacing = analysis.pacing.toLowerCase();
    if (pacing.includes('fast')) rate = 1.15;
    else if (pacing.includes('slow')) rate = 0.9;
  }

  return {
    pitch,
    rate,
    lang: 'en-US',
    gender,
    voiceName: gender === 'Female' ? 'en-US-Neural2-F' : 'en-US-Neural2-D',
  };
};

const buildLessonContext = (personality: AIPersonality): string => {
  const teacherVideos = getTeacherVideos(personality.teacherId);
  const analysisBlocks = teacherVideos
    .map((video) => getAnalysisByVideoId(video.videoId))
    .filter(Boolean) as VideoAnalysis[];

  if (analysisBlocks.length === 0) return 'No lesson evidence available.';

  return analysisBlocks
    .slice(0, 3)
    .map((analysis, index) => {
      const parts = [
        `Lesson ${index + 1}:`,
        analysis.lessonSummary ? `Summary: ${analysis.lessonSummary}` : '',
        analysis.lessonTopics?.length ? `Topics: ${analysis.lessonTopics.join(', ')}` : '',
        analysis.keyConcepts?.length ? `Key concepts: ${analysis.keyConcepts.join(', ')}` : '',
        analysis.workedExamples?.length ? `Worked examples: ${analysis.workedExamples.join(' | ')}` : '',
        analysis.misconceptions?.length ? `Common mistakes: ${analysis.misconceptions.join(' | ')}` : '',
      ].filter(Boolean);
      return parts.join('\n');
    })
    .join('\n\n');
};

export const getApprovedPersonalities = (): (AIPersonality & { teacherName: string })[] => {
  const personalities = getPersonalitiesDB();
  const users = getUsersDB();
  return personalities
    .filter((p) => p.approvalStatus === PersonalityStatus.APPROVED && p.isActive)
    .map((p) => {
      const teacher = users.find((u: any) => u.userId === p.teacherId);
      return { ...p, teacherName: teacher ? teacher.fullName : 'Unknown Teacher' };
    });
};

export const getPersonalityById = (id: number): AIPersonality | undefined => getPersonalitiesDB().find((p) => p.personalityId === id);
export const getConversation = (studentId: number, personalityId: number): Conversation | null => getConversationsDB().find((c) => c.studentId === studentId && c.personalityId === personalityId) || null;
export const getConversationMessages = (conversationId: number): Message[] => getMessagesDB().filter((m) => m.conversationId === conversationId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

export const startConversation = (studentId: number, personalityId: number): Conversation => {
  const convos = getConversationsDB();
  const existing = convos.find((c) => c.studentId === studentId && c.personalityId === personalityId);
  if (existing) return existing;

  const newConvo: Conversation = {
    conversationId: convos.length + 1,
    studentId,
    personalityId,
    startedAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
    messageCount: 0,
  };

  convos.push(newConvo);
  saveConversationsDB(convos);
  return newConvo;
};

export const processStudentMessage = async (
  conversationId: number,
  personalityId: number,
  messageText: string,
  attachment?: ChatAttachment
): Promise<ChatResponse> => {
  try {
    const msgs = getMessagesDB();
    msgs.push({
      messageId: msgs.length + 1,
      conversationId,
      senderType: 'student',
      messageText,
      createdAt: new Date().toISOString(),
      attachmentName: attachment?.name,
    });
    saveMessagesDB(msgs);

    const personality = getPersonalityServiceById(personalityId);
    if (!personality) throw new Error('Personality not found');

    const history = getConversationMessages(conversationId);
    const chatHistory: ChatMessage[] = history.slice(0, -1).slice(-10).map((m) => ({
      role: m.senderType === 'student' ? 'user' : 'model',
      text: m.messageText,
    }));

    const lessonContext = buildLessonContext(personality);
    const groundedPrompt = `${personality.systemPrompt}

Use this lesson evidence when answering:
${lessonContext}

If the student uploaded an image, inspect it and explain it in the teacher's style.`;

    const aiResult = await generateResponseWithContext(groundedPrompt, chatHistory, messageText, attachment);
    if (!aiResult.success || !aiResult.text) throw new Error(aiResult.error || 'AI failed to respond');

    const cleanedAiText = cleanAIResponse(aiResult.text);
    const voiceSettings = getVoiceSettings(personalityId);

    const aiMsg: Message = {
      messageId: msgs.length + 2,
      conversationId,
      senderType: 'ai',
      messageText: cleanedAiText,
      createdAt: new Date().toISOString(),
      audioConfig: voiceSettings,
      audioBase64: undefined,
    };

    msgs.push(aiMsg);
    saveMessagesDB(msgs);

    const convos = getConversationsDB();
    const convoIdx = convos.findIndex((c) => c.conversationId === conversationId);
    if (convoIdx !== -1) {
      convos[convoIdx].lastMessageAt = new Date().toISOString();
      convos[convoIdx].messageCount = msgs.filter((m) => m.conversationId === conversationId).length;
      saveConversationsDB(convos);
    }

    return {
      success: true,
      aiResponse: cleanedAiText,
      timestamp: aiMsg.createdAt,
      audioConfig: voiceSettings,
      audioBase64: undefined,
    };
  } catch (error) {
    console.error('Chat Process Error:', error);
    return { success: false, message: error instanceof Error ? error.message : 'An error occurred' };
  }
};
