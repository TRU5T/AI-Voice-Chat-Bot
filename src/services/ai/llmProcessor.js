const { OpenAI } = require('openai');
const logger = require('../../utils/logger');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function generateResponse(input, config, conversationContext = []) {
  try {
    const messages = [
      { role: 'system', content: config.system_prompt || 'You are a helpful AI assistant.' },
      ...conversationContext,
      { role: 'user', content: input }
    ];
    
    const completion = await openai.chat.completions.create({
      model: config.llm_model || 'gpt-4',
      messages,
      temperature: 0.7,
      max_tokens: 500
    });
    
    const response = completion.choices[0].message.content;
    logger.debug('Generated response', { input, response });
    
    return response;
  } catch (error) {
    logger.error('Failed to generate response:', error);
    throw error;
  }
}

module.exports = {
  generateResponse
}; 