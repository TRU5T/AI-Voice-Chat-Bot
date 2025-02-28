import os
import time
import yaml
import openai
import numpy as np
import sounddevice as sd
import soundfile as sf
import whisper
import threading
import logging
import platform
from elevenlabs import ElevenLabs

# Check if running on Windows
is_windows = platform.system() == "Windows"

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("logs/sip_bot.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("sip_bot")

# Load config
with open("config.yaml", "r") as file:
    config = yaml.safe_load(file)

# Override with environment variables if present
config["ai"]["openai_key"] = os.getenv("OPENAI_API_KEY", config["ai"]["openai_key"])
config["ai"]["elevenlabs_key"] = os.getenv("ELEVENLABS_API_KEY", config["ai"]["elevenlabs_key"])

# Initialize APIs
openai.api_key = config["ai"]["openai_key"]
elevenlabs_key = config["ai"]["elevenlabs_key"]

# Initialize ElevenLabs API
elevenlabs = ElevenLabs(api_key=elevenlabs_key)

# Global variables
recording = False
audio_buffer = []
sample_rate = 16000  # Standard for speech recognition

# Load Whisper model
logger.info("Loading Whisper model...")
whisper_model = whisper.load_model("base")
logger.info("Whisper model loaded")

# Function to transcribe audio
def transcribe_audio(audio_file):
    logger.info(f"Transcribing audio from {audio_file}")
    try:
        result = whisper_model.transcribe(audio_file)
        transcription = result["text"]
        logger.info(f"Transcription: {transcription}")
        return transcription
    except Exception as e:
        logger.error(f"Error transcribing audio: {e}")
        return "I couldn't understand what you said. Could you please repeat that?"

# Function to generate AI response
def get_ai_response(prompt):
    logger.info(f"Generating AI response for: {prompt}")
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4o-mini",  # Updated to newer model
            messages=[
                {"role": "system", "content": "You are a helpful assistant responding to a phone call. Keep your responses concise and natural."},
                {"role": "user", "content": prompt}
            ],
        )
        ai_response = response.choices[0].message.content
        logger.info(f"AI response: {ai_response}")
        return ai_response
    except Exception as e:
        logger.error(f"Error getting AI response: {e}")
        return "I'm sorry, I'm having trouble processing your request right now."

# Function to convert AI response to speech
def speak(text, output_file="response.wav"):
    logger.info(f"Converting to speech: {text}")
    try:
        audio = elevenlabs.generate(
            text=text, 
            voice=config["audio"]["tts_voice"]
        )
        with open(output_file, "wb") as f:
            f.write(audio)
        logger.info(f"Speech saved to {output_file}")
        return output_file
    except Exception as e:
        logger.error(f"Error generating speech: {e}")
        return None

# Audio callback function for recording
def audio_callback(indata, frames, time, status):
    global audio_buffer
    if recording and status:
        logger.warning(f"Audio recording status: {status}")
    if recording:
        audio_buffer.append(indata.copy())

# Function to start recording
def start_recording():
    global recording, audio_buffer
    logger.info("Starting audio recording")
    audio_buffer = []
    recording = True

# Function to stop recording and save audio
def stop_recording(output_file="incoming.wav"):
    global recording, audio_buffer
    recording = False
    if not audio_buffer:
        logger.warning("No audio recorded")
        return None
    
    logger.info("Stopping audio recording and saving file")
    audio_data = np.concatenate(audio_buffer, axis=0)
    sf.write(output_file, audio_data, sample_rate)
    logger.info(f"Audio saved to {output_file}")
    return output_file

# Function to handle an active call
def handle_call():
    logger.info("Handling new call")
    
    # Play greeting
    greeting = "Hello, this is an AI assistant. How can I help you today?"
    greeting_file = speak(greeting)
    os.system(f"start {greeting_file}")  # Play the greeting file on Windows
    
    # Start audio stream for recording
    with sd.InputStream(callback=audio_callback, channels=1, samplerate=sample_rate):
        # Record for a few seconds
        start_recording()
        time.sleep(5)  # Record for 5 seconds
        audio_file = stop_recording()
        
        if audio_file:
            # Process the audio
            transcription = transcribe_audio(audio_file)
            
            # If transcription is empty or very short, continue recording
            if not transcription or len(transcription.split()) < 2:
                return
            
            # Generate and speak response
            response = get_ai_response(transcription)
            response_file = speak(response)
            os.system(f"start {response_file}")  # Play the response file on Windows
    
    logger.info("Call handling completed")

# Main function
def main():
    logger.info("Starting SIP Bot")
    
    # Create logs directory if it doesn't exist
    os.makedirs("logs", exist_ok=True)
    
    # Handle a call for testing
    handle_call()
    
    # Keep the main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down SIP Bot")

if __name__ == "__main__":
    main()