import pjsua2 as pj
import sounddevice as sd
import numpy as np
import openai
import requests
import yaml
import os

# Load Configurations
with open("config.yaml", "r") as file:
    config = yaml.safe_load(file)

SIP_USERNAME = os.getenv("SIP_USERNAME", config["sip"]["username"])
SIP_PASSWORD = os.getenv("SIP_PASSWORD", config["sip"]["password"])
SIP_DOMAIN = os.getenv("SIP_DOMAIN", config["sip"]["domain"])
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", config["ai"]["openai_key"])
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", config["ai"]["elevenlabs_key"])
TTS_VOICE = config["audio"]["tts_voice"]

# PJSUA2 Initialization
class MyAccount(pj.Account):
    def __init__(self):
        super().__init__()

    def onRegState(self, prm):
        print(f"SIP Registration: {prm.code}")

class MyCall(pj.Call):
    def __init__(self, acc, call_id=pj.PJSUA_INVALID_ID):
        super().__init__(acc, call_id)

    def onCallState(self, prm):
        ci = self.getInfo()
        print(f"Call {ci.remoteUri} - State: {ci.stateText}")
        if ci.state == pj.PJSIP_INV_STATE_DISCONNECTED:
            print("Call ended.")
    
    def onCallMediaState(self, prm):
        print("Audio stream active")
        self.start_ai_response()

    def start_ai_response(self):
        print("Listening for caller input...")
        user_text = transcribe_speech()
        if user_text:
            response = get_openai_response(user_text)
            tts_audio = generate_speech(response)
            play_audio(tts_audio)

# OpenAI Chat Response
def get_openai_response(text):
    openai.api_key = OPENAI_API_KEY
    response = openai.ChatCompletion.create(
        model="gpt-4-mini",
        messages=[{"role": "system", "content": "You are a helpful AI assistant."},
                  {"role": "user", "content": text}]
    )
    return response["choices"][0]["message"]["content"]

# Speech-to-Text using Whisper (Placeholder for actual implementation)
def transcribe_speech():
    print("Simulating transcription...")
    return "How can I reset my password?"

# Generate Speech using ElevenLabs API
def generate_speech(text):
    url = "https://api.elevenlabs.io/v1/text-to-speech"
    headers = {"xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json"}
    payload = {"voice": TTS_VOICE, "text": text}
    response = requests.post(url, json=payload, headers=headers)
    return response.content

# Play audio response
def play_audio(audio_data):
    print("Playing AI-generated response...")
    audio_array = np.frombuffer(audio_data, dtype=np.int16)
    sd.play(audio_array, samplerate=22050)
    sd.wait()

# Initialize SIP Client
def init_sip():
    ep = pj.Endpoint()
    ep.libCreate()
    ep.libInit(pj.EpConfig())
    ep.transportCreate(pj.PJSIP_TRANSPORT_UDP, pj.TransportConfig(5060))
    ep.libStart()

    acc_cfg = pj.AccountConfig()
    acc_cfg.idUri = f"sip:{SIP_USERNAME}@{SIP_DOMAIN}"
    acc_cfg.regConfig.registrarUri = f"sip:{SIP_DOMAIN}"
    cred = pj.AuthCredInfo("digest", "*", SIP_USERNAME, 0, SIP_PASSWORD)
    acc_cfg.sipConfig.authCreds.append(cred)

    acc = MyAccount()
    acc.create(acc_cfg)
    
    print("SIP Client Ready. Waiting for calls...")
    return ep

if __name__ == "__main__":
    sip_client = init_sip()
    while True:
        pass