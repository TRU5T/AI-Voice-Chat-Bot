const { ElevenLabs } = require('elevenlabs-node');
const logger = require('../../utils/logger');

const elevenlabs = new ElevenLabs({
  apiKey: process.env.ELEVENLABS_API_KEY
});

async function synthesizeSpeech(text, outputPath, config) {
  try {
    const audio = await elevenlabs.textToSpeech({
      text,
      voiceId: config.voice_id,
      modelId: 'eleven_monolingual_v1',
      outputFormat: 'mp3'
    });
    
    // Save the audio file
    require('fs').writeFileSync(outputPath, audio);
    
    logger.debug('Speech synthesized', { text, outputPath });
    return outputPath;
  } catch (error) {
    logger.error('Speech synthesis failed:', error);
    throw error;
  }
}

module.exports = {
  synthesizeSpeech
}; 