import requests
import base64
import json

url = "https://api.freepik.com/v1/ai/text-to-image"

payload = {
    "prompt": """A graphic representation of Python's logo (a snake) emerging from a computer screen, surrounded by symbols of Python language elements (e.g., variables, data types, loops, functions).
Include bright and contrasting colors to attract attention.
Consider adding a playful or humorous element to make the design memorable.
Highlight the video's key takeaways, such as the ease and speed of learning Python.
Use typography that is clear and easy to read, even when viewed as a thumbnail.
""",
    "negative_prompt": "bad",
    "image": {"size": "rectangular"}
}
headers = {
    "x-freepik-api-key": "FPSXa3deca8f33264f98826dff594fd98124",
    "Content-Type": "application/json",
    "Accept": "application/json"
}

response = requests.request("POST", url, json=payload, headers=headers)

# Parse the JSON response
response_data = response.json()

# Get the base64-encoded image data
if "data" in response_data and len(response_data["data"]) > 0:
    base64_image = response_data["data"][0]["base64"]

    # Decode the base64 image data
    image_data = base64.b64decode(base64_image)

    # Save the image data to a file
    with open("generated_image.png", "wb") as image_file:
        image_file.write(image_data)

    print("Image saved as generated_image.png")
else:
    print("No image data found in the response.")
