import streamlit as st
from dotenv import load_dotenv
import os
import google.generativeai as genai
from youtube_transcript_api import YouTubeTranscriptApi
import requests
import base64
import json

load_dotenv()  # Load all the environment variables

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
freepik_api_key = os.getenv("FREEPIK_API_KEY")

prompt = """
You are a YouTube video summarizer. You will take the transcript text
and give a prompt to create a YouTube thumbnail (i.e., graphic design prompts).
Give a detailed and better prompt for better image generation. It should include clear prompt and 
add in the summary not to include any text in image
"""

def extract_transcript_details(youtube_video_url):
    try:
        video_id = youtube_video_url.split("=")[1]
        transcript_text = YouTubeTranscriptApi.get_transcript(video_id)
        transcript = " ".join([i["text"] for i in transcript_text])
        return transcript
    except Exception as e:
        raise e

def generate_gemini_content(transcript_text, prompt):
    model = genai.GenerativeModel("gemini-pro")
    response = model.generate_content(prompt + transcript_text)
    return response.text

def generate_image_from_prompt(prompt):
    url = "https://api.freepik.com/v1/ai/text-to-image"
    payload = {
        "prompt": prompt + "create better images",
        "negative_prompt": "bad",
        "image": {"size": "rectangular"}
    }
    headers = {
        "x-freepik-api-key": freepik_api_key,
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    response = requests.post(url, json=payload, headers=headers)
    response_data = response.json()
    if "data" in response_data and len(response_data["data"]) > 0:
        base64_image = response_data["data"][0]["base64"]
        image_data = base64.b64decode(base64_image)
        return image_data
    else:
        return None

st.title("YouTube Transcript to Detailed Notes Converter")
youtube_link = st.text_input("Enter YouTube Video Link:")

if youtube_link:
    video_id = youtube_link.split("=")[1]
    # st.image(f"http://img.youtube.com/vi/{video_id}/0.jpg", use_column_width=True)

if st.button("Get Image"):
    transcript_text = extract_transcript_details(youtube_link)
    if transcript_text:
        summary = generate_gemini_content(transcript_text, prompt)
        st.markdown("## Image:")
        # st.write(summary)
        
        image_data = generate_image_from_prompt(summary)
        if image_data:
            with open("generated_image.png", "wb") as image_file:
                image_file.write(image_data)
            st.image("generated_image.png", use_column_width=True)
        else:
            st.write("No image data found in the response.")
