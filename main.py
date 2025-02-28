import os
import time
import subprocess
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
config["sip"]["username"] = os.getenv("SIP_USERNAME", config["sip"]["username"])
config["sip"]["password"] = os.getenv("SIP_PASSWORD", config["sip"]["password"])
config["sip"]["domain"] = os.getenv("SIP_DOMAIN", config["sip"]["domain"])

# Initialize APIs
openai.api_key = config["ai"]["ai_key"]
elevenlabs_key = config["ai"]["elevenlabs_key"]

# Initialize ElevenLabs API
elevenlabs = ElevenLabs(api_key=elevenlabs_key)

# Global variables
call_in_progress = False
recording = False
baresip_process = None
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

# Function to play audio through Baresip
def play_audio_through_baresip(audio_file):
    logger.info(f"Playing audio through Baresip: {audio_file}")
    try:
        # Send command to Baresip to play audio file
        cmd = f"echo '/ausrc_mute\n/auplay {audio_file}\n' | nc -U /tmp/baresip.sock"
        subprocess.run(cmd, shell=True)
        logger.info("Audio playback command sent to Baresip")
    except Exception as e:
        logger.error(f"Error playing audio through Baresip: {e}")

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

# Function to setup Baresip configuration
def setup_baresip_config():
    logger.info("Setting up Baresip configuration")
    
    # Create baresip directory if it doesn't exist
    os.makedirs("/root/.baresip", exist_ok=True)
    
    # Write config file
    with open("/root/.baresip/config", "w") as f:
        f.write(f"""module_path /usr/local/lib/baresip/modules
audio_player alsa,default
audio_source alsa,default
audio_alert alsa,default
sip_listen 0.0.0.0:5060
sip_certificate /root/.baresip/cert.pem
sip_cafile /root/.baresip/cert.pem
call_max_calls 1
audio_buffer 20-160
ausrc_srate 16000
auplay_srate 16000
ausrc_channels 1
auplay_channels 1
ctrl_tcp 127.0.0.1:4444
ctrl_udp 127.0.0.1:4444
evdev_device /dev/input/event0
module codec/opus
module codec/g711
module codec/g722
module auloop
module stdio
module cons
module contact
module menu
module ctrl_tcp
module ctrl_udp
module aufile
""")
    
    # Write accounts file
    with open("/root/.baresip/accounts", "w") as f:
        f.write(f"{config['sip']['username']}@{config['sip']['domain']};auth_pass={config['sip']['password']}")
    
    # Create a Unix socket for controlling Baresip
    with open("/root/.baresip/config", "a") as f:
        f.write("\nmodule ctrl_dbus\nmodule ctrl_tcp\nmodule ctrl_udp\n")
    
    logger.info("Baresip configuration completed")

# Function to start Baresip
def start_baresip():
    global baresip_process
    logger.info("Starting Baresip")
    try:
        # Create a Unix socket for controlling Baresip
        os.system("rm -f /tmp/baresip.sock")
        
        # Start Baresip with command socket
        baresip_process = subprocess.Popen(
            ["baresip", "-e", "/ausrc_mute"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        
        # Wait for Baresip to start
        time.sleep(2)
        logger.info("Baresip started")
        
        # Create a thread to monitor Baresip output
        threading.Thread(target=monitor_baresip_output, daemon=True).start()
        
    except Exception as e:
        logger.error(f"Error starting Baresip: {e}")

# Function to monitor Baresip output for call events
def monitor_baresip_output():
    global call_in_progress, baresip_process
    
    if not baresip_process:
        logger.error("Baresip process not started")
        return
    
    logger.info("Starting Baresip output monitor")
    
    while True:
        line = baresip_process.stdout.readline()
        if not line:
            break
            
        line = line.strip()
        logger.debug(f"Baresip: {line}")
        
        # Check for incoming call
        if "incoming call from" in line.lower():
            logger.info("Incoming call detected")
            # Auto-answer after a short delay
            time.sleep(1)
            send_baresip_command("/accept")
            call_in_progress = True
            handle_call()
            
        # Check for call ended
        elif "call terminated" in line.lower() or "call closed" in line.lower():
            logger.info("Call ended")
            call_in_progress = False
    
    logger.info("Baresip output monitor stopped")

# Function to send commands to Baresip
def send_baresip_command(command):
    logger.info(f"Sending command to Baresip: {command}")
    try:
        cmd = f"echo '{command}' | nc -U /tmp/baresip.sock"
        subprocess.run(cmd, shell=True)
    except Exception as e:
        logger.error(f"Error sending command to Baresip: {e}")

# Function to handle an active call
def handle_call():
    global call_in_progress
    
    logger.info("Handling new call")
    
    # Play greeting
    greeting = "Hello, this is an AI assistant. How can I help you today?"
    greeting_file = speak(greeting)
    play_audio_through_baresip(greeting_file)
    
    # Start audio stream for recording
    with sd.InputStream(callback=audio_callback, channels=1, samplerate=sample_rate):
        while call_in_progress:
            # Record for a few seconds
            start_recording()
            time.sleep(5)  # Record for 5 seconds
            audio_file = stop_recording()
            
            if audio_file:
                # Process the audio
                transcription = transcribe_audio(audio_file)
                
                # If transcription is empty or very short, continue recording
                if not transcription or len(transcription.split()) < 2:
                    continue
                
                # Generate and speak response
                response = get_ai_response(transcription)
                response_file = speak(response)
                play_audio_through_baresip(response_file)
    
    logger.info("Call handling completed")

# Main function
def main():
    logger.info("Starting SIP Bot")
    
    # Create logs directory if it doesn't exist
    os.makedirs("logs", exist_ok=True)
    
    # Setup Baresip configuration
    setup_baresip_config()
    
    # Start Baresip
    start_baresip()
    
    # Keep the main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down SIP Bot")
        if baresip_process:
            baresip_process.terminate()

if __name__ == "__main__":
    main()