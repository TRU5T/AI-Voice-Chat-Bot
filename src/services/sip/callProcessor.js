const { query } = require('../../database');
const logger = require('../../utils/logger');
const { transcribeAudio } = require('../../services/ai/transcriber');
const { generateResponse } = require('../../services/ai/llmProcessor');
const { synthesizeSpeech } = require('../../services/ai/synthesizer');

async function handleCall(req, res, client, mediaServer) {
  const callId = req.get('Call-ID');
  logger.info(`Incoming call for client ${client.id}, Call-ID: ${callId}`);
  
  try {
    // Create call record
    const call = await query(
      `INSERT INTO calls (
        client_id, call_id, caller_number, called_number, start_time
      ) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        client.id,
        callId,
        req.getParsedHeader('From').uri.user,
        req.getParsedHeader('To').uri.user,
        new Date()
      ]
    );
    
    // Answer the call
    const dlg = await res.send(200, {
      body: {
        contentType: 'application/sdp'
      }
    });
    
    // Connect to media server
    const endpoint = await mediaServer.connectCaller(dlg);
    
    // Get AI configuration
    const aiConfig = await query(
      'SELECT * FROM ai_configs WHERE client_id = $1',
      [client.id]
    );
    
    // Play greeting
    if (aiConfig.rows[0].greeting_file) {
      await endpoint.play(`${process.env.MEDIA_PATH}/greetings/${aiConfig.rows[0].greeting_file}`);
    }
    
    // Start conversation loop
    let conversationActive = true;
    let conversationContext = [];
    
    while (conversationActive) {
      // Record user speech
      const recording = await endpoint.record(
        `${process.env.TEMP_PATH}/${callId}_input.wav`,
        {
          maxDuration: 10,
          silenceThreshold: 2
        }
      );
      
      // Transcribe speech
      const transcript = await transcribeAudio(
        recording.recordingPath,
        aiConfig.rows[0].transcription_model
      );
      
      // Log user input
      await query(
        'INSERT INTO call_interactions (call_id, speaker, content) VALUES ($1, $2, $3)',
        [call.rows[0].id, 'user', transcript]
      );
      
      // Generate AI response
      const aiResponse = await generateResponse(
        transcript,
        aiConfig.rows[0],
        conversationContext
      );
      
      // Log AI response
      await query(
        'INSERT INTO call_interactions (call_id, speaker, content) VALUES ($1, $2, $3)',
        [call.rows[0].id, 'assistant', aiResponse]
      );
      
      // Update conversation context
      conversationContext.push({ role: 'user', content: transcript });
      conversationContext.push({ role: 'assistant', content: aiResponse });
      
      // Generate speech from AI response
      const speechFile = await synthesizeSpeech(
        aiResponse,
        `${process.env.TEMP_PATH}/${callId}_output.wav`,
        aiConfig.rows[0]
      );
      
      // Play response to user
      await endpoint.play(speechFile);
      
      // Check if conversation should end
      conversationActive = !aiResponse.includes('[END_CONVERSATION]') &&
                          conversationContext.length < aiConfig.rows[0].max_turns;
    }
    
    // Play goodbye message
    if (aiConfig.rows[0].goodbye_file) {
      await endpoint.play(`${process.env.MEDIA_PATH}/goodbyes/${aiConfig.rows[0].goodbye_file}`);
    }
    
    // Hang up
    await dlg.destroy();
    
    // Update call record
    await query(
      `UPDATE calls 
       SET end_time = $1, duration = $2, status = $3 
       WHERE id = $4`,
      [
        new Date(),
        (new Date() - call.rows[0].start_time) / 1000,
        'completed',
        call.rows[0].id
      ]
    );
    
  } catch (error) {
    logger.error(`Error handling call for client ${client.id}:`, error);
    
    // Try to send error response
    try {
      if (!res.sent) {
        res.send(500);
      }
    } catch (e) {
      // Ignore
    }
    
    // Log error
    await query(
      'INSERT INTO error_logs (error_type, details) VALUES ($1, $2)',
      ['call_processing', {
        clientId: client.id,
        callId,
        error: error.message,
        stack: error.stack
      }]
    );
  }
}

module.exports = {
  handleCall
}; 