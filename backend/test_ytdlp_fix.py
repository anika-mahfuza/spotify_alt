#!/usr/bin/env python3
"""
Quick test to verify yt-dlp can extract YouTube URLs
Run this to test if yt-dlp is working before starting the server
"""

import yt_dlp
import sys

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

YTDL_OPTS = {
  "format": "bestaudio[ext=m4a]/bestaudio/best",
  "noplaylist": True,
  "quiet": False,
  "no_warnings": False,
  "cookiefile": "cookies.txt",  # after you export cookies with --cookies-from-browser
  "verbose": True,
  "extractor_args": {
    "youtube": {
      # temporary: allow formats missing POT (may still 403 on download)
      "formats": "missing_pot"
      # or, if you have a token: "po_token": "mweb.gvs+YOURTOKEN",
      # and/or "visitor_data": "YOUR_VISITOR_DATA"
    }
  },
}


def test_extraction():
    """Test if we can extract a YouTube video URL"""
    test_video = "dQw4w9WgXcQ"  # Rick Astley - Never Gonna Give You Up
    video_url = f"https://www.youtube.com/watch?v={test_video}"
    
    print(f"Testing URL extraction for: {video_url}")
    print(f"Using User-Agent: {USER_AGENT}\n")
    
    try:
        with yt_dlp.YoutubeDL(YTDL_OPTS) as ydl:
            print("Extracting video info...")
            info = ydl.extract_info(video_url, download=False)
            
            formats = info.get("formats", [])
            audio_formats = [
                f for f in formats
                if f.get("vcodec") == "none" and f.get("acodec") != "none"
            ]
            
            print(f"\nFound {len(audio_formats)} audio formats")
            
            if audio_formats:
                best = sorted(audio_formats, key=lambda x: x.get("tbr", 0) or 0, reverse=True)[0]
                print(f"\nBest audio format:")
                print(f"  Format ID: {best.get('format_id')}")
                print(f"  Quality: {best.get('tbr')} kbps")
                print(f"  Extension: {best.get('ext')}")
                print(f"  URL available: {'Yes' if best.get('url') else 'No'}")
                
                if best.get('url'):
                    url = best['url']
                    print(f"\n✓ SUCCESS! Got stream URL (length: {len(url)} chars)")
                    print(f"  URL starts with: {url[:50]}...")
                    return True
                else:
                    print("\n✗ FAILED: No URL in format")
                    return False
            else:
                print("\n✗ FAILED: No audio formats found")
                return False
                
    except Exception as e:
        print(f"\n✗ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("="*60)
    print("YT-DLP YouTube Extraction Test")
    print("="*60 + "\n")
    
    success = test_extraction()
    
    print("\n" + "="*60)
    if success:
        print("✓ Test PASSED - yt-dlp is working correctly")
        print("The backend should be able to play songs")
    else:
        print("✗ Test FAILED - there's an issue with yt-dlp")
        print("\nPossible fixes:")
        print("  1. Update yt-dlp: pip install --upgrade yt-dlp")
        print("  2. Clear cache and try again")
        print("  3. Your IP might be temporarily blocked by YouTube")
        print("  4. Try using a VPN or proxy")
    print("="*60)
    
    sys.exit(0 if success else 1)
