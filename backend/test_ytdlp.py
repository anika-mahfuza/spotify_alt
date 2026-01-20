import yt_dlp
import json

def search_and_test(query):
    ydl_opts = {
        'format': 'bestaudio/best',
        'noplaylist': True,
        'quiet': True,
        'default_search': 'ytsearch1'
    }
    print(f"Attempting to search for: '{query}'...")
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # ytsearch1:query returns a playlist with 1 video
            info = ydl.extract_info(query, download=False)
            
            if 'entries' in info:
                video = info['entries'][0]
            else:
                video = info
            
            print("\n--- RESULT ---")
            print(f"Title: {video.get('title')}")
            print(f"Duration: {video.get('duration')}s")
            print(f"Playback URL found: {'Yes' if video.get('url') else 'No'}")
            print(f"Actual URL (truncated): {video.get('url')[:50]}...")
            print("\nSUCCESS: The host can access YouTube via yt-dlp.")
            
    except Exception as e:
        print(f"\nERROR: Failed to retrieve video info.")
        print(f"Details: {e}")

if __name__ == "__main__":
    search_and_test("Rick Astley - Never Gonna Give You Up")
