const { OpenAI } = require('openai');
const logger = require('../../utils/logger');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function transcribeAudio(audioPath, model = 'whisper-1') {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: audioPath,
      model: model,
      response_format: 'text'
    });
    
    logger.debug('Transcription completed', { audioPath, model });
    return transcription;
  } catch (error) {
    logger.error('Transcription failed:', error);
    throw error;
  }
}

module.exports = {
  transcribeAudio
}; 